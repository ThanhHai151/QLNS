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
  GripHorizontal, GripVertical, RefreshCw,
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
  { label: 'Tất cả nhân viên', sql: 'SELECT TOP 20\n  IDNV, TENNV, GIOITINH, EMAIL, DIENTHOAI\nFROM NhanVien\nORDER BY TENNV' },
  { label: 'Danh sách bảng', sql: "SELECT TABLE_NAME, TABLE_TYPE\nFROM INFORMATION_SCHEMA.TABLES\nWHERE TABLE_SCHEMA = 'dbo'\nORDER BY TABLE_TYPE, TABLE_NAME" },
  { label: 'Đếm NV theo chi nhánh', sql: 'SELECT CHINHANH, COUNT(*) AS SoNhanVien\nFROM NhanVien\nGROUP BY CHINHANH\nORDER BY SoNhanVien DESC' },
  { label: 'Bảng lương TOP 10', sql: 'SELECT TOP 10\n  cc.IDNV, n.TENNV, b.LUONGCOBAN, b.LUONGTHUCTE, b.THUCNHAN\nFROM BangLuong b\nJOIN BangChamCong cc ON b.IDBC = cc.IDBC\nJOIN NhanVien n ON cc.IDNV = n.IDNV\nORDER BY b.THUCNHAN DESC' },
  { label: 'Cột bảng NhanVien', sql: "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE\nFROM INFORMATION_SCHEMA.COLUMNS\nWHERE TABLE_NAME = 'NhanVien'\nORDER BY ORDINAL_POSITION" },
  { label: 'Hợp đồng lao động', sql: 'SELECT TOP 10\n  h.SODH, n.TENNV, h.NGAYBATDAU, h.NGAYKETTHUC, h.LUONGCOBAN, h.TRANGTHAI\nFROM HopDongNV h\nJOIN NhanVien n ON h.IDNV = n.IDNV\nORDER BY h.NGAYBATDAU DESC' },
  { label: 'Tuyển dụng mở', sql: 'SELECT VITRITD, SOLUONG, LUONGTOITHIEU, LUONGTOIDA, TRANGTHAI\nFROM TuyenDung\nWHERE TRANGTHAI = N\'Đang tuyển\'\nORDER BY SOLUONG DESC' },
  { label: 'Chấm công T1/2024', sql: "SELECT TOP 20\n  cc.IDNV, n.TENNV, cc.THANG, cc.NAM, cc.TONGNGAYLAM, cc.SONGAYNGHI, cc.SOGIOTANGCA\nFROM BangChamCong cc\nJOIN NhanVien n ON cc.IDNV = n.IDNV\nWHERE cc.THANG = 1 AND cc.NAM = 2024" },
  { label: 'Cập nhật Server khác', sql: "-- Ví dụ: Đang ở Node CN1 (Hà Nội), cần sửa dữ liệu nhân viên thuộc Node CN2 (Đà Nẵng)\nUPDATE QLNS_CN2.QuanLyNhanSu.dbo.NhanVien\nSET DIENTHOAI = '0988777666'\nWHERE IDNV = 'NC200001'" },
];

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
| NhanVien | Thông tin nhân viên | Theo CHINHANH |
| BangChamCong | Bảng chấm công | Theo CN nhân viên |
| BangLuong | Bảng lương | Theo CN nhân viên |
| HopDongNV | Hợp đồng lao động | Theo CN |
| TuyenDung | Tuyển dụng | Theo CN |
| ChucVu | Chức vụ (lookup) | Tập trung Master |
| PhongBan | Phòng ban | Master + CN |
| ChiNhanh | Danh sách chi nhánh | Master |
| TrinhDo | Trình độ học vấn | Master |

## 🔗 Cách servers liên lạc

