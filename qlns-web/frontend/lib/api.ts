// ============================================================
// Frontend API client — all backend calls centralized here
// ============================================================
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Types matching backend ─────────────────────────────────
export type NodeId = 'master' | 'cn1' | 'cn2' | 'cn3';
export type QueryMode = 'linked' | 'direct' | 'replication';

export interface ApiMeta {
  sourceNodes: NodeId[];
  queryMode: QueryMode;
  executionTimeMs: number;
  totalRows?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: ApiMeta;
}

export interface NodeStatus {
  id: NodeId;
  name: string;
  branch: string;
  city: string;
  port: number;
  status: 'online' | 'offline' | 'connecting';
  latencyMs?: number | null;
}

export interface HealthData {
  nodes: NodeStatus[];
  summary: { total: number; online: number; offline: number; queryMode: string };
}

export interface Employee {
  IDNV: string;
  TENNV: string;
  GIOITINH: string;
  NGAYSINH: string;
  CCCD: string;
  EMAIL: string;
  DIENTHOAI: string;
  DIACHI: string;
  DANTOC: string;
  TONGIAO: string;
  HONNHAN: string;
  TRINHDO: string;
  CHUCVU: string;
  PHONGBAN: string;
  CHINHANH: string;
  TEN_CHUCVU?: string;
  TEN_TRINHDO?: string;
  CHUYENNGANH?: string;
  TEN_PHONGBAN?: string;
  TEN_CHINHANH?: string;
  _sourceNode?: NodeId;
}

export interface Salary {
  IDBL: string;
  IDBC: string;
  LUONGCOBAN: number;
  LUONGTHUCTE: number;
  THUETNCN: number;
  LUONGTHUONG: number;
  PHUCAPCHUCVU: number;
  KHOANTRUBAOHIEM: number;
  PHUCAPKHAC: number;
  KHOANTRUKHAC: number;
  THUCNHAN: number;
  IDNV?: string;
  TENNV?: string;
  THANG?: number;
  NAM?: number;
  CHINHANH?: string;
  _sourceNode?: NodeId;
}

export interface Attendance {
  IDBC: string;
  IDNV: string;
  THANG: number;
  NAM: number;
  SOGIOTANGCA: number;
  SONGAYNGHI: number;
  SONGAYDITRE: number;
  TONGNGAYLAM: number;
  TRANGTHAI: string;
  TENNV?: string;
  CHINHANH?: string;
  _sourceNode?: NodeId;
}

export interface Contract {
  SODH: string;
  NGAYKY: string;
  NGAYBATDAU: string;
  NGAYKETTHUC: string | null;
  LUONGCOBAN: number;
  TRANGTHAI: string;
  IDNV: string;
  LOAIHD: string;
  TENNV?: string;
  TEN_LOAIHD?: string;
  CHINHANH?: string;
  _sourceNode?: NodeId;
}

export interface Recruitment {
  MATD: string;
  IDCN: string;
  VITRITD: string;
  DOTUOI: number;
  GIOITINH: string;
  SOLUONG: number;
  HANTD: string;
  LUONGTOITHIEU: number;
  LUONGTOIDA: number;
  SOHOSODANAOP: number;
  SOHOSODATUYEN: number;
  TRANGTHAI: string;
  TEN_CHINHANH?: string;
  _sourceNode?: NodeId;
}

export interface GlobalStats {
  totalEmployees: number;
  byBranch: { branch: string; city: string; count: number; nodeId: NodeId }[];
  avgSalary: number;
  totalSalaryPaid: number;
  activeContracts: number;
  openRecruitments: number;
}

// ── API functions ──────────────────────────────────────────
export const healthApi = {
  check: () => api.get<ApiResponse<HealthData>>('/api/health'),
  reconnect: (nodeId: string) => api.post<ApiResponse<any>>(`/api/health/reconnect/${nodeId}`),
};

