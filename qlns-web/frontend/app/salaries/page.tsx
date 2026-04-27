'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { salaryApi, formatCurrency } from '@/lib/api';
import { QueryBadge, NodeIndicator } from '@/components/ui/QueryBadge';
import { Banknote, Loader2 } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';

export default function SalariesPage() {
  const [branch, setBranch] = useState('');
  const [thang, setThang] = useState('');
  const [nam, setNam] = useState('2024');
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['salaries', branch, thang, nam],
    queryFn: () => salaryApi.list({
      branch: branch || undefined,
      thang: thang ? Number(thang) : undefined,
      nam: nam ? Number(nam) : undefined,
    }).then(r => r.data),
  });

  const salaries = res?.data ?? [];

  const columns: Column<any>[] = [
    { key: 'IDBC', title: 'Mã BC', sortable: true, searchable: true, render: (s) => <span className="font-mono text-amber-300 text-xs">{s.IDBC}</span> },
    { key: 'TENNV', title: 'Nhân viên', sortable: true, searchable: true, render: (s) => <span className="font-medium text-white/90">{s.TENNV ?? s.IDNV ?? '—'}</span> },
    { key: 'THANG', title: 'Tháng/Năm', render: (s) => <span className="text-white/60">{s.THANG}/{s.NAM}</span> },
    { key: 'LUONGCOBAN', title: 'Lương CB', sortable: true, render: (s) => <span className="text-white/70">{formatCurrency(Number(s.LUONGCOBAN))}</span> },
    { key: 'PHUCAPCHUCVU', title: 'Phụ cấp CV', sortable: true, render: (s) => <span className="text-white/70">{formatCurrency(Number(s.PHUCAPCHUCVU))}</span> },
    { key: 'LUONGTHUONG', title: 'Thưởng', sortable: true, render: (s) => <span className="text-white/70">{formatCurrency(Number(s.LUONGTHUONG))}</span> },
    { key: 'KHOANTRUBAOHIEM', title: 'Khấu trừ BH', sortable: true, render: (s) => <span className="text-red-400">-{formatCurrency(Number(s.KHOANTRUBAOHIEM))}</span> },
    { key: 'THUCNHAN', title: 'Thực nhận', sortable: true, render: (s) => <span className="text-green-400 font-bold">{formatCurrency(Number(s.THUCNHAN))}</span> },
    { key: 'CHINHANH', title: 'Node nguồn', searchable: true, render: (s) => <NodeIndicator nodeId={s._sourceNode} label={s.CHINHANH || s._sourceNode?.toUpperCase()} /> },
  ];

  return (
    <div className="h-full flex flex-col gap-5">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Banknote className="h-6 w-6 text-green-400" /> Bảng Lương
          </h1>
          <p className="text-white/50 text-sm mt-0.5">Truy vấn lương từ đúng server chi nhánh</p>
        </div>
        {res?.meta && (
          <QueryBadge nodes={res.meta.sourceNodes} executionTimeMs={res.meta.executionTimeMs} queryMode={res.meta.queryMode} />
        )}
      </div>

      {/* Filters (Horizontal Layout) */}
      <div className="flex flex-row flex-wrap items-center gap-3 shrink-0 bg-slate-900/50 p-3 rounded-xl border border-white/5">
        <select className="input-field !w-44" value={branch} onChange={e => setBranch(e.target.value)}>
          <option value="">Tất cả chi nhánh</option>
          <option value="CN1">CN1 — Hà Nội</option>
          <option value="CN2">CN2 — Đà Nẵng</option>
          <option value="CN3">CN3 — TP.HCM</option>
        </select>
        <select className="input-field !w-32" value={thang} onChange={e => setThang(e.target.value)}>
          <option value="">Tất cả tháng</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
            <option key={m} value={m}>Tháng {m}</option>
          )}
        </select>
        <select className="input-field !w-28" value={nam} onChange={e => setNam(e.target.value)}>
          {['2024', '2023', '2022'].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        
        <div className="relative ml-auto flex items-center w-64">
          <input
            className="input-field px-4 w-full"
            placeholder="Tìm kiếm nhân viên, mã BC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center">
          <span className="text-white/30 text-sm whitespace-nowrap">{salaries.length} bản ghi</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center h-40 items-center"><Loader2 className="h-6 w-6 animate-spin text-green-400" /></div>
        ) : (
          <DataTable 
            columns={columns} 
            data={salaries} 
            globalSearch={search}
          />
        )}
      </div>
    </div>
  );
}
