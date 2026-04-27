import { FastifyInstance } from 'fastify';
import { db, NodeId } from '../config/database';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Map CHINHANH code → branch node ID */
const CHINHANH_TO_NODE: Record<string, NodeId> = {
  CN1: 'cn1', CN2: 'cn2', CN3: 'cn3',
};

/** Detect if SQL is a write statement */
function isDML(sql: string): boolean {
  return /^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
}

/**
 * Parse `-- @node: cn2` directive from the first few lines of a query.
 * Returns the targeted nodeId, or null if none specified.
 */
function parseNodeDirective(sql: string): NodeId | null {
  const match = sql.match(/--\s*@node\s*:\s*(\w+)/i);
  if (!match) return null;
  const id = match[1].toLowerCase() as NodeId;
  const valid: NodeId[] = ['master', 'cn1', 'cn2', 'cn3'];
  return valid.includes(id) ? id : null;
}

/**
 * For INSERT INTO NHANVIEN with multiple rows, extract each row's CHINHANH
 * and group rows by their target branch. Returns a map of nodeId → partial SQL
 * (each containing only that branch's rows), or null if we can't parse.
 */
function splitInsertByBranch(sql: string): Record<NodeId, string> | null {
  const upper = sql.toUpperCase();
  
  // Match column list
  const colMatch = upper.match(/INSERT\s+INTO\s+NHANVIEN\s*\(([^)]+)\)/);
  if (!colMatch) return null;
  const cols = colMatch[1].split(',').map(c => c.trim());
  const chIdx = cols.findIndex(c => c === 'CHINHANH');
  if (chIdx === -1) return null;

  // Extract header (INSERT INTO ... VALUES) and all row tuples
  const headerMatch = sql.match(/INSERT\s+INTO\s+NHANVIEN\s*\([^)]+\)\s*VALUES\s*/i);
  if (!headerMatch) return null;
  const header = `INSERT INTO NHANVIEN (${sql.match(/INSERT\s+INTO\s+NHANVIEN\s*\(([^)]+)\)/i)![1]})\nVALUES\n`;

  // Parse individual value rows — find content after VALUES keyword
  const valuesStart = sql.toUpperCase().indexOf('VALUES') + 6;
  const valuesStr = sql.slice(valuesStart).trim();
  
  // Split by row: each row is (...) separated by comma
  const rows: string[] = [];
  let depth = 0, cur = '', inStr = false, strChar = '';
  for (const ch of valuesStr) {
    if (inStr) {
      cur += ch;
      if (ch === strChar) inStr = false;
    } else if (ch === "'" || ch === '"') {
      inStr = true; strChar = ch; cur += ch;
    } else if (ch === '(') {
      depth++; cur += ch;
    } else if (ch === ')') {
      depth--; cur += ch;
      if (depth === 0) { rows.push(cur.trim()); cur = ''; }
    } else if (ch === ',' && depth === 0) {
      // separator between rows — skip
    } else {
      cur += ch;
    }
  }

  const byBranch: Record<string, string[]> = {};
  for (const row of rows) {
    if (!row.startsWith('(')) continue;
    const inner = row.slice(1, -1); // remove wrapping parens
    // Split inner by comma, respecting quotes
    const vals: string[] = [];
    let v = '', vi = false, vc = '';
    for (const c of inner) {
      if (vi) { v += c; if (c === vc) vi = false; }
      else if (c === "'" || c === '"') { vi = true; vc = c; v += c; }
      else if (c === ',') { vals.push(v.trim()); v = ''; }
      else { v += c; }
    }
    vals.push(v.trim());
    
    const ch = vals[chIdx]?.replace(/^'|'$/g, '').toUpperCase();
    if (!ch) continue;
    if (!byBranch[ch]) byBranch[ch] = [];
    byBranch[ch].push(row);
  }

  if (Object.keys(byBranch).length === 0) return null;
  
  const result: Record<string, string> = {};
  for (const [ch, rowList] of Object.entries(byBranch)) {
    const nodeId = CHINHANH_TO_NODE[ch];
    if (nodeId) {
      result[nodeId] = header + rowList.join(',\n') + ';';
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

// ─── Query Route ─────────────────────────────────────────────────────────────
export async function queryRoutes(app: FastifyInstance) {
  app.post<{
    Body: { sql: string; node?: string }
  }>('/', async (req, reply) => {
    const start = Date.now();
    const { sql: sqlText, node = 'master' } = req.body;

    if (!sqlText || !sqlText.trim()) {
      return reply.status(400).send({ success: false, error: 'SQL query is required' });
    }

    // ── 1. Check for @node directive (cross-node routing) ─────────────────
    // Example: -- @node: cn2
    //          UPDATE NHANVIEN SET DIENTHOAI = '...' WHERE IDNV = '...'
    const directiveNode = parseNodeDirective(sqlText);
    const effectiveNode = (directiveNode || node) as NodeId;
    
    const validNodes: NodeId[] = ['master', 'cn1', 'cn2', 'cn3'];
    if (!validNodes.includes(effectiveNode)) {
      return reply.status(400).send({ success: false, error: `Invalid node. Use: ${validNodes.join(', ')}` });
    }

    const allowDDL = process.env.ALLOW_DDL === 'true';
    // Strip comments for validation (preserve original for execution)
    const strippedSql = sqlText.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const strippedUpper = strippedSql.toUpperCase();
    const allowedPrefixes = allowDDL
      ? ['SELECT', 'WITH', 'EXEC', 'EXECUTE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'PRAGMA']
      : ['SELECT', 'WITH', 'EXEC', 'EXECUTE', 'INSERT', 'UPDATE', 'DELETE', 'PRAGMA'];

    if (!allowedPrefixes.some(p => strippedUpper.startsWith(p))) {
      return reply.status(400).send({
        success: false,
        error: `Chỉ cho phép lệnh: ${allowedPrefixes.join(', ')}`,
        suggestions: ['Viết câu truy vấn bắt đầu bằng SELECT hoặc WITH'],
        errorLine: 1,
      });
    }

    try {
      // ── 2. Master node + DML → smart distributed fan-out ─────────────────
      if (effectiveNode === 'master' && isDML(strippedSql)) {
        const isNhanVienInsert = /^\s*INSERT\s+INTO\s+NHANVIEN/i.test(strippedSql);
        
        // Execute on master first
        const masterClient = await db.getPoolOrThrow('master');
        const masterResult = await masterClient.execute(sqlText);

        let successBranches: string[] = ['master'];
        let fanOutMode = '';

        if (isNhanVienInsert) {
          // Smart split: send only the correct rows to each branch
          const splitMap = splitInsertByBranch(sqlText);
          if (splitMap) {
            fanOutMode = 'split-by-branch';
            const splitResults = await Promise.allSettled(
              Object.entries(splitMap).map(async ([branchNodeId, branchSql]) => {
                if (!db.isOnline(branchNodeId)) await db.connectNode(branchNodeId);
                const client = await db.getPoolOrThrow(branchNodeId);
                await client.execute(branchSql);
                return branchNodeId;
              })
            );
            for (const r of splitResults) {
              if (r.status === 'fulfilled') successBranches.push(r.value);
            }
          } else {
            // Single row INSERT — extract CHINHANH and target correct node
            const chMatch = sqlText.match(/'(CN[123])'/i);
            const chinhanh = chMatch ? chMatch[1].toUpperCase() : null;
            const targetNode = chinhanh ? CHINHANH_TO_NODE[chinhanh] : null;
            if (targetNode) {
              fanOutMode = `single-row→${targetNode}`;
              try {
                if (!db.isOnline(targetNode)) await db.connectNode(targetNode);
                const client = await db.getPoolOrThrow(targetNode);
                await client.execute(sqlText);
                successBranches.push(targetNode);
              } catch (e) { /* best-effort */ }
            }
          }
        } else {
          // UPDATE / DELETE — fan-out to ALL branches (each branch runs it locally)
          fanOutMode = 'fan-out-all';
          const branchNodes = db.getAllBranchNodeIds();
          const branchResults = await Promise.allSettled(
            branchNodes.map(async (branchId) => {
              if (!db.isOnline(branchId)) await db.connectNode(branchId);
              const client = await db.getPoolOrThrow(branchId);
              await client.execute(sqlText);
              return branchId;
            })
          );
          for (const r of branchResults) {
            if (r.status === 'fulfilled') successBranches.push(r.value);
          }
        }

        const rowsAffected = Number(masterResult.rowsAffected ?? 0);
        const syncedBranches = successBranches.filter(n => n !== 'master');
        const fanInfo = syncedBranches.length > 0
          ? ` | Đồng bộ → ${syncedBranches.join(', ')}`
          : '';

        return reply.send({
          success: true,
          data: {
            columns: masterResult.columns.length > 0 ? masterResult.columns : ['Kết quả'],
            rows: masterResult.rows.length > 0
              ? masterResult.rows
              : [{ 'Kết quả': `${rowsAffected} dòng bị ảnh hưởng${fanInfo}` }],
            rowCount: masterResult.rows.length > 0 ? masterResult.rows.length : 1,
            node: 'master',
            nodeInfo: db.nodes['master'],
            fanOut: { success: successBranches, failed: [], mode: fanOutMode },
          },
          meta: {
            executionTimeMs: Date.now() - start,
            sourceNodes: successBranches,
            queryMode: 'distributed-' + fanOutMode,
          },
        });
      }

      // ── 3. Direct single-node execution ───────────────────────────────────
      // (specific branch selected, or SELECT on any node)
      const client = await db.getPoolOrThrow(effectiveNode);
      const result = await client.execute(sqlText);

      return reply.send({
        success: true,
        data: {
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rows.length,
          node: effectiveNode,
          nodeInfo: db.nodes[effectiveNode],
          routedVia: directiveNode ? `@node directive → ${directiveNode}` : undefined,
        },
        meta: {
          executionTimeMs: Date.now() - start,
          sourceNodes: [effectiveNode],
          queryMode: directiveNode ? 'directive' : (process.env.QUERY_MODE || 'direct'),
        },
      });
    } catch (err) {
      return reply.status(422).send({
        success: false,
        error: (err as Error).message,
        errorLine: null,
        suggestions: [
          'Kiểm tra lại câu truy vấn SQL',
          'Để truy vấn node khác, dùng: -- @node: cn2 ở đầu query',
        ],
        node: effectiveNode,
      });
    }
  });
}

export async function schemaRoutes(app: FastifyInstance) {
  app.get<{ Params: { nodeId: string } }>('/:nodeId', async (req, reply) => {
    const start = Date.now();
    const nodeId = req.params.nodeId as NodeId;
    const validNodes: NodeId[] = ['master', 'cn1', 'cn2', 'cn3'];

    if (!validNodes.includes(nodeId)) {
      return reply.status(400).send({ success: false, error: 'Invalid node ID' });
    }

    try {
      const client = await db.getPoolOrThrow(nodeId);
      
      const tablesResult = await client.execute(`
        SELECT name AS TABLE_NAME, type AS TABLE_TYPE 
        FROM sqlite_schema 
        WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);
      
      const tablesMap: Record<string, { type: string; columns: any[] }> = {};
      
      for (const row of tablesResult.rows) {
        const tableName = String(row.TABLE_NAME);
        tablesMap[tableName] = { type: String(row.TABLE_TYPE) === 'table' ? 'BASE TABLE' : 'VIEW', columns: [] };
        
        const colResult = await client.execute(`PRAGMA table_info('${tableName}')`);
        for (const col of colResult.rows) {
            tablesMap[tableName].columns.push({
                name: col.name,
                type: col.type,
                maxLength: null,
                nullable: col.notnull === 0,
                default: col.dflt_value,
                position: col.cid,
            });
        }
      }

      const tables = Object.entries(tablesMap).map(([name, info]) => ({
        name,
        type: info.type,
        columns: info.columns,
      }));

      return reply.send({
        success: true,
        data: {
          node: nodeId,
          nodeInfo: db.nodes[nodeId],
          tables,
          tableCount: tables.filter(t => t.type === 'BASE TABLE').length,
          viewCount: tables.filter(t => t.type === 'VIEW').length,
        },
        meta: { executionTimeMs: Date.now() - start, sourceNodes: [nodeId] },
      });
    } catch (err) {
      return reply.status(500).send({ success: false, error: (err as Error).message });
    }
  });
}
