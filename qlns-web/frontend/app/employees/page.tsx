'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi, lookupApi, NodeId, NODE_COLORS, NODE_LABELS, formatDate } from '@/lib/api';
import { QueryBadge, NodeIndicator } from '@/components/ui/QueryBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import {
  Users, Plus, Search, Filter, Pencil, Trash2, X, Loader2, ChevronDown,
} from 'lucide-react';

const BRANCHES = [
  { value: '', label: 'Tất cả chi nhánh' },
  { value: 'CN1', label: 'CN1 — Hà Nội' },
  { value: 'CN2', label: 'CN2 — Đà Nẵng' },
  { value: 'CN3', label: 'CN3 — TP.HCM' },
];

function EmployeeModal({
  employee, lookups, onClose, onSave,
}: {
  employee?: any; lookups: any; onClose: () => void; onSave: (data: any) => void;
}) {
  const isEdit = !!employee;
  const [form, setForm] = useState({
    IDNV: employee?.IDNV ?? '',
    TENNV: employee?.TENNV ?? '',
    GIOITINH: employee?.GIOITINH ?? 'Nam',
    NGAYSINH: employee?.NGAYSINH ? new Date(employee.NGAYSINH).toISOString().split('T')[0] : '',
    CCCD: employee?.CCCD ?? '',
    EMAIL: employee?.EMAIL ?? '',
    DIENTHOAI: employee?.DIENTHOAI ?? '',
    DIACHI: employee?.DIACHI ?? '',
    HONNHAN: employee?.HONNHAN ?? 'Độc thân',
    TRINHDO: employee?.TRINHDO ?? '',
    CHUCVU: employee?.CHUCVU ?? '',
    PHONGBAN: employee?.PHONGBAN ?? '',
    CHINHANH: employee?.CHINHANH ?? 'CN1',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass rounded-2xl border border-white/15 shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/90 backdrop-blur-sm z-10">
          <h3 className="text-white font-semibold">{isEdit ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {!isEdit && (
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Mã NV *</label>
                <input name="IDNV" value={form.IDNV} onChange={handleChange} placeholder="VD: NV013" className="input-field" />
              </div>
            )}
            <div className={isEdit ? 'col-span-2' : ''}>
              <label className="text-white/60 text-xs mb-1.5 block">Họ và tên *</label>
              <input name="TENNV" value={form.TENNV} onChange={handleChange} placeholder="Nguyễn Văn A" className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Giới tính</label>
              <select name="GIOITINH" value={form.GIOITINH} onChange={handleChange} className="input-field">
                <option>Nam</option><option>Nữ</option><option>Khác</option>
              </select>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Ngày sinh</label>
              <input type="date" name="NGAYSINH" value={form.NGAYSINH} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Hôn nhân</label>
              <select name="HONNHAN" value={form.HONNHAN} onChange={handleChange} className="input-field">
                <option>Độc thân</option><option>Đã kết hôn</option><option>Ly hôn</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Email *</label>
              <input name="EMAIL" value={form.EMAIL} onChange={handleChange} placeholder="email@example.com" className="input-field" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Điện thoại</label>
              <input name="DIENTHOAI" value={form.DIENTHOAI} onChange={handleChange} placeholder="0901234567" className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">CCCD</label>
              <input name="CCCD" value={form.CCCD} onChange={handleChange} placeholder="012345678901" className="input-field" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Địa chỉ</label>
              <input name="DIACHI" value={form.DIACHI} onChange={handleChange} placeholder="123 Đường ABC, HN" className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Trình độ *</label>
              <select name="TRINHDO" value={form.TRINHDO} onChange={handleChange} className="input-field">
                <option value="">-- Chọn --</option>
                {lookups?.educations?.map((e: any) => (
                  <option key={e.IDTD} value={e.IDTD}>{e.TENTD} — {e.CHUYENNGANH}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Chức vụ *</label>
              <select name="CHUCVU" value={form.CHUCVU} onChange={handleChange} className="input-field">
                <option value="">-- Chọn --</option>
                {lookups?.positions?.map((p: any) => (
                  <option key={p.IDCV} value={p.IDCV}>{p.TENCV}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Phòng ban *</label>
              <select name="PHONGBAN" value={form.PHONGBAN} onChange={handleChange} className="input-field">
                <option value="">-- Chọn --</option>
                {lookups?.departments?.map((d: any) => (
                  <option key={d.IDPB} value={d.IDPB}>{d.TENPB}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">
                Chi nhánh {!isEdit && <span className="text-amber-400">(server lưu trữ)</span>}
              </label>
              <select name="CHINHANH" value={form.CHINHANH} onChange={handleChange} disabled={isEdit} className="input-field disabled:opacity-50">
                <option value="CN1">CN1 — Hà Nội</option>
                <option value="CN2">CN2 — Đà Nẵng</option>
                <option value="CN3">CN3 — TP.HCM</option>
              </select>
              {!isEdit && <p className="text-white/30 text-[10px] mt-1">NV sẽ được lưu vào server {form.CHINHANH}</p>}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/90 backdrop-blur-sm">
          <button onClick={onClose} className="btn btn-secondary flex-1">Hủy</button>
          <button onClick={() => onSave(form)} className="btn btn-primary flex-1">
            {isEdit ? 'Lưu thay đổi' : 'Thêm nhân viên (Phân tán)'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [branch, setBranch] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editEmp, setEditEmp] = useState<any>(null);

  const { data: res, isLoading, error } = useQuery({
    queryKey: ['employees', branch],
    queryFn: () => employeeApi.list(branch || undefined).then((r) => r.data),
  });

  const { data: edRes } = useQuery({ queryKey: ['lookups-edu'], queryFn: () => lookupApi.educations().then(r => r.data.data) });
  const { data: posRes } = useQuery({ queryKey: ['lookups-pos'], queryFn: () => lookupApi.positions().then(r => r.data.data) });
  const { data: deptRes } = useQuery({ queryKey: ['lookups-dept'], queryFn: () => lookupApi.departments().then(r => r.data.data) });
  const lookups = { educations: edRes, positions: posRes, departments: deptRes };

  const createMut = useMutation({
    mutationFn: (data: any) => employeeApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['reports', 'global'] }); setShowModal(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => employeeApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['reports', 'global'] }); setEditEmp(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => employeeApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['reports', 'global'] }); },
  });

  const employees = res?.data ?? [];
  const filtered = branch ? employees.filter(e => e.CHINHANH?.trim() === branch) : employees;
  
  const columns: Column<any>[] = [
    { key: 'IDNV', title: 'Mã NV', sortable: true, searchable: true, render: (r) => <span className="font-mono text-indigo-300 text-xs">{r.IDNV}</span> },
    { key: 'TENNV', title: 'Họ tên', sortable: true, searchable: true, render: (r) => (
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          {r.TENNV?.charAt(0)}
        </div>
        <span className="font-medium text-white/90">{r.TENNV}</span>
      </div>
    ) },
    { key: 'GIOITINH', title: 'Giới tính', sortable: true, searchable: true, render: (r) => <span className="text-white/60">{r.GIOITINH}</span> },
    { key: 'EMAIL', title: 'Email', sortable: true, searchable: true, render: (r) => <span className="text-white/60 text-xs">{r.EMAIL}</span> },
    { key: 'DIENTHOAI', title: 'Điện thoại', sortable: true, searchable: true, render: (r) => <span className="text-white/60 text-xs">{r.DIENTHOAI}</span> },
    { key: 'TEN_CHUCVU', title: 'Chức vụ', sortable: true, searchable: true, render: (r) => <span className="text-white/70 text-xs">{r.TEN_CHUCVU || r.CHUCVU}</span> },
    { key: 'TEN_PHONGBAN', title: 'Phòng ban', sortable: true, searchable: true, render: (r) => <span className="text-white/60 text-xs">{r.TEN_PHONGBAN || r.PHONGBAN}</span> },
    { key: 'CHINHANH', title: 'Chi nhánh', sortable: true, searchable: true, render: (r) => (
      <NodeIndicator
        nodeId={r.CHINHANH === 'CN1' ? 'cn1' : r.CHINHANH === 'CN2' ? 'cn2' : 'cn3'}
        label={r.TEN_CHINHANH || r.CHINHANH}
      />
    ) },
    { key: 'actions', title: 'Thao tác', render: (emp) => (
        <div className="flex gap-1">
          <button onClick={() => setEditEmp(emp)} className="action-btn action-btn-edit" title="Chỉnh sửa"><Pencil size={16} /></button>
          <button onClick={() => { if (confirm(`Xóa ${emp.TENNV}?`)) deleteMut.mutate(emp.IDNV); }} className="action-btn action-btn-delete" title="Xóa"><Trash2 size={16} /></button>
        </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-400" />
            Quản lý Nhân viên
          </h1>
          <p className="text-white/50 text-sm mt-0.5">CRUD phân tán — ghi vào đúng server chi nhánh</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus className="h-4 w-4" /> Thêm nhân viên
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center bg-slate-900/50 p-3 rounded-xl border border-white/5">
        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <select className="input-field pl-10 pr-8 !w-52" value={branch} onChange={e => setBranch(e.target.value)}>
            {BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
        <div className="relative ml-auto flex items-center gap-3">
          <span className="text-white/30 text-sm whitespace-nowrap">{filtered.length} nhân viên</span>
          <input
            className="input-field px-4 w-64"
            placeholder="Tìm kiếm nhân viên (Tên, Mã NV, Email...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {res?.meta && (
          <div>
            <QueryBadge nodes={res.meta.sourceNodes} executionTimeMs={res.meta.executionTimeMs} queryMode={res.meta.queryMode} />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="w-full">
        {isLoading ? (
          <div className="glass flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : error ? (
          <div className="glass p-6 text-center text-red-400 text-sm">Lỗi kết nối backend API</div>
        ) : (
          <DataTable 
            columns={columns} 
            data={filtered} 
            globalSearch={search}
          />
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <EmployeeModal
          lookups={lookups}
          onClose={() => setShowModal(false)}
          onSave={(data) => createMut.mutate(data)}
        />
      )}
      {editEmp && (
        <EmployeeModal
          employee={editEmp}
          lookups={lookups}
          onClose={() => setEditEmp(null)}
          onSave={(data) => updateMut.mutate({ id: editEmp.IDNV, data })}
        />
      )}
    </div>
  );
}
