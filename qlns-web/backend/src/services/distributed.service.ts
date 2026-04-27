import { Client } from '@libsql/client';
import { db, NodeId } from '../config/database';
import type {
  Employee, CreateEmployeeDto, UpdateEmployeeDto,
  Salary, Attendance, Contract, Recruitment,
  GlobalStats, BranchSalaryReport, QueryMode,
  Position, Education, Department
} from '../types';

// ============================================================
// DISTRIBUTED QUERY SERVICE
// Handles all distributed database operations via Turso (LibSQL)
// ============================================================

const QUERY_MODE = (process.env.QUERY_MODE || 'direct') as QueryMode;

async function queryNode<T>(
  nodeId: NodeId,
  queryFn: (client: Client) => Promise<any>
): Promise<{ rows: T[]; nodeId: NodeId; success: boolean }> {
  try {
    const client = await db.getPoolOrThrow(nodeId);
    const result = await queryFn(client);
    return { rows: result.rows as unknown as T[], nodeId, success: true };
  } catch (err) {
    console.warn(`[DistQuery] Node ${nodeId} failed: ${(err as Error).message}`);
    return { rows: [], nodeId, success: false };
  }
}

async function queryAllBranches<T>(
  queryFn: (client: Client, nodeId: NodeId) => Promise<any>
): Promise<{ rows: T[]; sourceNodes: NodeId[] }> {
  const branchNodes: NodeId[] = db.getAllBranchNodeIds();
  const results = await Promise.all(
    branchNodes.map((n) => queryNode(n, (client) => queryFn(client, n)))
  );
  const rows: T[] = [];
  const sourceNodes: NodeId[] = [];
  for (const r of results) {
    if (r.success) {
      rows.push(...r.rows.map((row: any) => ({ ...row, _sourceNode: r.nodeId } as any)));
      sourceNodes.push(r.nodeId);
    }
  }
  return { rows, sourceNodes };
}

// ============================================================
// EMPLOYEES SERVICE
// ============================================================
export async function getAllEmployees(
  filterBranch?: string
): Promise<{ data: Employee[]; sourceNodes: NodeId[] }> {
  const baseQuery = `
    SELECT nv.*, cv.TENCV AS TEN_CHUCVU, td.TENTD AS TEN_TRINHDO,
           td.CHUYENNGANH, pb.TENPB AS TEN_PHONGBAN, cn.TENCNHANH AS TEN_CHINHANH
    FROM NHANVIEN nv
    LEFT JOIN CHUCVU cv ON nv.CHUCVU = cv.IDCV
    LEFT JOIN TRINHDO td ON nv.TRINHDO = td.IDTD
    LEFT JOIN PHONGBAN pb ON nv.PHONGBAN = pb.IDPB
    LEFT JOIN CHINHANH cn ON nv.CHINHANH = cn.IDCN
    WHERE nv.IsDeleted = 0 OR nv.IsDeleted IS NULL
  `;

  if (filterBranch) {
    const nodeId = db.getNodeForBranch(filterBranch);
    const result = await queryNode<Employee>(nodeId, (client) => client.execute(baseQuery));
    return { data: result.rows.map(r => ({ ...r, _sourceNode: result.nodeId })), sourceNodes: [nodeId] };
  }

  // Linked server is not supported natively in Sqlite/Turso across regions in one query like MSSQL.
  // We use direct mode for anything across nodes.
  const { rows, sourceNodes } = await queryAllBranches<Employee>(
    (client) => client.execute(baseQuery)
  );
  return { data: rows, sourceNodes };
}

