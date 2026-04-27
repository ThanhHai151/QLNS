'use client';

import {
  useState, useCallback, useRef, useEffect, KeyboardEvent, useId,
} from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  queryApi, schemaApi, NodeId, NODE_COLORS,
  SchemaTable, QueryResult,
} from '@/lib/api';
import axios from 'axios';
import {
  Database, Play, ChevronRight, ChevronDown, Table2, Eye,
  Loader2, AlertTriangle, CheckCircle2, Clock, Columns3,
  History, X, Info, Server, Lightbulb, BookOpen, Plus,
  LayoutPanelLeft, LayoutPanelTop, PanelRight, Maximize2,
  GripHorizontal, GripVertical, RefreshCw, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────
const NODES: { id: NodeId; label: string; color: string }[] = [
  { id: 'master', label: 'Master',       color: '#6366f1' },
  { id: 'cn1',   label: 'CN1 Hà Nội',  color: '#10b981' },
  { id: 'cn2',   label: 'CN2 Đà Nẵng', color: '#f59e0b' },
  { id: 'cn3',   label: 'CN3 TP.HCM',  color: '#ef4444' },
];

const EXAMPLE_QUERIES = [
  { label: 'Tất cả nhân viên', sql: "SELECT IDNV, TENNV, GIOITINH, EMAIL, DIENTHOAI\nFROM NHANVIEN\nWHERE IsDeleted = 0 OR IsDeleted IS NULL\nORDER BY TENNV\nLIMIT 20;\n-- Chú ý: SQLite/Turso dùng LIMIT thay cho SELECT TOP N" },
  { label: 'Danh sách bảng', sql: "SELECT name, type\nFROM sqlite_master\nWHERE type='table'\nORDER BY name;" },
  { label: 'Đếm NV theo chi nhánh', sql: "SELECT CHINHANH, COUNT(*) AS SoNhanVien\nFROM NHANVIEN\nWHERE IsDeleted = 0 OR IsDeleted IS NULL\nGROUP BY CHINHANH\nORDER BY SoNhanVien DESC;" },
  { label: 'Bảng lương TOP 10', sql: "SELECT cc.IDNV, n.TENNV, b.LUONGCOBAN, b.LUONGTHUCTE, b.THUCNHAN\nFROM BANGLUONG b\nJOIN BANGCHAMCONG cc ON b.IDBC = cc.IDBC\nJOIN NHANVIEN n ON cc.IDNV = n.IDNV\nORDER BY b.THUCNHAN DESC\nLIMIT 10;" },
  { label: 'Cột bảng NHANVIEN', sql: "PRAGMA table_info('NHANVIEN');" },
  { label: 'Hợp đồng lao động', sql: "SELECT h.SODH, n.TENNV, h.NGAYBATDAU, h.NGAYKETTHUC, h.LUONGCOBAN, h.TRANGTHAI\nFROM HOPDONG h\nJOIN NHANVIEN n ON h.IDNV = n.IDNV\nWHERE h.IsDeleted = 0 OR h.IsDeleted IS NULL\nORDER BY h.NGAYBATDAU DESC\nLIMIT 10;" },
  { label: 'Tuyển dụng mở', sql: "SELECT VITRITD, SOLUONG, LUONGTOITHIEU, LUONGTOIDA, TRANGTHAI, IDCN\nFROM TUYENDUNG\nWHERE TRANGTHAI = 'Đang tuyển'\nORDER BY SOLUONG DESC;" },
  { label: 'Chấm công T1/2024', sql: "SELECT cc.IDNV, n.TENNV, cc.THANG, cc.NAM, cc.TONGNGAYLAM, cc.SONGAYNGHI, cc.SOGIOTANGCA\nFROM BANGCHAMCONG cc\nJOIN NHANVIEN n ON cc.IDNV = n.IDNV\nWHERE cc.THANG = 1 AND cc.NAM = 2024\nLIMIT 20;" },
  { label: 'Xem chi nhánh CN1', sql: "-- Truy vấn dữ liệu riêng của CN1 (Hà Nội)\n-- Chọn node CN1 Hà Nội ở toolbar để xem đúng phân mảnh\nSELECT IDNV, TENNV, GIOITINH, EMAIL, DIENTHOAI, CHINHANH\nFROM NHANVIEN\nWHERE (IsDeleted = 0 OR IsDeleted IS NULL)\nORDER BY TENNV\nLIMIT 20;" },
  { label: '@node directive', sql: "-- ═══ CROSS-NODE ROUTING ═══════════════════════════════\n-- Tương đương: UPDATE QLNS_CN2.dbo.NHANVIEN SET ...\n-- Dùng directive -- @node: <nodeId> để route sang node khác\n-- Dù đang ở node nào, query sẽ chạy trên node chỉ định\n-- ═══════════════════════════════════════════════════════\n\n-- @node: cn2\nUPDATE NHANVIEN\nSET DIENTHOAI = '0988777666'\nWHERE IDNV = 'NV002';\n\n-- Kết quả: thực thi trên CN2 Đà Nẵng thay vì node hiện tại" },
];

// Generate dummy SQL for a specific branch (CHINHANH) — used for distributed insert
function generateDummySqlForBranch(tableName: string, chinhanh: 'CN1' | 'CN2' | 'CN3', count = 17) {
  const t = tableName.toUpperCase();
  const ns = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
  const ms = ['Văn', 'Hữu', 'Đức', 'Công', 'Quang', 'Thị', 'Ngọc', 'Minh', 'Tuấn', 'Thanh'];
  const fn = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K', 'L', 'M', 'N', 'P', 'Q', 'T', 'V'];
  const randomName = () => `${ns[Math.floor(Math.random()*ns.length)]} ${ms[Math.floor(Math.random()*ms.length)]} ${fn[Math.floor(Math.random()*fn.length)]}`;
  const randomPhone = () => '09' + Math.floor(Math.random()*100000000).toString().padStart(8, '0');
  const chucvuList = ['CV001','CV002','CV003','CV004','CV005','CV006','CV007','CV008'];
  const trinhdoList = ['TD001','TD002','TD003','TD004','TD005','TD006','TD007'];
  const phongbanByCN: Record<string, string[]> = {
    CN1: ['PB_KD1','PB_KT1','PB_HC1'],
    CN2: ['PB_KD2','PB_MKT2','PB_NS2','PB_KT2'],
    CN3: ['PB_KD3','PB_KT3','PB_TC3','PB_DA3'],
  };
  const dantocList = ['Kinh','Tày','Thái','Mường','Hoa','Chăm'];
  const tonggiaoList = ['Không','Phật giáo','Thiên Chúa giáo','Hòa Hảo'];
  const honnhanList = ['Độc thân','Đã kết hôn'];

  if (t !== 'NHANVIEN') {
    return `-- Bảng ${t} chưa hỗ trợ auto generate trên UI này.\n-- Vui lòng tự viết câu INSERT.\n`;
  }

  // Prefix ID by branch to avoid collision: CN1→NV1XXXXX, CN2→NV2XXXXX, CN3→NV3XXXXX
  const prefix = chinhanh === 'CN1' ? '1' : chinhanh === 'CN2' ? '2' : '3';
  const baseId = Math.floor(Date.now() % 9000) + 1000;
  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `NV${prefix}${String(baseId + i).padStart(5, '0')}`;
    const gt = Math.random() > 0.5 ? 'Nam' : 'Nữ';
    const pb = phongbanByCN[chinhanh][Math.floor(Math.random() * phongbanByCN[chinhanh].length)];
    const cv = chucvuList[Math.floor(Math.random()*chucvuList.length)];
    const td = trinhdoList[Math.floor(Math.random()*trinhdoList.length)];
    const dt = dantocList[Math.floor(Math.random()*dantocList.length)];
    const tg = tonggiaoList[Math.floor(Math.random()*tonggiaoList.length)];
    const hn = honnhanList[Math.floor(Math.random()*honnhanList.length)];
    const yr = 1975 + Math.floor(Math.random()*25);
    const mo = String(Math.floor(Math.random()*12)+1).padStart(2,'0');
    const dy = String(Math.floor(Math.random()*28)+1).padStart(2,'0');
    rows.push(`('${id}', '${randomName()}', '${gt}', '${yr}-${mo}-${dy}', 'nvnv${id.toLowerCase()}@example.com', '${randomPhone()}', 'Địa chỉ ${chinhanh}-${i+1}', '${dt}', '${tg}', '${hn}', '${td}', '${cv}', '${pb}', '${chinhanh}')`);
  }

  return `-- ═══ DUMMY DATA: ${count} nhân viên cho ${chinhanh} ══════\n-- Node đích: ${chinhanh === 'CN1' ? 'cn1 (Hà Nội)' : chinhanh === 'CN2' ? 'cn2 (Đà Nẵng)' : 'cn3 (TP.HCM)'}\nINSERT INTO NHANVIEN (IDNV, TENNV, GIOITINH, NGAYSINH, EMAIL, DIENTHOAI, DIACHI, DANTOC, TONGIAO, HONNHAN, TRINHDO, CHUCVU, PHONGBAN, CHINHANH)\nVALUES\n${rows.join(',\n')};`;
}

