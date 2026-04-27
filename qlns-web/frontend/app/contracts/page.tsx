'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contractApi, formatDate, formatCurrency } from '@/lib/api';
import { QueryBadge, NodeIndicator } from '@/components/ui/QueryBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { FileText, Loader2 } from 'lucide-react';

export default function ContractsPage() {
  const [branch, setBranch] = useState('');
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['contracts', branch],
    queryFn: () => contractApi.list(branch || undefined).then(r => r.data),
  });

  const contracts = res?.data ?? [];

  const columns: Column<any>[] = [
    { key: 'SODH', title: 'Số HĐ', sortable: true, searchable: true, render: (r) => <span className="font-mono text-blue-300 text-xs">{r.SODH}</span> },
    { key: 'TENNV', title: 'Nhân viên', sortable: true, searchable: true, render: (r) => <span className="font-medium text-white/90">{r.TENNV}</span> },
    { key: 'TEN_LOAIHD', title: 'Loại HĐ', sortable: true, searchable: true, render: (r) => <span className="text-white/60 text-xs">{r.TEN_LOAIHD}</span> },
    { key: 'NGAYKY', title: 'Ngày ký', sortable: true, render: (r) => <span className="text-white/60 text-xs">{formatDate(r.NGAYKY)}</span> },
    { key: 'NGAYBATDAU', title: 'Bắt đầu', sortable: true, render: (r) => <span className="text-white/60 text-xs">{formatDate(r.NGAYBATDAU)}</span> },
    { key: 'NGAYKETTHUC', title: 'Kết thúc', sortable: true, render: (r) => <span className="text-white/60 text-xs">{r.NGAYKETTHUC ? formatDate(r.NGAYKETTHUC) : '∞ Vô thời hạn'}</span> },
    { key: 'LUONGCOBAN', title: 'Lương CB', sortable: true, render: (r) => <span className="text-white/70">{formatCurrency(Number(r.LUONGCOBAN))}</span> },
    { key: 'TRANGTHAI', title: 'Trạng thái', sortable: true, searchable: true, render: (r) => (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${r.TRANGTHAI === 'Có hiệu lực' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
        {r.TRANGTHAI}
      </span>
    )},
    { key: '_sourceNode', title: 'Node', sortable: true, searchable: true, render: (r) => <NodeIndicator nodeId={r._sourceNode} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-400" /> Hợp Đồng Lao Động
          </h1>
          <p className="text-white/50 text-sm mt-0.5">Hợp đồng từ các chi nhánh phân tán</p>
        </div>
        {res?.meta && (
          <QueryBadge nodes={res.meta.sourceNodes} executionTimeMs={res.meta.executionTimeMs} queryMode={res.meta.queryMode} />
        )}
      </div>

      <div className="flex flex-row flex-wrap items-center gap-3 shrink-0 bg-slate-900/50 p-3 rounded-xl border border-white/5">
        <select className="input-field !w-52" value={branch} onChange={e => setBranch(e.target.value)}>
          <option value="">Tất cả chi nhánh</option>
          <option value="CN1">CN1 — Hà Nội</option>
          <option value="CN2">CN2 — Đà Nẵng</option>
          <option value="CN3">CN3 — TP.HCM</option>
        </select>
        
        <div className="relative ml-auto flex items-center w-64">
          <input
            className="input-field px-4 w-full"
            placeholder="Tìm kiếm nhân viên, mã HĐ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="ml-auto flex items-center">
          <span className="text-white/30 text-sm whitespace-nowrap">{contracts.length} hợp đồng</span>
        </div>
      </div>

      <div className="w-full">
        {isLoading ? (
          <div className="glass flex justify-center h-40 items-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
        ) : (
          <DataTable 
            columns={columns} 
            data={contracts} 
            globalSearch={search}
          />
        )}
      </div>
    </div>
  );
}
