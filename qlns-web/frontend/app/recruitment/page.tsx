'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recruitmentApi, formatDate, formatCurrency, NODE_COLORS } from '@/lib/api';
import { QueryBadge, NodeIndicator } from '@/components/ui/QueryBadge';
import { Briefcase, Loader2, Plus, Pencil, Trash2, X } from 'lucide-react';

function RecruitmentModal({
  recruitment, onClose, onSave,
}: {
  recruitment?: any; onClose: () => void; onSave: (data: any) => void;
}) {
  const isEdit = !!recruitment;
  const [form, setForm] = useState({
    MATD: recruitment?.MATD ?? '',
    IDCN: recruitment?.IDCN ?? 'CN1',
    VITRITD: recruitment?.VITRITD ?? '',
    DOTUOI: recruitment?.DOTUOI ?? 18,
    GIOITINH: recruitment?.GIOITINH ?? 'Không yêu cầu',
    SOLUONG: recruitment?.SOLUONG ?? 1,
    HANTD: recruitment?.HANTD ? new Date(recruitment.HANTD).toISOString().split('T')[0] : '',
    LUONGTOITHIEU: recruitment?.LUONGTOITHIEU ?? 0,
    LUONGTOIDA: recruitment?.LUONGTOIDA ?? 0,
    TRANGTHAI: recruitment?.TRANGTHAI ?? 'Đang tuyển',
    SOHOSODANAOP: recruitment?.SOHOSODANAOP ?? 0,
    SOHOSODATUYEN: recruitment?.SOHOSODATUYEN ?? 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass rounded-2xl border border-white/15 shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/90 backdrop-blur-sm z-10">
          <h3 className="text-white font-semibold">{isEdit ? 'Chỉnh sửa đợt tuyển dụng' : 'Thêm đợt tuyển dụng mới'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {!isEdit && (
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Mã tuyển dụng *</label>
                <input name="MATD" value={form.MATD} onChange={handleChange} placeholder="VD: TD001" className="input-field" />
              </div>
            )}
            <div className={isEdit ? 'col-span-2' : ''}>
              <label className="text-white/60 text-xs mb-1.5 block">Vị trí tuyển dụng *</label>
              <input name="VITRITD" value={form.VITRITD} onChange={handleChange} placeholder="Nhân viên IT" className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Chi nhánh</label>
              <select name="IDCN" value={form.IDCN} onChange={handleChange} disabled={isEdit} className="input-field disabled:opacity-50">
                <option value="CN1">CN1 — Hà Nội</option>
                <option value="CN2">CN2 — Đà Nẵng</option>
                <option value="CN3">CN3 — TP.HCM</option>
              </select>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Trạng thái</label>
              <select name="TRANGTHAI" value={form.TRANGTHAI} onChange={handleChange} className="input-field">
                <option value="Đang tuyển">Đang tuyển</option>
                <option value="Đã kết thúc">Đã kết thúc</option>
                <option value="Tạm hoãn">Tạm hoãn</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Số lượng</label>
              <input type="number" name="SOLUONG" value={form.SOLUONG} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Hạn nộp hồ sơ</label>
              <input type="date" name="HANTD" value={form.HANTD} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Giới tính</label>
              <select name="GIOITINH" value={form.GIOITINH} onChange={handleChange} className="input-field">
                <option>Không yêu cầu</option><option>Nam</option><option>Nữ</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Lương tối thiểu</label>
              <input type="number" name="LUONGTOITHIEU" value={form.LUONGTOITHIEU} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Lương tối đa</label>
              <input type="number" name="LUONGTOIDA" value={form.LUONGTOIDA} onChange={handleChange} className="input-field" />
            </div>
          </div>

          {isEdit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Đã nộp</label>
                <input type="number" name="SOHOSODANAOP" value={form.SOHOSODANAOP} onChange={handleChange} className="input-field" />
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Đã tuyển</label>
                <input type="number" name="SOHOSODATUYEN" value={form.SOHOSODATUYEN} onChange={handleChange} className="input-field" />
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/90 backdrop-blur-sm">
          <button onClick={onClose} className="btn btn-secondary flex-1">Hủy</button>
          <button onClick={() => onSave({
            ...form,
            DOTUOI: Number(form.DOTUOI),
            SOLUONG: Number(form.SOLUONG),
            LUONGTOITHIEU: Number(form.LUONGTOITHIEU),
            LUONGTOIDA: Number(form.LUONGTOIDA),
            SOHOSODANAOP: Number(form.SOHOSODANAOP),
            SOHOSODATUYEN: Number(form.SOHOSODATUYEN),
          })} className="btn btn-primary flex-1">
            {isEdit ? 'Lưu thay đổi' : 'Tạo đợt tuyển (Phân tán)'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecruitmentPage() {
  const qc = useQueryClient();
  const [branch, setBranch] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editRec, setEditRec] = useState<any>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['recruitment', branch],
    queryFn: () => recruitmentApi.list(branch || undefined).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => recruitmentApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitment'] }); qc.invalidateQueries({ queryKey: ['reports', 'global'] }); setShowModal(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => recruitmentApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitment'] }); qc.invalidateQueries({ queryKey: ['reports', 'global'] }); setEditRec(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => recruitmentApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recruitment'] }); qc.invalidateQueries({ queryKey: ['reports', 'global'] }); },
  });

  const records = res?.data ?? [];
  const filteredRecords = search 
    ? records.filter((r: any) => 
        (r.VITRITD && r.VITRITD.toLowerCase().includes(search.toLowerCase())) || 
        (r.MATD && r.MATD.toLowerCase().includes(search.toLowerCase()))
      )
    : records;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-purple-400" /> Tuyển Dụng
          </h1>
          <p className="text-white/50 text-sm mt-0.5">CRUD tuyển dụng trên môi trường phân tán</p>
        </div>
        <div className="flex items-center gap-3">
          {res?.meta && (
            <QueryBadge nodes={res.meta.sourceNodes} executionTimeMs={res.meta.executionTimeMs} queryMode={res.meta.queryMode} />
          )}
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" /> Thêm đợt tuyển
          </button>
        </div>
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
            placeholder="Tìm mã, vị trí tuyển dụng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass p-5 h-40 skeleton" />
          ))
        ) : filteredRecords.map((r: any) => {
          const branchColor = r.IDCN === 'CN1' ? NODE_COLORS.cn1 : r.IDCN === 'CN2' ? NODE_COLORS.cn2 : NODE_COLORS.cn3;
          const fillRate = r.SOLUONG > 0 ? Math.round((r.SOHOSODATUYEN / r.SOLUONG) * 100) : 0;

          return (
            <div key={r.MATD} className="glass p-6 hover:border-white/20 transition-colors relative group">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-slate-900/80 p-1 rounded-lg backdrop-blur z-10 border border-white/10">
                <button
                  onClick={() => setEditRec(r)}
                  className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  title="Chỉnh sửa"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => { if (confirm(`Xóa đợt tuyển ${r.MATD}?`)) deleteMut.mutate(r.MATD); }}
                  className="p-1.5 rounded-md hover:bg-red-500/20 text-red-400/70 hover:text-red-400 transition-colors"
                  title="Xóa"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex-1 pr-14">
                  <h3 className="text-white font-semibold">{r.VITRITD}</h3>
                  <p className="text-white/50 text-xs mt-0.5">{r.TEN_CHINHANH || r.IDCN}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${r.TRANGTHAI === 'Đang tuyển' ? 'bg-green-500/15 text-green-400' : 'bg-white/10 text-white/50'}`}>
                  {r.TRANGTHAI}
                </span>
              </div>

              <div className="space-y-2 text-xs text-white/60 mt-4">
                <div className="flex justify-between">
                  <span>Số lượng cần</span>
                  <span className="text-white/80 font-medium">{r.SOLUONG} người</span>
                </div>
                <div className="flex justify-between">
                  <span>Lương</span>
                  <span className="text-white/80">{formatCurrency(r.LUONGTOITHIEU)} – {formatCurrency(r.LUONGTOIDA)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hạn nộp</span>
                  <span className="text-white/80">{formatDate(r.HANTD)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hồ sơ nộp / đã tuyển</span>
                  <span className="text-white/80">{r.SOHOSODANAOP} / {r.SOHOSODATUYEN}</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${fillRate}%`, backgroundColor: branchColor }} />
                </div>
                <div className="flex justify-between mt-2">
                  <NodeIndicator nodeId={r._sourceNode} label={r.IDCN} />
                  <span className="text-white/30 text-[10px]">Đã tuyển {fillRate}%</span>
                </div>
              </div>
            </div>
          );
        })}
        {!isLoading && filteredRecords.length === 0 && (
          <div className="col-span-1 md:col-span-2 xl:col-span-3 pb-6 text-center text-white/30 py-16 border border-dashed border-white/10 rounded-2xl">
            Không có đợt tuyển dụng nào
          </div>
        )}
      </div>

      {showModal && (
        <RecruitmentModal
          onClose={() => setShowModal(false)}
          onSave={(data) => createMut.mutate(data)}
        />
      )}
      {editRec && (
        <RecruitmentModal
          recruitment={editRec}
          onClose={() => setEditRec(null)}
          onSave={(data) => updateMut.mutate({ id: editRec.MATD, data })}
        />
      )}
    </div>
  );
}
