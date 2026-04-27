'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '@/lib/api';
import { QueryBadge, NodeIndicator } from '@/components/ui/QueryBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Clock3, Loader2 } from 'lucide-react';

export default function AttendancePage() {
  const [branch, setBranch] = useState('');
  const [thang, setThang] = useState('1');
  const [nam, setNam] = useState('2024');
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['attendance', branch, thang, nam],
    queryFn: () => attendanceApi.list({ branch: branch || undefined, thang: Number(thang), nam: Number(nam) }).then(r => r.data),
  });

  const records = res?.data ?? [];

  const columns: Column<any>[] = [
    { key: 'IDBC', title: 'Mã BC', sortable: true, searchable: true, render: (r) => <span className="font-mono text-amber-300 text-xs">{r.IDBC}</span> },
    { key: 'TENNV', title: 'Nhân viên', sortable: true, searchable: true, render: (r) => <span className="font-medium text-white/90">{r.TENNV ?? r.IDNV}</span> },
    { key: 'THANG', title: 'Tháng/Năm', render: (r) => `${r.THANG}/${r.NAM}` },
    { key: 'TONGNGAYLAM', title: 'Ngày làm', sortable: true, render: (r) => (
      <div className="flex items-center gap-2">
        <div className="h-1.5 rounded-full bg-white/10 w-16 overflow-hidden">
          <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.min(100, (r.TONGNGAYLAM / 26) * 100)}%` }} />
        </div>
        <span className="text-white/70 text-xs">{r.TONGNGAYLAM} ngày</span>
      </div>
    )},
    { key: 'SOGIOTANGCA', title: 'Giờ tăng ca', sortable: true, render: (r) => <span className={r.SOGIOTANGCA > 0 ? 'text-amber-400' : 'text-white/40'}>{r.SOGIOTANGCA}h</span> },
    { key: 'SONGAYNGHI', title: 'Ngày nghỉ', sortable: true, render: (r) => <span className={r.SONGAYNGHI > 0 ? 'text-red-400' : 'text-white/40'}>{r.SONGAYNGHI}</span> },
    { key: 'SONGAYDITRE', title: 'Đi trễ', sortable: true, render: (r) => <span className={r.SONGAYDITRE > 0 ? 'text-orange-400' : 'text-white/40'}>{r.SONGAYDITRE}</span> },
    { key: 'TRANGTHAI', title: 'Trạng thái', sortable: true, searchable: true, render: (r) => (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${r.TRANGTHAI === 'Đã duyệt' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
        {r.TRANGTHAI}
      </span>
    )},
    { key: '_sourceNode', title: 'Node', sortable: true, searchable: true, render: (r) => <NodeIndicator nodeId={r._sourceNode} /> },
  ];

  return (
    <div className="h-full flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock3 className="h-6 w-6 text-amber-400" /> Chấm Công
          </h1>
          <p className="text-white/50 text-sm mt-0.5">Bảng chấm công từ các chi nhánh phân tán</p>
        </div>
        {res?.meta && (
          <QueryBadge nodes={res.meta.sourceNodes} executionTimeMs={res.meta.executionTimeMs} queryMode={res.meta.queryMode} />
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-row flex-wrap items-center gap-3 shrink-0 bg-slate-900/50 p-3 rounded-xl border border-white/5">
        <select className="input-field !w-44" value={branch} onChange={e => setBranch(e.target.value)}>
          <option value="">Tất cả chi nhánh</option>
          <option value="CN1">CN1 — Hà Nội</option>
          <option value="CN2">CN2 — Đà Nẵng</option>
          <option value="CN3">CN3 — TP.HCM</option>
        </select>
        <select className="input-field !w-32" value={thang} onChange={e => setThang(e.target.value)}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
            <option key={m} value={m}>Tháng {m}</option>
          )}
        </select>
        <select className="input-field !w-28" value={nam} onChange={e => setNam(e.target.value)}>
          {['2024', '2023'].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        
        <div className="relative ml-auto flex items-center w-64">
          <input
            className="input-field px-4 w-full"
            placeholder="Tìm kiếm nhân viên, mã BC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="ml-auto flex items-center">
          <span className="text-white/30 text-sm whitespace-nowrap">{records.length} bản ghi</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="glass flex justify-center h-40 items-center"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>
        ) : (
          <DataTable 
            columns={columns} 
            data={records} 
            globalSearch={search}
          />
        )}
      </div>
    </div>
  );
}