function generateDummySql(tableName: string) {
  const t = tableName.toUpperCase();
  const ns = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
  const ms = ['Văn', 'Hữu', 'Đức', 'Công', 'Quang', 'Thị', 'Ngọc', 'Minh', 'Tuấn', 'Thanh'];
  const fn = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K', 'L', 'M', 'N', 'P', 'Q', 'T', 'V'];
  const randomName = () => `${ns[Math.floor(Math.random()*ns.length)]} ${ms[Math.floor(Math.random()*ms.length)]} ${fn[Math.floor(Math.random()*fn.length)]}`;
  const randomPhone = () => '09' + Math.floor(Math.random()*100000000).toString().padStart(8, '0');
  // Valid lookup values from schema
  const chucvuList = ['CV001','CV002','CV003','CV004','CV005','CV006','CV007','CV008'];
  const trinhdoList = ['TD001','TD002','TD003','TD004','TD005','TD006','TD007'];
  const phongbanByCN: Record<string, string[]> = {
    CN1: ['PB_KD1','PB_KT1','PB_HC1'],
    CN2: ['PB_KD2','PB_MKT2','PB_NS2','PB_KT2'],
    CN3: ['PB_KD3','PB_KT3','PB_TC3','PB_DA3'],
  };
  const dantocList = ['Kinh','Tày','Thái','Mường','Hoa','Chăm'];
  const tonggiaoList = ['Không','Phật giáo','Thiên Chúa giáo','Hòa Hảo'];
  const honnhanList = ['Độc thân','Đã kết hôn'];
  let sql = `-- Lệnh tạo 50 dữ liệu giả ngẫu nhiên cho bảng ${t}\n`;
  if (t === 'NHANVIEN') {
    // For NHANVIEN, use branch-split (generateDummySqlForBranch) instead — see DUMMY button handler
    sql += `-- Dùng nút DUMMY → chọn bảng NHANVIEN để sinh data phân tán đúng node.\n`;
  } else if (t === 'BANGCHAMCONG') {
    // Schema: IDBC,IDNV,THANG,NAM,SOGIOTANGCA,SONGAYNGHI,SONGAYDITRE,TONGNGAYLAM,TRANGTHAI
    sql += `INSERT INTO BANGCHAMCONG (IDBC, IDNV, THANG, NAM, TONGNGAYLAM, SONGAYNGHI, SONGAYDITRE, SOGIOTANGCA, TRANGTHAI)\nVALUES\n`;
    const rows: string[] = [];
    const baseId = Math.floor(Date.now() % 90000) + 10000;
    const nvIds = ['NV001','NV002','NV003','NV004','NV005','NV006','NV007','NV008','NV009','NV010','NV011','NV012'];
    for(let i=0; i<50; i++) {
        const idbc = 'BCC' + String(baseId + i).padStart(5, '0');
        const idnv = nvIds[Math.floor(Math.random()*nvIds.length)];
        const thang = Math.floor(Math.random()*12) + 1;
        const tongNgay = 20 + Math.floor(Math.random()*7);
        const ngayNghi = Math.floor(Math.random()*4);
        const ngayDiTre = Math.floor(Math.random()*3);
        const tangCa = Math.round(Math.random()*20 * 10) / 10;
        const tt = Math.random() > 0.3 ? 'Đã duyệt' : 'Chờ duyệt';
        rows.push(`('${idbc}', '${idnv}', ${thang}, 2024, ${tongNgay}, ${ngayNghi}, ${ngayDiTre}, ${tangCa}, '${tt}')`);
    }
    sql += rows.join(',\n') + ';';
  } else if (t === 'BANGLUONG') {
    // Schema: IDBL,IDBC,LUONGCOBAN,LUONGTHUCTE,THUETNCN,LUONGTHUONG,PHUCAPCHUCVU,KHOANTRUBAOHIEM,PHUCAPKHAC,KHOANTRUKHAC,THUCNHAN
    sql += `INSERT INTO BANGLUONG (IDBL, IDBC, LUONGCOBAN, LUONGTHUCTE, THUETNCN, LUONGTHUONG, PHUCAPCHUCVU, KHOANTRUBAOHIEM, PHUCAPKHAC, KHOANTRUKHAC, THUCNHAN)\nVALUES\n`;
    const rows: string[] = [];
    const baseId = Math.floor(Date.now() % 90000) + 10000;
    for(let i=0; i<50; i++) {
        const idbl = 'BL' + String(baseId + i).padStart(5, '0');
        const idbc = 'BCC' + String(baseId + i).padStart(5, '0');
        const lcb = (10 + Math.floor(Math.random()*15)) * 1000000;
        const luongThucTe = Math.round(lcb * (1 + Math.random()*0.1));
        const thueTNCN = Math.round(lcb * 0.02);
        const thuong = Math.random() > 0.5 ? Math.round(lcb * 0.1) : 0;
        const phucapCV = Math.round(lcb * 0.1);
        const baohiem = Math.round(lcb * 0.08);
        const phucapKhac = Math.round(Math.random() * 500000);
        const khoantruKhac = 0;
        const thucNhan = luongThucTe + thuong + phucapCV + phucapKhac - thueTNCN - baohiem - khoantruKhac;
        rows.push(`('${idbl}', '${idbc}', ${lcb}, ${luongThucTe}, ${thueTNCN}, ${thuong}, ${phucapCV}, ${baohiem}, ${phucapKhac}, ${khoantruKhac}, ${thucNhan})`);
    }
    sql += rows.join(',\n') + ';';
  } else {
    sql += `-- Bảng ${t} hiện chưa được hỗ trợ auto generate data trên UI này.\n-- Vui lòng tự viết truy vấn INSERT.\n`;
  }
  return sql;
}