export async function getEmployeeById(
  idnv: string
): Promise<{ data: Employee | null; sourceNode: NodeId | null }> {
  const branches = db.getAllBranchNodeIds();
  for (const nodeId of branches) {
    const result = await queryNode<Employee>(nodeId, (client) =>
      client.execute({
        sql: `
          SELECT nv.*, cv.TENCV AS TEN_CHUCVU, td.TENTD AS TEN_TRINHDO,
                 td.CHUYENNGANH, pb.TENPB AS TEN_PHONGBAN, cn.TENCNHANH AS TEN_CHINHANH
          FROM NHANVIEN nv
          LEFT JOIN CHUCVU cv ON nv.CHUCVU = cv.IDCV
          LEFT JOIN TRINHDO td ON nv.TRINHDO = td.IDTD
          LEFT JOIN PHONGBAN pb ON nv.PHONGBAN = pb.IDPB
          LEFT JOIN CHINHANH cn ON nv.CHINHANH = cn.IDCN
          WHERE nv.IDNV = ? AND (nv.IsDeleted = 0 OR nv.IsDeleted IS NULL)
        `,
        args: [idnv]
      })
    );
    if (result.success && result.rows.length > 0) {
      return { data: { ...result.rows[0], _sourceNode: nodeId as NodeId }, sourceNode: nodeId };
    }
  }
  return { data: null, sourceNode: null };
}