Các node dùng **Linked Server** trong SQL Server để truy vấn chéo:
\`\`\`sql
-- Query từ Master xuống CN1
SELECT * FROM [CN1_SERVER].QuanLyNhanSu.dbo.NhanVien

-- UNION ALL từ tất cả branches
SELECT * FROM NhanVien WHERE CHINHANH = 'CN1'
UNION ALL
SELECT * FROM [CN2_SERVER].QuanLyNhanSu.dbo.NhanVien
UNION ALL
SELECT * FROM [CN3_SERVER].QuanLyNhanSu.dbo.NhanVien
\`\`\`

## 📊 Câu lệnh phân tán mẫu

### 1. Truy vấn toàn cục (Global Query)
\`\`\`sql
-- Đếm nhân viên theo chi nhánh
SELECT CHINHANH, COUNT(*) AS SoNV
FROM NhanVien
GROUP BY CHINHANH
ORDER BY SoNV DESC
\`\`\`

### 2. JOIN phân tán
\`\`\`sql
SELECT n.TENNV, n.EMAIL, cv.TENCV, pb.TENPB
FROM NhanVien n
JOIN ChucVu cv ON n.CHUCVU = cv.IDCV
JOIN PhongBan pb ON n.PHONGBAN = pb.IDPB
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
FROM NhanVien n
JOIN BangChamCong cc ON n.IDNV = cc.IDNV
JOIN BangLuong b ON cc.IDBC = b.IDBC
GROUP BY n.CHINHANH
ORDER BY LuongTB DESC
\`\`\`

### 4. Phân tích tuyển dụng
\`\`\`sql
SELECT 
  t.VITRITD, t.SOLUONG,
  t.SOHOSODATUYEN, t.TRANGTHAI,
  c.TENCNHANH
FROM TuyenDung t
JOIN ChiNhanh c ON t.IDCN = c.IDCN
ORDER BY t.SOLUONG DESC
\`\`\`

## ⚡ Tips SQL Terminal
- **Ctrl+Enter** — Chạy truy vấn nhanh  
- Click tên bảng trong Explorer → chèn vào editor  
- Dùng **"Xem dữ liệu"** (icon table) để preview nhanh 100 dòng  
- **Multi-window** — thêm tab để chạy song song nhiều queries  
- Kéo thanh chia — resize vùng editor/kết quả  
`;

const HISTORY_KEY = 'sql_terminal_history_v2';

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
      <div className="sql-line-numbers">
        {Array.from({ length: lineCount }, (_, i) => i + 1).map(n => (
          <div key={n} className={cn(errorLine === n ? 'error-line' : '')} style={{ minHeight: '1.6em' }}>{n}</div>
        ))}
      </div>
      <textarea
        className="sql-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={lineCount}
        spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off"
        placeholder={"-- Nhập câu lệnh SQL tại đây\n-- Ctrl+Enter để thực thi\nSELECT TOP 10 * FROM NhanVien"}
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
let tabCounter = 1;

function makeTab(node: NodeId = 'master', sql = '', paneId = 0): TabState {
  return {
    id: `tab-${Date.now()}-${tabCounter++}`,
    sql: sql || "SELECT TOP 20\n  IDNV, TENNV, GIOITINH, EMAIL, DIENTHOAI\nFROM NhanVien\nORDER BY TENNV",
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

export default function SqlTerminalPage() {
  const [tabs, setTabs] = useState<TabState[]>([makeTab(undefined, undefined, 0)]);
  const [activeIds, setActiveIds] = useState<{ 0: string | null; 1: string | null }>({ 0: tabs[0].id, 1: null });
  const [schemaNode, setSchemaNode] = useState<NodeId>('master');
  
  const [showExamples, setShowExamples] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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
  }, []);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden', gap: 0 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, flexWrap: 'wrap' }}>
        <Database size={20} className="text-indigo-400" />
        <span style={{ fontWeight: 700, fontSize: 18, color: 'white' }}>SQL Terminal</span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>— Phân tán 4 nodes</span>
        <div style={{ flex: 1 }} />
        {/* Buttons */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowExamples(!showExamples); setShowDocs(false); setShowHistory(false); }} className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 16px' }}>
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
          <button onClick={() => { setShowDocs(!showDocs); setShowExamples(false); setShowHistory(false); }} className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 16px' }}>
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
          <button onClick={() => { setShowHistory(!showHistory); setShowExamples(false); setShowDocs(false); }} className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 16px' }}>
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
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Schema left panel */}
        <div style={{ width: sidebarWidth, flexShrink: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <SchemaPanel
            nodeId={schemaNode}
            onInsertTable={name => {
              const r = activeIds[0] ? 0 : 1;
              const tab = tabs.find(t => t.id === activeIds[r]);
              if (tab) updateTab(tab.id, { sql: (tab.sql ? tab.sql + '\n' : '') + name });
            }}
            onPreviewTable={name => addAndRunTab(`SELECT * FROM ${name}`, undefined, tabs.some(t=>t.paneId===1) ? 1 : 0)}
          />
        </div>
        <div
          onMouseDown={startDragSidebar}
          style={{ width: 4, flexShrink: 0, cursor: 'col-resize', background: 'rgba(255,255,255,0.08)' }}
          className="hover:bg-indigo-500/20 transition-colors"
        />

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