const DOC_CONTENT = `# Tài liệu Hệ thống CSDL Phân Tán

## 📐 Kiến trúc phân tán

\`\`\`
  ┌─────────────────────────────────┐
  │     Master Node (port 1432)     │
  │   QuanLyNhanSu — All tables     │
  └──────┬──────┬──────┬────────────┘
         │      │      │
    ┌────┘  ┌───┘  ┌───┘
    ▼       ▼      ▼
  CN1      CN2    CN3
 (HN)     (ĐN)  (HCM)
 1437     1435   1436
\`\`\`

## 🗄️ Các bảng trong hệ thống

| Bảng | Mô tả | Phân mảnh |
|------|-------|-----------|
| NHANVIEN | Thông tin nhân viên | Theo CHINHANH |
| BANGCHAMCONG | Bảng chấm công | Theo CN nhân viên |
| BANGLUONG | Bảng lương | Theo CN nhân viên |
| HOPDONG | Hợp đồng lao động | Theo CN |
| TUYENDUNG | Tuyển dụng | Theo CN |
| CHUCVU | Chức vụ (lookup) | Tập trung Master |
| PHONGBAN | Phòng ban | Master + CN |
| CHINHANH | Danh sách chi nhánh | Master |
| TRINHDO | Trình độ học vấn | Master |

## 🔀 Cập nhật dữ liệu trên server khác

Đây là hệ thống phân tán dùng Turso (SQLite). Để chỉnh sửa dữ liệu\ntrên một node cụ thể:

1. **Chọn Node đích** ở thanh công cụ (ô tròn màu góc trên)
2. **Chạy câu lệnh** — backend tự động gửi đến node đã chọn
3. **Đồng bộ Master** — thay đổi tự động sync về Master

\`\`\`sql
-- Ví dụ: Chọn CN2 trên toolbar, sau đó chạy:
UPDATE NHANVIEN
SET DIENTHOAI = '0988777666'
WHERE IDNV = 'NV002';
\`\`\`

## 📊 Câu lệnh phân tán mẫu

### 1. Truy vấn toàn cục (Global Query)
\`\`\`sql
-- Đếm nhân viên theo chi nhánh
SELECT CHINHANH, COUNT(*) AS SoNV
FROM NHANVIEN
WHERE IsDeleted = 0 OR IsDeleted IS NULL
GROUP BY CHINHANH
ORDER BY SoNV DESC
\`\`\`

### 2. JOIN phân tán
\`\`\`sql
SELECT n.TENNV, n.EMAIL, cv.TENCV, pb.TENPB
FROM NHANVIEN n
JOIN CHUCVU cv ON n.CHUCVU = cv.IDCV
JOIN PHONGBAN pb ON n.PHONGBAN = pb.IDPB
ORDER BY n.TENNV
\`\`\`

### 3. Thống kê lương
\`\`\`sql
SELECT 
  n.CHINHANH,
  COUNT(*) AS SoNV,
  AVG(b.THUCNHAN) AS LuongTB,
  MAX(b.THUCNHAN) AS LuongCao,
  MIN(b.THUCNHAN) AS LuongThap
FROM NHANVIEN n
JOIN BANGCHAMCONG cc ON n.IDNV = cc.IDNV
JOIN BANGLUONG b ON cc.IDBC = b.IDBC
GROUP BY n.CHINHANH
ORDER BY LuongTB DESC
\`\`\`

### 4. Phân tích tuyển dụng
\`\`\`sql
SELECT 
  t.VITRITD, t.SOLUONG,
  t.SOHOSODATUYEN, t.TRANGTHAI,
  c.TENCNHANH
FROM TUYENDUNG t
JOIN CHINHANH c ON t.IDCN = c.IDCN
ORDER BY t.SOLUONG DESC
\`\`\`

## ⚡ Tips SQL Terminal
- **Ctrl+Enter** — Chạy truy vấn nhanh  
- Click tên bảng trong Explorer → chèn vào editor  
- Dùng **"Xem dữ liệu"** (icon table) để preview nhanh 100 dòng  
- **Multi-window** — thêm tab để chạy song song nhiều queries  
- Kéo thanh chia — resize vùng editor/kết quả  
- **Tên bảng viết HOA** — SQLite phân biệt chữ hoa/thường  
`;

const HISTORY_KEY = 'sql_terminal_history_v2';
const SESSION_TABS_KEY = 'sql_terminal_tabs_v1';

// ─── Types ─────────────────────────────────────────────────────────────────
type PanelLayout = 'bottom' | 'right' | 'left' | 'full-editor' | 'full-result';

interface TabState {
  id: string;
  sql: string;
  node: NodeId;
  result: QueryResult | null;
  error: { error: string; errorLine?: number | null; suggestions?: string[] } | null;
  execTime: number | null;
  loading: boolean;
  label: string;
  paneId: number; // 0 for left, 1 for right
}