export const employeeApi = {
  list: (branch?: string) => api.get<ApiResponse<Employee[]>>('/api/employees', { params: { branch } }),
  get: (id: string) => api.get<ApiResponse<Employee>>(`/api/employees/${id}`),
  create: (data: Partial<Employee>) => api.post<ApiResponse<any>>('/api/employees', data),
  update: (id: string, data: Partial<Employee>) => api.put<ApiResponse<any>>(`/api/employees/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<any>>(`/api/employees/${id}`),
};

export const salaryApi = {
  list: (params?: { branch?: string; thang?: number; nam?: number }) =>
    api.get<ApiResponse<Salary[]>>('/api/salaries', { params }),
};

export const attendanceApi = {
  list: (params?: { branch?: string; thang?: number; nam?: number }) =>
    api.get<ApiResponse<Attendance[]>>('/api/attendance', { params }),
};

export const contractApi = {
  list: (branch?: string) => api.get<ApiResponse<Contract[]>>('/api/contracts', { params: { branch } }),
};

export const recruitmentApi = {
  list: (branch?: string) => api.get<ApiResponse<Recruitment[]>>('/api/recruitment', { params: { branch } }),
  create: (data: Partial<Recruitment>) => api.post<ApiResponse<any>>('/api/recruitment', data),
  update: (id: string, data: Partial<Recruitment>) => api.put<ApiResponse<any>>(`/api/recruitment/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<any>>(`/api/recruitment/${id}`),
};

export const systemApi = {
  getNodes: () => api.get<ApiResponse<Record<string, { status: string; info: any }>>>('/api/system/nodes'),
  addNode: (data: any) => api.post<ApiResponse<any>>('/api/system/nodes', data),
  updateNode: (id: string, data: any) => api.put<ApiResponse<any>>(`/api/system/nodes/${id}`, data),
  deleteNode: (id: string) => api.delete<ApiResponse<any>>(`/api/system/nodes/${id}`),
};

export const reportApi = {
  global: () => api.get<ApiResponse<GlobalStats>>('/api/reports/global'),
};

export const lookupApi = {
  branches: () => api.get<ApiResponse<any[]>>('/api/lookup/branches'),
  positions: () => api.get<ApiResponse<any[]>>('/api/lookup/positions'),
  educations: () => api.get<ApiResponse<any[]>>('/api/lookup/educations'),
  departments: () => api.get<ApiResponse<any[]>>('/api/lookup/departments'),
};

// ── Query Terminal API ─────────────────────────────────────
export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  node: NodeId;
  nodeInfo: { name: string; branch: string; city: string; port: number };
}

export interface QueryErrorResponse {
  success: false;
  error: string;
  errorLine?: number | null;
  suggestions?: string[];
  node?: NodeId;
}

export const queryApi = {
  execute: (sqlText: string, node: NodeId = 'master') =>
    api.post<ApiResponse<QueryResult>>('/api/query', { sql: sqlText, node }),
};

export interface SchemaColumn {
  name: string;
  type: string;
  maxLength: number | null;
  nullable: boolean;
  default: string | null;
  position: number;
}

export interface SchemaTable {
  name: string;
  type: 'BASE TABLE' | 'VIEW';
  columns: SchemaColumn[];
}

export interface SchemaData {
  node: NodeId;
  nodeInfo: { name: string; branch: string; city: string; port: number };
  tables: SchemaTable[];
  tableCount: number;
  viewCount: number;
}

export const schemaApi = {
  get: (nodeId: NodeId) => api.get<ApiResponse<SchemaData>>(`/api/schema/${nodeId}`),
};

// ── Helpers ────────────────────────────────────────────────
export const NODE_COLORS: Record<NodeId, string> = {
  master: '#6366f1',
  cn1: '#10b981',
  cn2: '#f59e0b',
  cn3: '#ef4444',
};

export const NODE_LABELS: Record<NodeId, string> = {
  master: 'Master',
  cn1: 'HN',
  cn2: 'ĐN',
  cn3: 'HCM',
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN');
}