export async function createEmployee(data: CreateEmployeeDto): Promise<{ sourceNodes: NodeId[] }> {
  const branchNodeId = db.getNodeForBranch(data.CHINHANH);
  const sourceNodes: NodeId[] = [];

  const queryPayload = {
    sql: `
      INSERT INTO NHANVIEN 
      (IDNV,TENNV,GIOITINH,NGAYSINH,CCCD,EMAIL,DIENTHOAI,DIACHI,DANTOC,TONGIAO,HONNHAN,TRINHDO,CHUCVU,PHONGBAN,CHINHANH)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
    args: [
      data.IDNV, data.TENNV, data.GIOITINH || null, data.NGAYSINH ? String(data.NGAYSINH) : null,
      data.CCCD || null, data.EMAIL || null, data.DIENTHOAI || null, data.DIACHI || null,
      data.DANTOC || 'Kinh', data.TONGIAO || 'Không', data.HONNHAN || 'Độc thân',
      data.TRINHDO, data.CHUCVU, data.PHONGBAN, data.CHINHANH
    ]
  };

  const branchClient = await db.getPoolOrThrow(branchNodeId);
  await branchClient.execute(queryPayload);
  sourceNodes.push(branchNodeId);

  if (branchNodeId !== 'master' && db.isOnline('master')) {
    try {
      const masterClient = await db.getPoolOrThrow('master');
      await masterClient.execute(queryPayload);
      sourceNodes.push('master');
    } catch (err) {
      console.warn('[CreateEmployee] Failed to sync to master:', (err as Error).message);
    }
  }

  return { sourceNodes };
}

export async function updateEmployee(
  idnv: string,
  data: UpdateEmployeeDto
): Promise<{ sourceNodes: NodeId[] }> {
  const { data: emp, sourceNode } = await getEmployeeById(idnv);
  if (!emp || !sourceNode) throw new Error(`Employee ${idnv} not found in any node`);

  const updates: string[] = [];
  const args: any[] = [];
  
  if (data.TENNV !== undefined) { updates.push('TENNV=?'); args.push(data.TENNV); }
  if (data.EMAIL !== undefined) { updates.push('EMAIL=?'); args.push(data.EMAIL); }
  if (data.DIENTHOAI !== undefined) { updates.push('DIENTHOAI=?'); args.push(data.DIENTHOAI); }
  if (data.DIACHI !== undefined) { updates.push('DIACHI=?'); args.push(data.DIACHI); }
  if (data.CHUCVU !== undefined) { updates.push('CHUCVU=?'); args.push(data.CHUCVU); }
  if (data.PHONGBAN !== undefined) { updates.push('PHONGBAN=?'); args.push(data.PHONGBAN); }
  if (data.HONNHAN !== undefined) { updates.push('HONNHAN=?'); args.push(data.HONNHAN); }

  if (updates.length > 0) {
      args.push(idnv);
      const queryPayload = {
        sql: `UPDATE NHANVIEN SET ${updates.join(',')} WHERE IDNV=?`,
        args
      };

      const sourceNodes: NodeId[] = [];
      const branchClient = await db.getPoolOrThrow(sourceNode);
      await branchClient.execute(queryPayload);
      sourceNodes.push(sourceNode);

      if (sourceNode !== 'master' && db.isOnline('master')) {
        try {
          const masterClient = await db.getPoolOrThrow('master');
          await masterClient.execute(queryPayload);
          sourceNodes.push('master');
        } catch (err) {
          console.warn('[UpdateEmployee] Failed to sync to master:', (err as Error).message);
        }
      }
      return { sourceNodes };
  }
  return { sourceNodes: [sourceNode] };
}

export async function deleteEmployee(idnv: string): Promise<{ sourceNodes: NodeId[] }> {
  const { data: emp, sourceNode } = await getEmployeeById(idnv);
  if (!emp || !sourceNode) throw new Error(`Employee ${idnv} not found`);

  const doDelete = async (nodeId: NodeId): Promise<boolean> => {
    try {
      const client = await db.getPoolOrThrow(nodeId);
      await client.execute({ sql: 'UPDATE NHANVIEN SET IsDeleted = 1 WHERE IDNV=?', args: [idnv] });
      return true;
    } catch { return false; }
  };

  const sourceNodes: NodeId[] = [];
  if (await doDelete(sourceNode)) sourceNodes.push(sourceNode);
  if (sourceNode !== 'master' && db.isOnline('master')) {
    if (await doDelete('master')) sourceNodes.push('master');
  }
  return { sourceNodes };
}

// ============================================================
// SALARY SERVICE
// ============================================================
export async function getSalaries(
  filterBranch?: string, thang?: number, nam?: number
): Promise<{ data: Salary[]; sourceNodes: NodeId[] }> {
  const buildQuery = (hasDateFilter: boolean) => `
    SELECT bl.*, bc.IDNV, bc.THANG, bc.NAM, nv.TENNV, nv.CHINHANH
    FROM BANGLUONG bl
    JOIN BANGCHAMCONG bc ON bl.IDBC = bc.IDBC
    JOIN NHANVIEN nv ON bc.IDNV = nv.IDNV
    WHERE (nv.IsDeleted = 0 OR nv.IsDeleted IS NULL)
    ${hasDateFilter ? 'AND bc.THANG = ? AND bc.NAM = ?' : ''}
  `;

  const runQuery = (client: Client) => {
    if (thang && nam) {
        return client.execute({ sql: buildQuery(true), args: [thang, nam] });
    }
    return client.execute(buildQuery(false));
  };

  if (filterBranch) {
    const nodeId = db.getNodeForBranch(filterBranch);
    const result = await queryNode<Salary>(nodeId, runQuery);
    return { data: result.rows.map(r => ({ ...r, _sourceNode: nodeId as NodeId })), sourceNodes: [nodeId] };
  }

  const { rows, sourceNodes } = await queryAllBranches<Salary>((client) => runQuery(client));
  return { data: rows, sourceNodes };
}

// ============================================================
// ATTENDANCE SERVICE
// ============================================================
export async function getAttendance(
  filterBranch?: string, thang?: number, nam?: number
): Promise<{ data: Attendance[]; sourceNodes: NodeId[] }> {
  const buildQuery = (hasFilter: boolean) => `
    SELECT bc.*, nv.TENNV, nv.CHINHANH
    FROM BANGCHAMCONG bc
    JOIN NHANVIEN nv ON bc.IDNV = nv.IDNV
    WHERE (nv.IsDeleted = 0 OR nv.IsDeleted IS NULL)
    ${hasFilter ? 'AND bc.THANG = ? AND bc.NAM = ?' : ''}
  `;

  const runQuery = (client: Client) => {
    if (thang && nam) {
      return client.execute({ sql: buildQuery(true), args: [thang, nam] });
    }
    return client.execute(buildQuery(false));
  };

  if (filterBranch) {
    const nodeId = db.getNodeForBranch(filterBranch);
    const result = await queryNode<Attendance>(nodeId, runQuery);
    return { data: result.rows.map(r => ({ ...r, _sourceNode: nodeId as NodeId })), sourceNodes: [nodeId] };
  }

  const { rows, sourceNodes } = await queryAllBranches<Attendance>((client) => runQuery(client));
  return { data: rows, sourceNodes };
}

// ============================================================
// CONTRACTS SERVICE
// ============================================================
export async function getContracts(filterBranch?: string): Promise<{ data: Contract[]; sourceNodes: NodeId[] }> {
  const query = `
    SELECT hd.*, lhd.TENLOAI AS TEN_LOAIHD, nv.TENNV, nv.CHINHANH
    FROM HOPDONG hd
    JOIN LOAIHD lhd ON hd.LOAIHD = lhd.IDLOAI
    JOIN NHANVIEN nv ON hd.IDNV = nv.IDNV
    WHERE (nv.IsDeleted = 0 OR nv.IsDeleted IS NULL)
  `;

  if (filterBranch) {
    const nodeId = db.getNodeForBranch(filterBranch);
    const result = await queryNode<Contract>(nodeId, (client) => client.execute(query));
    return { data: result.rows.map(r => ({ ...r, _sourceNode: nodeId as NodeId })), sourceNodes: [nodeId] };
  }

  const { rows, sourceNodes } = await queryAllBranches<Contract>((client) => client.execute(query));
  return { data: rows, sourceNodes };
}

// ============================================================
// RECRUITMENT SERVICE
// ============================================================
export async function getRecruitments(filterBranch?: string): Promise<{ data: Recruitment[]; sourceNodes: NodeId[] }> {
  const query = `
    SELECT td.*, cn.TENCNHANH AS TEN_CHINHANH
    FROM TUYENDUNG td
    LEFT JOIN CHINHANH cn ON td.IDCN = cn.IDCN
    WHERE (td.IsDeleted = 0 OR td.IsDeleted IS NULL)
  `;

  if (filterBranch) {
    const nodeId = db.getNodeForBranch(filterBranch);
    const result = await queryNode<Recruitment>(nodeId, (client) => client.execute(query));
    return { data: result.rows.map(r => ({ ...r, _sourceNode: nodeId as NodeId })), sourceNodes: [nodeId] };
  }

  const { rows, sourceNodes } = await queryAllBranches<Recruitment>((client) => client.execute(query));
  return { data: rows, sourceNodes };
}

export async function getRecruitmentById(matd: string): Promise<{ data: Recruitment | null; sourceNode: NodeId | null }> {
  const branches = db.getAllBranchNodeIds();
  for (const nodeId of branches) {
    const result = await queryNode<Recruitment>(nodeId, (client) =>
      client.execute({
        sql: `
          SELECT td.*, cn.TENCNHANH AS TEN_CHINHANH
          FROM TUYENDUNG td
          LEFT JOIN CHINHANH cn ON td.IDCN = cn.IDCN
          WHERE td.MATD = ? AND (td.IsDeleted = 0 OR td.IsDeleted IS NULL)
        `,
        args: [matd]
      })
    );
    if (result.success && result.rows.length > 0) {
      return { data: { ...result.rows[0], _sourceNode: nodeId as NodeId }, sourceNode: nodeId };
    }
  }
  return { data: null, sourceNode: null };
}

export async function createRecruitment(data: import('../types').CreateRecruitmentDto): Promise<{ sourceNodes: NodeId[] }> {
  const branchNodeId = db.getNodeForBranch(data.IDCN);
  const sourceNodes: NodeId[] = [];

  const queryPayload = {
    sql: `
      INSERT INTO TUYENDUNG 
      (MATD,IDCN,VITRITD,DOTUOI,GIOITINH,SOLUONG,HANTD,LUONGTOITHIEU,LUONGTOIDA,SOHOSODANAOP,SOHOSODATUYEN,TRANGTHAI)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `,
    args: [
      data.MATD, data.IDCN, data.VITRITD, data.DOTUOI, data.GIOITINH, data.SOLUONG,
      data.HANTD ? String(data.HANTD) : null, data.LUONGTOITHIEU, data.LUONGTOIDA, 0, 0, data.TRANGTHAI || 'Đang tuyển'
    ]
  };

  const branchClient = await db.getPoolOrThrow(branchNodeId);
  await branchClient.execute(queryPayload);
  sourceNodes.push(branchNodeId);

  if (branchNodeId !== 'master' && db.isOnline('master')) {
    try {
      const masterClient = await db.getPoolOrThrow('master');
      await masterClient.execute(queryPayload);
      sourceNodes.push('master');
    } catch {}
  }

  return { sourceNodes };
}

export async function updateRecruitment(matd: string, data: import('../types').UpdateRecruitmentDto): Promise<{ sourceNodes: NodeId[] }> {
  const { data: rec, sourceNode } = await getRecruitmentById(matd);
  if (!rec || !sourceNode) throw new Error(`Recruitment ${matd} not found`);

  const updates: string[] = [];
  const args: any[] = [];
  
  if (data.VITRITD !== undefined) { updates.push('VITRITD=?'); args.push(data.VITRITD); }
  if (data.DOTUOI !== undefined) { updates.push('DOTUOI=?'); args.push(data.DOTUOI); }
  if (data.GIOITINH !== undefined) { updates.push('GIOITINH=?'); args.push(data.GIOITINH); }
  if (data.SOLUONG !== undefined) { updates.push('SOLUONG=?'); args.push(data.SOLUONG); }
  if (data.HANTD !== undefined) { updates.push('HANTD=?'); args.push(String(data.HANTD)); }
  if (data.LUONGTOITHIEU !== undefined) { updates.push('LUONGTOITHIEU=?'); args.push(data.LUONGTOITHIEU); }
  if (data.LUONGTOIDA !== undefined) { updates.push('LUONGTOIDA=?'); args.push(data.LUONGTOIDA); }
  if (data.SOHOSODANAOP !== undefined) { updates.push('SOHOSODANAOP=?'); args.push(data.SOHOSODANAOP); }
  if (data.SOHOSODATUYEN !== undefined) { updates.push('SOHOSODATUYEN=?'); args.push(data.SOHOSODATUYEN); }
  if (data.TRANGTHAI !== undefined) { updates.push('TRANGTHAI=?'); args.push(data.TRANGTHAI); }

  if (updates.length > 0) {
      args.push(matd);
      const queryPayload = { sql: `UPDATE TUYENDUNG SET ${updates.join(',')} WHERE MATD=?`, args };

      const sourceNodes: NodeId[] = [];
      const branchClient = await db.getPoolOrThrow(sourceNode);
      await branchClient.execute(queryPayload);
      sourceNodes.push(sourceNode);

      if (sourceNode !== 'master' && db.isOnline('master')) {
        try {
          const masterClient = await db.getPoolOrThrow('master');
          await masterClient.execute(queryPayload);
          sourceNodes.push('master');
        } catch {}
      }
      return { sourceNodes };
  }
  return { sourceNodes: [sourceNode] };
}

export async function deleteRecruitment(matd: string): Promise<{ sourceNodes: NodeId[] }> {
  const { data: rec, sourceNode } = await getRecruitmentById(matd);
  if (!rec || !sourceNode) throw new Error(`Recruitment ${matd} not found`);

  const doDelete = async (nodeId: NodeId): Promise<boolean> => {
    try {
      const client = await db.getPoolOrThrow(nodeId);
      await client.execute({ sql: 'UPDATE TUYENDUNG SET IsDeleted = 1 WHERE MATD=?', args: [matd] });
      return true;
    } catch { return false; }
  };

  const sourceNodes: NodeId[] = [];
  if (await doDelete(sourceNode)) sourceNodes.push(sourceNode);
  if (sourceNode !== 'master' && db.isOnline('master')) {
    if (await doDelete('master')) sourceNodes.push('master');
  }
  return { sourceNodes };
}

// ============================================================
// GLOBAL STATS — aggregate from all branches
// ============================================================
export async function getGlobalStats(): Promise<{ data: GlobalStats; sourceNodes: NodeId[] }> {
  const branches = db.getAllBranchNodeIds();
  
  const statsPromises = branches.map(async (nodeId) => {
    const result = await queryNode<{ branch: string; count: number }>(nodeId, (client) =>
      client.execute(`SELECT CHINHANH AS branch, COUNT(*) AS count FROM NHANVIEN WHERE IsDeleted = 0 OR IsDeleted IS NULL GROUP BY CHINHANH LIMIT 1`)
    );
    return { nodeId, rows: result.rows, success: result.success };
  });

  const countResults = await Promise.all(statsPromises);

  const [salaryRes, contractRes, recruitRes] = await Promise.all([
    queryAllBranches<{ avgSalary: number; totalSalary: number }>((client) =>
      client.execute(`
        SELECT AVG(THUCNHAN) AS avgSalary, SUM(THUCNHAN) AS totalSalary
        FROM BANGLUONG
      `)
    ),
    queryAllBranches<{ activeContracts: number }>((client) =>
      client.execute(`
        SELECT COUNT(*) AS activeContracts FROM HOPDONG WHERE TRANGTHAI = 'Có hiệu lực'
      `)
    ),
    queryAllBranches<{ openRecruitments: number }>((client) =>
      client.execute(`
        SELECT COUNT(*) AS openRecruitments FROM TUYENDUNG WHERE TRANGTHAI = 'Đang tuyển'
      `)
    )
  ]);

  const totalEmployees = countResults.reduce((a, r) => a + (r.rows[0]?.count || 0), 0);
  const avgSalary = salaryRes.rows.reduce((a, r) => a + (r.avgSalary || 0), 0) / (salaryRes.rows.length || 1);
  const totalSalaryPaid = salaryRes.rows.reduce((a, r) => a + (r.totalSalary || 0), 0);
  const activeContracts = contractRes.rows.reduce((a, r) => a + (r.activeContracts || 0), 0);
  const openRecruitments = recruitRes.rows.reduce((a, r) => a + (r.openRecruitments || 0), 0);

  const byBranch = countResults
    .filter(r => r.success && r.rows[0])
    .map(r => {
      const bn = r.rows[0].branch ? String(r.rows[0].branch).trim() : 'Unknown';
      const nodeInfo = db.nodes[r.nodeId as any];
      return {
        branch: bn,
        city: nodeInfo?.city || '',
        count: r.rows[0].count,
        nodeId: r.nodeId,
      };
    });

  return {
    data: { totalEmployees, byBranch, avgSalary, totalSalaryPaid, activeContracts, openRecruitments },
    sourceNodes: countResults.filter(r => r.success).map(r => r.nodeId),
  };
}

// ============================================================
// LOOKUP DATA
// ============================================================
export async function getBranches() {
  const nodeId = db.getAllBranchNodeIds().find(id => db.isOnline(id)) || 'master';
  const result = await queryNode(nodeId, (client) => client.execute('SELECT * FROM CHINHANH'));
  return result.rows;
}

export async function getPositions(): Promise<Position[]> {
  const nodeId = db.getAllBranchNodeIds().find(id => db.isOnline(id)) || 'master';
  if (!nodeId) return [];
  const result = await queryNode<Position>(nodeId, client => client.execute('SELECT * FROM CHUCVU'));
  return result.success ? result.rows : [];
}

export async function getEducations(): Promise<Education[]> {
  const nodeId = db.getAllBranchNodeIds().find(id => db.isOnline(id)) || 'master';
  if (!nodeId) return [];
  const result = await queryNode<Education>(nodeId, client => client.execute('SELECT * FROM TRINHDO'));
  return result.success ? result.rows : [];
}

export async function getDepartments(): Promise<Department[]> {
  const nodeId = db.getAllBranchNodeIds().find(id => db.isOnline(id)) || 'master';
  if (!nodeId) return [];
  const result = await queryNode<Department>(nodeId, client => client.execute('SELECT * FROM PHONGBAN'));
  return result.success ? result.rows : [];
}