// ─── SQL Editor ────────────────────────────────────────────────────────────
function SqlEditor({
  value, onChange, errorLine, onRun,
}: {
  value: string; onChange: (v: string) => void;
  errorLine: number | null; onRun: () => void;
}) {
  const lines = value.split('\n');
  const lineCount = Math.max(lines.length, 6);
  // Refs to sync scroll between textarea and line numbers
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);

  // Sync line-number scroll whenever textarea scrolls
  const syncScroll = () => {
    if (textareaRef.current && lineNumRef.current) {
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const s = ta.selectionStart, end = ta.selectionEnd;
      const nv = value.substring(0, s) + '    ' + value.substring(end);
      onChange(nv);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 4; });
    }
  };

  return (
    <div className="sql-editor-wrap" style={{ height: '100%' }}>
      {/* Line numbers — overflow hidden, scrolled programmatically */}
      <div ref={lineNumRef} className="sql-line-numbers" style={{ overflowY: 'hidden' }}>
        {Array.from({ length: lineCount }, (_, i) => i + 1).map(n => (
          <div key={n} className={cn(errorLine === n ? 'error-line' : '')} style={{ minHeight: '1.6em' }}>{n}</div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        className="sql-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        rows={lineCount}
        spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
        placeholder={"-- Nhập câu lệnh SQL tại đây\n-- Ctrl+Enter để thực thi\nSELECT * FROM NHANVIEN LIMIT 10"}
        style={{ height: '100%' }}
      />
    </div>
  );
}

import { DataTable, Column } from '@/components/ui/DataTable';

function ResultTable({ result }: { result: QueryResult }) {
  if (result.rowCount === 0) return (
    <div className="flex flex-col items-center justify-center h-24 text-white/30 gap-2">
      <CheckCircle2 size={18} className="text-emerald-500/50" />
      <span className="text-sm">Truy vấn thành công — 0 dòng</span>
    </div>
  );

  const columns: Column<any>[] = [
    { 
      key: '_index', 
      title: '#', 
      sortable: true,
      render: (r) => <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>{r._index}</span>
    },
    ...result.columns.map(col => ({
      key: col,
      title: col,
      sortable: true,
      searchable: true,
      render: (r: any) => {
        const val = r[col];
        if (val === null || val === undefined) return <span className="null-val">NULL</span>;
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      }
    }))
  ];

  const [search, setSearch] = useState('');
  const dataWithIndex = result.rows.map((r, i) => ({ ...r, _index: i + 1 }));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '4px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
        <input 
          placeholder="Tìm trong kết quả SQL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-xs text-white/80 placeholder:text-white/30 border-none outline-none w-full"
        />
      </div>
      <DataTable 
        columns={columns} 
        data={dataWithIndex} 
        globalSearch={search}
        maxHeight="100%"
      />
    </div>
  );
}

// ─── Schema panel (DBeaver-style) ─────────────────────────────────────────
function SchemaPanel({
  nodeId, onInsertTable, onPreviewTable,
}: {
  nodeId: NodeId;
  onInsertTable: (name: string) => void;
  onPreviewTable: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [schemaNode, setSchemaNode] = useState<NodeId>(nodeId);

  useEffect(() => { setSchemaNode(nodeId); }, [nodeId]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['schema', schemaNode],
    queryFn: () => schemaApi.get(schemaNode).then(r => r.data.data!),
    staleTime: 60_000,
  });

  const toggle = (name: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const renderGroup = (label: string, items: SchemaTable[], icon: React.ReactNode) => (
    <>
      <div className="px-3 pt-3 pb-1.5 text-[11px] text-white/40 font-bold uppercase tracking-widest flex items-center justify-between">
        <span>{label}</span><span className="text-white/20">{items.length}</span>
      </div>
      {items.map(table => (
        <div key={table.name}>
          <div
            onClick={() => toggle(table.name)}
            onDoubleClick={() => onPreviewTable(table.name)}
            className="group flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer hover:bg-white/10 transition-colors"
          >
            {expanded.has(table.name) ? <ChevronDown size={14} className="text-white/30 flex-shrink-0" /> : <ChevronRight size={14} className="text-white/30 flex-shrink-0" />}
            {icon}
            <span className="font-mono text-[13px] text-white/80 truncate flex-1">{table.name}</span>
            <div className="opacity-0 group-hover:opacity-100 flex gap-1">
              <button
                onClick={e => { e.stopPropagation(); onPreviewTable(table.name); }}
                title="Xem dữ liệu (SELECT TOP 100)"
                className="p-1 rounded hover:bg-indigo-500/30 text-indigo-400/60 hover:text-indigo-300"
              ><Table2 size={12} /></button>
              <button
                onClick={e => { e.stopPropagation(); onInsertTable(table.name); }}
                title="Chèn tên bảng vào editor"
                className="p-1 rounded hover:bg-white/20 text-white/30 hover:text-white text-[12px] font-mono"
              >↗</button>
            </div>
          </div>
          {expanded.has(table.name) && (
            <div className="ml-5 border-l border-white/10 pl-2 mb-1.5 mt-0.5">
              {table.columns.map(col => (
                <div key={col.name} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-white/5 cursor-default">
                  <Columns3 size={11} className="text-white/20 flex-shrink-0" />
                  <span className="font-mono text-[12px] text-white/50 truncate flex-1">{col.name}</span>
                  <span className="text-[10px] text-white/30 font-mono bg-black/20 px-1 rounded">{col.type}</span>
                  {!col.nullable && <span className="text-[9px] text-red-400/50">NN</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );

  return (
    <div className="h-full flex flex-col" style={{ background: '#0f172a' }}>
      {/* Node switcher */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px' }}>
        <div className="text-[11px] text-white/40 font-bold uppercase tracking-widest mb-2 px-1">Database Explorer</div>
        <div className="space-y-1">
          {NODES.map(node => (
            <button
              key={node.id}
              onClick={() => setSchemaNode(node.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all text-left shadow-sm',
                schemaNode === node.id ? 'text-white bg-white/10 ring-1 ring-white/10' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              )}
            >
              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: node.color }} />
              <span className="truncate">{node.label}</span>
              {schemaNode === node.id && <RefreshCw size={12} className="ml-auto text-white/30 hover:text-white cursor-pointer" onClick={e => { e.stopPropagation(); refetch(); }} />}
            </button>
          ))}
        </div>
      </div>
      {/* Object tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading && (
          <div className="flex items-center gap-2 p-3 text-white/30 text-xs">
            <Loader2 size={12} className="animate-spin" /> Đang tải...
          </div>
        )}
        {error && <div className="p-3 text-red-400/60 text-xs">Không thể tải schema</div>}
        {data && (
          <>
            {renderGroup('Tables', data.tables.filter(t => t.type === 'BASE TABLE'), <Table2 size={13} className="text-indigo-400/70 flex-shrink-0" />)}
            {data.tables.filter(t => t.type === 'VIEW').length > 0 && renderGroup('Views', data.tables.filter(t => t.type === 'VIEW'), <Eye size={13} className="text-purple-400/70 flex-shrink-0" />)}
            <div className="px-3 pt-3 pb-1 text-[11px] text-white/30 font-bold uppercase tracking-widest mt-2 border-t border-white/5">Stats</div>
            <div className="px-3 py-1.5 text-[12px] text-white/40">
              <div>{data.tableCount} bảng • {data.viewCount} view</div>
              <div className="text-[11px] text-white/30 mt-1 font-mono bg-black/20 p-1 rounded inline-block">{data.nodeInfo.name}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Single query pane ─────────────────────────────────────────────────────
function QueryPane({
  tab, onUpdate, onClose, canClose, schemaNode,
}: {
  tab: TabState;
  onUpdate: (patch: Partial<TabState>) => void;
  onClose: () => void;
  canClose: boolean;
  schemaNode: NodeId;
}) {
  const [layout, setLayout] = useState<PanelLayout>('bottom');
  const [editorSize, setEditorSize] = useState(40); // percent of total height (layout=bottom) or width (layout=right/left)
  const dragRef = useRef<{ start: number; init: number, containerSize: number } | null>(null);

  const runQuery = useCallback(async () => {
    if (!tab.sql.trim() || tab.loading) return;
    onUpdate({ loading: true, error: null, result: null });
    try {
      const res = await queryApi.execute(tab.sql, tab.node);
      onUpdate({
        result: res.data.data!,
        execTime: res.data.meta?.executionTimeMs ?? null,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      onUpdate({ loading: false, result: null });
      if (axios.isAxiosError(err) && err.response?.data) {
        const d = err.response.data;
        onUpdate({ error: { error: d.error, errorLine: d.errorLine, suggestions: d.suggestions } });
      } else {
        onUpdate({ error: { error: err.message || 'Lỗi không xác định' } });
      }
    }
  }, [tab.sql, tab.node, tab.loading, onUpdate]);

  // Drag to resize
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const containerSize = layout === 'bottom'
      ? (e.currentTarget as HTMLElement).closest('.query-pane-wrap')?.clientHeight ?? 600
      : (e.currentTarget as HTMLElement).closest('.query-pane-wrap')?.clientWidth ?? 900;
    
    dragRef.current = { start: layout === 'bottom' ? e.clientY : e.clientX, init: editorSize, containerSize };
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = (layout === 'bottom' ? ev.clientY : ev.clientX) - dragRef.current.start;
      const pct = dragRef.current.init + (delta / dragRef.current.containerSize) * 100;
      setEditorSize(Math.min(85, Math.max(15, pct)));
    };
    const up = () => { dragRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const node = NODES.find(n => n.id === tab.node) ?? NODES[0];

  const editorArea = (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%', minHeight: 80 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#0f172a', flexShrink: 0 }}>
        {/* Node selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {NODES.map(n => (
            <button key={n.id} onClick={() => onUpdate({ node: n.id })}
              title={n.label}
              style={{
                width: 20, height: 20, borderRadius: 4, border: `2px solid ${tab.node === n.id ? n.color : 'transparent'}`,
                background: tab.node === n.id ? n.color + '30' : 'transparent', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.color, margin: '4px auto' }} />
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{node.label}</span>
        <div style={{ flex: 1 }} />
        {/* Layout buttons */}
        <button title="Kết quả bên dưới" onClick={() => setLayout('bottom')} style={{ padding: '6px 8px', borderRadius: 4, background: layout === 'bottom' ? 'rgba(99,102,241,0.25)' : 'transparent', border: 'none', cursor: 'pointer', color: layout === 'bottom' ? '#a5b4fc' : 'rgba(255,255,255,0.3)' }}><LayoutPanelTop size={16} /></button>
        <button title="Kết quả bên phải" onClick={() => setLayout('right')} style={{ padding: '6px 8px', borderRadius: 4, background: layout === 'right' ? 'rgba(99,102,241,0.25)' : 'transparent', border: 'none', cursor: 'pointer', color: layout === 'right' ? '#a5b4fc' : 'rgba(255,255,255,0.3)' }}><PanelRight size={16} /></button>
        <button title="Kết quả bên trái" onClick={() => setLayout('left')} style={{ padding: '6px 8px', borderRadius: 4, background: layout === 'left' ? 'rgba(99,102,241,0.25)' : 'transparent', border: 'none', cursor: 'pointer', color: layout === 'left' ? '#a5b4fc' : 'rgba(255,255,255,0.3)' }}><LayoutPanelLeft size={16} /></button>
        <button title="Toàn màn hình editor" onClick={() => setLayout(layout === 'full-editor' ? 'bottom' : 'full-editor')} style={{ padding: '6px 8px', borderRadius: 4, background: layout === 'full-editor' ? 'rgba(99,102,241,0.25)' : 'transparent', border: 'none', cursor: 'pointer', color: layout === 'full-editor' ? '#a5b4fc' : 'rgba(255,255,255,0.3)' }}><Maximize2 size={16} /></button>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
        {/* Run */}
        <button onClick={runQuery} disabled={tab.loading || !tab.sql.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 7,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', cursor: 'pointer',
            color: 'white', fontSize: 13, fontWeight: 600, opacity: tab.loading || !tab.sql.trim() ? 0.5 : 1,
          }}>
          {tab.loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Chạy
        </button>
      </div>
      {/* Editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <SqlEditor value={tab.sql} onChange={sql => onUpdate({ sql })} errorLine={tab.error?.errorLine ?? null} onRun={runQuery} />
      </div>
    </div>
  );

  const resultArea = (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      {tab.error && (
        <div className="error-panel" style={{ margin: 8, flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-red-400" />
            <span className="error-title">Lỗi SQL</span>
            {tab.error.errorLine && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', color: '#f87171', padding: '1px 7px', borderRadius: 999, fontFamily: 'monospace' }}>Dòng {tab.error.errorLine}</span>}
          </div>
          <div className="error-msg">{tab.error.error}</div>
          {tab.error.suggestions?.map((s, i) => (
            <div key={i} className="suggestion-item mt-1">
              <span className="text-emerald-400/60">→</span><span>{s}</span>
            </div>
          ))}
        </div>
      )}
      {tab.result && !tab.error && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, flexWrap: 'wrap' }}>
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span style={{ color: '#34d399', fontSize: 12, fontWeight: 600 }}>Thành công</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{tab.result.rowCount.toLocaleString('vi-VN')} dòng</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{tab.result.columns.length} cột</span>
            {tab.execTime !== null && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} />{tab.execTime}ms</span>}
            {/* Fan-out sync info — shown when master DML propagates to branches */}
            {(tab.result as any).fanOut && (tab.result as any).fanOut.success?.length > 1 && (
              <span style={{ fontSize: 10, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 20, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Server size={9} />
                Đồng bộ → {(tab.result as any).fanOut.success.filter((n: string) => n !== 'master').map((n: string) => {
                  const node = NODES.find(x => x.id === n);
                  return <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: node?.color, display: 'inline-block' }} />
                    {node?.label ?? n}
                  </span>;
                })}
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: NODES.find(n => n.id === tab.result!.node)?.color }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{tab.result.nodeInfo.name}</span>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            <ResultTable result={tab.result} />
          </div>
        </>
      )}
      {!tab.result && !tab.error && !tab.loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'rgba(255,255,255,0.2)', gap: 8 }}>
          <Info size={20} />
          <span style={{ fontSize: 12 }}>Ctrl+Enter để thực thi</span>
        </div>
      )}
      {tab.loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'rgba(255,255,255,0.3)', gap: 8 }}>
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: 12 }}>Đang truy vấn {node.label}...</span>
        </div>
      )}
    </div>
  );

  // Drag divider
  const divider = (isHoriz: boolean) => (
    <div
      onMouseDown={startDrag}
      style={{
        flexShrink: 0, background: 'rgba(255,255,255,0.06)', cursor: isHoriz ? 'ns-resize' : 'ew-resize',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...(isHoriz ? { height: 6, width: '100%' } : { width: 6, height: '100%' }),
      }}
      className="hover:bg-indigo-500/20 transition-colors"
    >
      {isHoriz ? <GripHorizontal size={12} style={{ color: 'rgba(255,255,255,0.2)' }} /> : <GripVertical size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />}
    </div>
  );

  let content;
  if (layout === 'full-editor') content = <div style={{ flex: 1, overflow: 'hidden' }}>{editorArea}</div>;
  else if (layout === 'full-result') content = <div style={{ flex: 1, overflow: 'hidden' }}>{resultArea}</div>;
  else if (layout === 'bottom') content = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: `${editorSize}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{editorArea}</div>
      {divider(true)}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{resultArea}</div>
    </div>
  );
  else if (layout === 'right') content = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      <div style={{ width: `${editorSize}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{editorArea}</div>
      {divider(false)}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{resultArea}</div>
    </div>
  );
  else content = ( // left
    <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{resultArea}</div>
      {divider(false)}
      <div style={{ width: `${100 - editorSize}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{editorArea}</div>
    </div>
  );

  return (
    <div className="query-pane-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d1117' }}>
      {content}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────
// tabCounter starts at 2 because INITIAL_TAB already uses "Query 1"
let tabCounter = 2;

const INITIAL_SQL = "SELECT IDNV, TENNV, GIOITINH, EMAIL, DIENTHOAI\nFROM NHANVIEN\nWHERE IsDeleted = 0 OR IsDeleted IS NULL\nORDER BY TENNV\nLIMIT 20;\n-- LƯU Ý: SQLite/Turso dùng LIMIT thay cho SELECT TOP N";

// Stable initial tab — fixed ID so SSR and client render the same HTML (no hydration mismatch)
const INITIAL_TAB: TabState = {
  id: 'tab-initial-1',
  sql: INITIAL_SQL,
  node: 'master',
  result: null,
  error: null,
  execTime: null,
  loading: false,
  label: 'Query 1',
  paneId: 0,
};

function makeTab(node: NodeId = 'master', sql = '', paneId = 0): TabState {
  return {
    id: `tab-${Date.now()}-${tabCounter++}`,
    sql: sql || INITIAL_SQL,
    node,
    result: null,
    error: null,
    execTime: null,
    loading: false,
    label: `Query ${tabCounter - 1}`,
    paneId,
  };
}



import { MoreVertical } from 'lucide-react';

// ─── Restore tab state from sessionStorage ───────────────────────────────
function loadTabsFromSession(): { tabs: TabState[]; activeIds: { 0: string | null; 1: string | null } } | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(SESSION_TABS_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved.tabs) || saved.tabs.length === 0) return null;
    // Restore: strip transient state (loading/result/error)
    const tabs: TabState[] = saved.tabs.map((t: any) => ({
      id: t.id,
      sql: t.sql || '',
      node: t.node || 'master',
      label: t.label || 'Query',
      paneId: t.paneId ?? 0,
      result: null,
      error: null,
      execTime: null,
      loading: false,
    }));
    return { tabs, activeIds: saved.activeIds };
  } catch {
    return null;
  }
}

export default function SqlTerminalPage() {
  // Always initialize with INITIAL_TAB so SSR and client render the same HTML
  // (no hydration mismatch). sessionStorage is restored in useEffect after mount.
  const [tabs, setTabs] = useState<TabState[]>([INITIAL_TAB]);
  const [activeIds, setActiveIds] = useState<{ 0: string | null; 1: string | null }>({ 0: INITIAL_TAB.id, 1: null });
  const [schemaNode, setSchemaNode] = useState<NodeId>('master');
  
  const [showExamples, setShowExamples] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDummy, setShowDummy] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [history, setHistory] = useState<{ sql: string; node: NodeId; time: string }[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(240);
  const dragSidebarRef = useRef<{ startX: number; startW: number } | null>(null);
  const startDragSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    dragSidebarRef.current = { startX: e.clientX, startW: sidebarWidth };
    const move = (ev: MouseEvent) => {
      if (!dragSidebarRef.current) return;
      const nw = dragSidebarRef.current.startW + (ev.clientX - dragSidebarRef.current.startX);
      setSidebarWidth(Math.max(160, Math.min(500, nw)));
    };
    const up = () => { dragSidebarRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const [paneSplit, setPaneSplit] = useState(50);
  const dragCenterRef = useRef<{ startX: number; startW: number; parentW: number } | null>(null);
  const startDragCenter = (e: React.MouseEvent) => {
    e.preventDefault();
    const parent = (e.currentTarget as HTMLElement).parentElement;
    if (!parent) return;
    dragCenterRef.current = { startX: e.clientX, startW: paneSplit, parentW: parent.clientWidth };
    const move = (ev: MouseEvent) => {
      if (!dragCenterRef.current) return;
      const act = dragCenterRef.current;
      const delta = (ev.clientX - act.startX) / act.parentW * 100;
      setPaneSplit(Math.max(10, Math.min(90, act.startW + delta)));
    };
    const up = () => { dragCenterRef.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };


  useEffect(() => {
    try { const s = localStorage.getItem(HISTORY_KEY); if (s) setHistory(JSON.parse(s)); } catch {}
    // Restore tabs from sessionStorage AFTER mount (client-only, avoids hydration mismatch)
    const fromSession = loadTabsFromSession();
    if (fromSession) {
      setTabs(fromSession.tabs);
      setActiveIds(fromSession.activeIds);
    }
  }, []);

  // Persist tabs to sessionStorage whenever they change (exclude result/error to keep it light)
  useEffect(() => {
    try {
      const toSave = {
        tabs: tabs.map(t => ({ id: t.id, sql: t.sql, node: t.node, label: t.label, paneId: t.paneId })),
        activeIds,
      };
      sessionStorage.setItem(SESSION_TABS_KEY, JSON.stringify(toSave));
    } catch {}
  }, [tabs, activeIds]);

  useEffect(() => {
    const handleClick = () => setMenuOpenId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const updateTab = useCallback((id: string, patch: Partial<TabState>) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      if (patch.result && !patch.error) {
        const ent = { sql: next[idx].sql.trim(), node: next[idx].node, time: new Date().toLocaleTimeString('vi-VN') };
        const nh = [ent, ...history].slice(0, 30);
        setHistory(nh);
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(nh)); } catch {}
      }
      return next;
    });
  }, [history]);

  const addTab = (sql?: string, node?: NodeId, paneId: 0 | 1 = 0) => {
    const actId = activeIds[paneId];
    const actTab = tabs.find(t => t.id === actId);
    const t = makeTab(node ?? actTab?.node ?? 'master', sql, paneId);
    setTabs(prev => [...prev, t]);
    setActiveIds(prev => ({ ...prev, [paneId]: t.id }));
  };

  const addAndRunTab = (sql: string, node?: NodeId, paneId: 0 | 1 = 0) => {
    const actId = activeIds[paneId];
    const actTab = tabs.find(t => t.id === actId);
    const id = `tab-${Date.now()}-${tabCounter++}`;
    const t: TabState = {
      id, sql, node: node ?? actTab?.node ?? 'master', result: null, error: null, execTime: null, loading: true, label: `Query ${tabCounter - 1}`, paneId
    };
    setTabs(prev => [...prev, t]);
    setActiveIds(prev => ({ ...prev, [paneId]: t.id }));
    setTimeout(() => {
      queryApi.execute(sql, t.node).then(res => {
        setTabs(curr => curr.map(x => x.id === id ? { ...x, result: res.data.data!, execTime: res.data.meta?.executionTimeMs ?? null, loading: false } : x));
      }).catch(err => {
        setTabs(curr => curr.map(x => x.id === id ? { ...x, error: { error: err.message }, loading: false } : x));
      });
    }, 50);
  };

  const closeTab = (id: string, paneId: 0 | 1) => {
    const pTabs = tabs.filter(t => t.paneId === paneId);
    // Can't close last tab if it's the only one in the whole app
    if (tabs.length === 1) return;
    
    setTabs(prev => prev.filter(t => t.id !== id));
    
    if (activeIds[paneId] === id) {
      const remaining = pTabs.filter(t => t.id !== id);
      if (remaining.length > 0) {
        setActiveIds(prev => ({ ...prev, [paneId]: remaining[0].id }));
      } else {
        setActiveIds(prev => ({ ...prev, [paneId]: null }));
      }
    }
  };

  const renameTab = (id: string) => {
    const t = tabs.find(x => x.id === id);
    if (!t) return;
    const newName = window.prompt('Nhập tên Script mới:', t.label);
    if (newName && newName.trim()) {
      updateTab(id, { label: newName.trim() });
    }
  };

  const splitRight = (id: string) => {
    updateTab(id, { paneId: 1 });
    setActiveIds(prev => ({ ...prev, 1: id }));
    // If pane 0 has no active tab, try to activate one
    const p0Remaining = tabs.filter(t => t.paneId === 0 && t.id !== id);
    if (activeIds[0] === id) {
      setActiveIds(prev => ({ ...prev, 0: p0Remaining.length > 0 ? p0Remaining[0].id : null }));
    }
  };

  const moveToLeft = (id: string) => {
    updateTab(id, { paneId: 0 });
    setActiveIds(prev => ({ ...prev, 0: id }));
    const p1Remaining = tabs.filter(t => t.paneId === 1 && t.id !== id);
    if (activeIds[1] === id) {
      setActiveIds(prev => ({ ...prev, 1: p1Remaining.length > 0 ? p1Remaining[0].id : null }));
    }
  };

  const renderTabBar = (paneId: 0 | 1) => {
    const pTabs = tabs.filter(t => t.paneId === paneId);
    if (pTabs.length === 0) return null;
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, overflow: 'visible', background: '#0a0f1e', zIndex: 10 }}>
        {pTabs.map((t) => (
          <div
            key={t.id}
            onClick={() => setActiveIds(prev => ({ ...prev, [paneId]: t.id }))}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', cursor: 'pointer',
              borderRight: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, minWidth: 100, maxWidth: 180,
              background: t.id === activeIds[paneId] ? '#0d1117' : 'transparent',
              borderBottom: t.id === activeIds[paneId] ? '2px solid #6366f1' : '2px solid transparent',
              transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: NODES.find(n => n.id === t.node)?.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: t.id === activeIds[paneId] ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
            
            <div style={{ position: 'relative' }}>
              <button 
                onClick={e => { e.stopPropagation(); setMenuOpenId(t.id); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2, lineHeight: 1 }}
              >
                <MoreVertical size={11} />
              </button>
              {menuOpenId === t.id && (
                <div style={{ position: 'absolute', top: 0, left: '100%', marginLeft: 6, zIndex: 100, width: 150, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, boxShadow: '0 10px 40px rgba(0,0,0,0.5)', overflow: 'hidden', color: 'white' }}>
                  <button onClick={(e) => { e.stopPropagation(); renameTab(t.id); setMenuOpenId(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: 12 }}>Đổi tên Script</button>
                  {paneId === 0 ? (
                    <button onClick={(e) => { e.stopPropagation(); splitRight(t.id); setMenuOpenId(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: 12 }}>Di chuyển</button>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); moveToLeft(t.id); setMenuOpenId(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', fontSize: 12 }}>Di chuyển</button>
                  )}
                  {tabs.length > 1 && <button onClick={(e) => { e.stopPropagation(); closeTab(t.id, paneId); setMenuOpenId(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#f87171' }}>Đóng {t.label}</button>}
                </div>
              )}
            </div>
          </div>
        ))}
        <button onClick={() => addTab(undefined, undefined, paneId)} style={{ padding: '0 10px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', flexShrink: 0 }}>
          <Plus size={14} />
        </button>
      </div>
    );
  };

  const renderPaneGroup = (paneId: 0 | 1) => {
    const pTabs = tabs.filter(t => t.paneId === paneId);
    if (pTabs.length === 0) return null;
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {renderTabBar(paneId)}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {pTabs.map(t => (
            <div key={t.id} style={{ flex: 1, display: t.id === activeIds[paneId] ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
              <QueryPane
                tab={t}
                onUpdate={(patch) => updateTab(t.id, patch)}
                onClose={() => closeTab(t.id, paneId)}
                canClose={tabs.length > 1}
                schemaNode={schemaNode}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const hasPane1 = tabs.some(t => t.paneId === 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: 0 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, flexWrap: 'wrap' }}>
        <button 
          onClick={() => setIsExplorerOpen(!isExplorerOpen)} 
          title={isExplorerOpen ? 'Thu gọn Database Explorer' : 'Mở Database Explorer'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
            background: isExplorerOpen ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
            color: isExplorerOpen ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0, fontSize: 14, fontWeight: 700,
          }}
        >
          {isExplorerOpen ? '\u2039' : '\u203a'}
        </button>
        <Database size={20} className="text-indigo-400" />
        <span style={{ fontWeight: 700, fontSize: 18, color: 'white' }}>SQL Terminal</span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }} className="hidden md:inline-block">— Phân tán 4 nodes</span>
        <div style={{ flex: 1 }} />
        {/* Buttons */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowDummy(!showDummy); setShowExamples(false); setShowDocs(false); setShowHistory(false); }} className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 16px', color: '#fbbf24', borderColor: '#d9770640' }}>
            <Zap size={15} /> DUMMY
          </button>
          {showDummy && (
            <div style={{ position: 'absolute', zIndex: 100, right: 0, top: '100%', marginTop: 4, width: 260, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>Sinh dữ liệu giả — phân tán đúng node</div>
              {/* NHANVIEN: creates 3 tabs, one per branch node */}
              <button
                onClick={() => {
                  const branches: Array<{ cn: 'CN1'|'CN2'|'CN3'; node: NodeId }> = [
                    { cn: 'CN1', node: 'cn1' },
                    { cn: 'CN2', node: 'cn2' },
                    { cn: 'CN3', node: 'cn3' },
                  ];
                  branches.forEach(({ cn, node }) => {
                    addTab(generateDummySqlForBranch('NHANVIEN', cn), node as NodeId, 0);
                  });
                  setShowDummy(false);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ color: '#fbbf24', fontWeight: 600 }}>Bảng NHANVIEN</span>
                <span style={{ fontSize: 10, marginLeft: 6, color: 'rgba(255,255,255,0.35)' }}>→ 3 tabs (CN1/CN2/CN3)</span>
              </button>
              {['BANGCHAMCONG', 'BANGLUONG'].map((t) => (
                <button key={t} onClick={() => { addTab(generateDummySql(t), undefined, 0); setShowDummy(false); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >Bảng {t}</button>
              ))}
              <div style={{ padding: '7px 12px', fontSize: 10, color: 'rgba(255,255,255,0.25)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                ⚡ NHANVIEN tự động gửi đúng node phân tán
              </div>
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowExamples(!showExamples); setShowDocs(false); setShowHistory(false); setShowDummy(false); }} className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 16px' }}>
            <Lightbulb size={15} /> Ví dụ
          </button>
          {showExamples && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 99, width: 260, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>Câu lệnh mẫu</div>
              {EXAMPLE_QUERIES.map((q, i) => (
                <button key={i} onClick={() => { addTab(q.sql, undefined, 0); setShowExamples(false); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >{q.label}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowDocs(!showDocs); setShowExamples(false); setShowHistory(false); setShowDummy(false); }} className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 16px' }}>
            <BookOpen size={15} /> Docs
          </button>
          {showDocs && (
            <div style={{ position: 'fixed', top: 60, right: 16, zIndex: 200, width: 560, maxHeight: 'calc(100vh - 80px)', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, boxShadow: '0 30px 80px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontWeight: 700, color: 'white', fontSize: 14 }}>📖 Tài liệu hệ thống</span>
                <button onClick={() => setShowDocs(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'system-ui', fontSize: 12, lineHeight: 1.7, color: 'rgba(255,255,255,0.75)' }}>{DOC_CONTENT}</pre>
              </div>
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowHistory(!showHistory); setShowExamples(false); setShowDocs(false); setShowDummy(false); }} className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 16px' }}>
            <History size={15} /> Lịch sử {history.length > 0 && <span style={{ color: '#818cf8', marginLeft: 3 }}>{history.length}</span>}
          </button>
          {showHistory && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 99, width: 320, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>Lịch sử</span>
                <button onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); }} style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>Xóa</button>
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {history.length === 0 ? <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Chưa có lịch sử</div>
                  : history.map((h, i) => (
                    <button key={i} onClick={() => { addTab(h.sql, h.node, 0); setShowHistory(false); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 9, fontFamily: 'monospace', color: NODES.find(n => n.id === h.node)?.color }}>{h.node.toUpperCase()}</span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{h.time}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.sql.replace(/\s+/g, ' ')}</div>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body: schema + tabs */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        {/* Schema left panel */}
        {/* Desktop: relative panel (takes space). Mobile: absolute overlay with backdrop */}
        <div
          style={{ width: isExplorerOpen ? sidebarWidth : 0, flexShrink: 0, overflow: 'hidden', transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)' }}
          className="hidden md:block h-full border-r border-white/10"
        >
          <div style={{ width: sidebarWidth, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
            <SchemaPanel
              nodeId={schemaNode}
              onInsertTable={name => {
                const r = activeIds[0] ? 0 : 1;
                const tab = tabs.find(t => t.id === activeIds[r]);
                if (tab) updateTab(tab.id, { sql: (tab.sql ? tab.sql + '\n' : '') + name });
              }}
              onPreviewTable={name => {
                addAndRunTab(`SELECT * FROM ${name}`, undefined, tabs.some(t=>t.paneId===1) ? 1 : 0);
              }}
            />
          </div>
        </div>
        {/* Desktop resize handle */}
        {isExplorerOpen && (
          <div
            onMouseDown={startDragSidebar}
            style={{ width: 4, flexShrink: 0, cursor: 'col-resize', background: 'rgba(255,255,255,0.08)' }}
            className="hover:bg-indigo-500/20 transition-colors hidden md:block"
          />
        )}
        {/* Mobile: absolute overlay */}
        {isExplorerOpen && (
          <>
            <div style={{ width: sidebarWidth, flexShrink: 0, overflowY: 'auto', overflowX: 'hidden' }} className="md:hidden absolute inset-y-0 left-0 bg-[#0f172a] z-50 h-full border-r border-white/10 shadow-xl">
              <SchemaPanel
                nodeId={schemaNode}
                onInsertTable={name => {
                  const r = activeIds[0] ? 0 : 1;
                  const tab = tabs.find(t => t.id === activeIds[r]);
                  if (tab) updateTab(tab.id, { sql: (tab.sql ? tab.sql + '\n' : '') + name });
                  setIsExplorerOpen(false);
                }}
                onPreviewTable={name => {
                  addAndRunTab(`SELECT * FROM ${name}`, undefined, tabs.some(t=>t.paneId===1) ? 1 : 0);
                  setIsExplorerOpen(false);
                }}
              />
            </div>
            <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setIsExplorerOpen(false)}></div>
          </>
        )}

        {/* Right: panegroups layout */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minWidth: 0 }}>
           <div style={{ width: hasPane1 ? `${paneSplit}%` : '100%', display: 'flex', flexShrink: 0, overflow: 'hidden' }}>
             {renderPaneGroup(0)}
           </div>
           {hasPane1 && (
             <>
               <div
                 onMouseDown={startDragCenter}
                 style={{ width: 4, cursor: 'col-resize', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}
                 className="hover:bg-indigo-500/30 transition-colors"
               />
               <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
                 {renderPaneGroup(1)}
               </div>
             </>
           )}
        </div>
      </div>
    </div>
  );
}
