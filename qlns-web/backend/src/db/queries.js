import { masterDb, hanoiDb, danangDb, hcmDb, branchClients } from './turso.js';

// Lấy tất cả nhân viên từ 3 chi nhánh song song
export async function getAllEmployees() {
  try {
    const [hanoiResult, danangResult, hcmResult] = await Promise.all([
      hanoiDb.execute('SELECT *, "hanoi" as chi_nhanh FROM NhanVien'),
      danangDb.execute('SELECT *, "danang" as chi_nhanh FROM NhanVien'),
      hcmDb.execute('SELECT *, "hcm" as chi_nhanh FROM NhanVien'),
    ]);

    return [
      ...hanoiResult.rows.map(row => ({ ...row, chi_nhanh: 'hanoi' })),
      ...danangResult.rows.map(row => ({ ...row, chi_nhanh: 'danang' })),
      ...hcmResult.rows.map(row => ({ ...row, chi_nhanh: 'hcm' })),
    ];
  } catch (error) {
    console.error('getAllEmployees error:', error);
    throw error;
  }
}

// Lấy nhân viên theo chi nhánh cụ thể
export async function getEmployeesByBranch(branch) {
  try {
    const client = branchClients[branch];
    if (!client) throw new Error(`Chi nhánh không hợp lệ: ${branch}`);
    const result = await client.execute('SELECT * FROM NhanVien');
    return result.rows;
  } catch (error) {
    console.error('getEmployeesByBranch error:', error);
    throw error;
  }
}

// Thống kê tổng hợp từ master
export async function getMasterStats() {
  try {
    const result = await masterDb.execute('SELECT * FROM ThongKe');
    return result.rows;
  } catch (error) {
    console.error('getMasterStats error:', error);
    throw error;
  }
}

// Chạy raw SQL trên DB được chỉ định
export async function runQuery(sql, branch = 'master') {
  try {
    const client = branchClients[branch];
    if (!client) throw new Error(`Chi nhánh không hợp lệ: ${branch}`);
    const result = await client.execute(sql);
    return result.rows;
  } catch (error) {
    console.error(`runQuery error trên ${branch}:`, error);
    throw error;
  }
}
