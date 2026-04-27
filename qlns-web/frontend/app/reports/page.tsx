'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportApi, salaryApi, employeeApi, formatCurrency, NODE_COLORS } from '@/lib/api';
import { QueryBadge } from '@/components/ui/QueryBadge';
import { BarChart3, Globe, Loader2, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

export default function ReportsPage() {
  const [branch, setBranch] = useState('');
  const [thang, setThang] = useState('');
  const [nam, setNam] = useState('2024');

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['reports', 'global'],
    queryFn: () => reportApi.global().then(r => r.data),
  });

  const { data: salRes } = useQuery({
    queryKey: ['salaries', branch, thang, nam],
    queryFn: () => salaryApi.list({
      branch: branch || undefined,
      thang: thang ? Number(thang) : undefined,
      nam: nam ? Number(nam) : undefined,
    }).then(r => r.data),
  });

  const { data: empRes } = useQuery({
    queryKey: ['employees', branch],
    queryFn: () => employeeApi.list(branch || undefined).then(r => r.data),
  });

  const stats = statsRes?.data;
  const salaries = salRes?.data ?? [];
  const employees = empRes?.data ?? [];

  // Salary by branch
  const salaryByBranch = useMemo(() => {
    return ['CN1', 'CN2', 'CN3'].map(b => {
      const filtered = salaries.filter(s => s.CHINHANH === b);
      const vals = filtered.map(s => Number(s.THUCNHAN) || 0);
      return {
        branch: b,
        avgSalary: vals.length > 0 ? vals.reduce((a, v) => a + v, 0) / vals.length : 0,
        maxSalary: vals.length > 0 ? Math.max(...vals) : 0,
      };
    });
  }, [salaries]);

  // Employee by education
  const eduData = useMemo(() => {
    const eduCount: Record<string, number> = {};
    employees.forEach(e => {
      const key = e.TEN_TRINHDO || e.TRINHDO || 'Khác';
      eduCount[key] = (eduCount[key] || 0) + 1;
    });
    return Object.entries(eduCount).map(([name, value]) => ({ name, value }));
  }, [employees]);

  const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (statsLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-indigo-400" /> Báo Cáo Tổng Hợp
          </h1>
          <p className="text-white/50 text-sm mt-0.5">Dữ liệu tổng hợp từ toàn bộ hệ thống phân tán</p>
        </div>
        {statsRes?.meta && (
          <QueryBadge nodes={statsRes.meta.sourceNodes} executionTimeMs={statsRes.meta.executionTimeMs} queryMode={statsRes.meta.queryMode} />
        )}
      </div>

      {/* Filters (Horizontal Layout) */}
      <div className="flex flex-row items-end gap-4 glass p-4">
        <div>
          <label className="text-white/50 text-xs mb-1.5 block">Chi nhánh</label>
          <select className="input-field !w-56" value={branch} onChange={e => setBranch(e.target.value)}>
            <option value="">Tất cả chi nhánh</option>
            <option value="CN1">CN1 — Hà Nội</option>
            <option value="CN2">CN2 — Đà Nẵng</option>
            <option value="CN3">CN3 — TP.HCM</option>
          </select>
        </div>
        <div>
          <label className="text-white/50 text-xs mb-1.5 block">Tháng</label>
          <select className="input-field !w-40" value={thang} onChange={e => setThang(e.target.value)}>
            <option value="">Tất cả tháng</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
              <option key={m} value={m}>Tháng {m}</option>
            )}
          </select>
        </div>
        <div>
          <label className="text-white/50 text-xs mb-1.5 block">Năm</label>
          <select className="input-field !w-32" value={nam} onChange={e => setNam(e.target.value)}>
            {['2024', '2023', '2022'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats?.byBranch?.map((b, i) => {
          const color = Object.values(NODE_COLORS).slice(1)[i];
          return (
            <div key={b.branch} className="glass p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-white/60 text-sm">{b.branch} — {b.city}</span>
              </div>
              <p className="text-white text-3xl font-bold">{b.count}</p>
              <p className="text-white/40 text-xs mt-1">nhân viên</p>
              <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(b.count / (stats.totalEmployees || 1)) * 100}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Salary comparison */}
        <div className="glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4.5 w-4.5 text-green-400" size={18} />
            <h2 className="text-white font-semibold">Lương TB / Tối đa theo chi nhánh</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={salaryByBranch}>
              <XAxis dataKey="branch" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} width={65}
                tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [formatCurrency(v), '']}
                cursor={{ fill: 'transparent' }}
              />
              <Bar dataKey="avgSalary" name="TB" radius={[4, 4, 0, 0]}>
                {salaryByBranch.map((_, i) => <Cell key={i} fill={Object.values(NODE_COLORS).slice(1)[i]} />)}
              </Bar>
              <Bar dataKey="maxSalary" name="Max" radius={[4, 4, 0, 0]} opacity={0.4}>
                {salaryByBranch.map((_, i) => <Cell key={i} fill={Object.values(NODE_COLORS).slice(1)[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Education pie */}
        <div className="glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4.5 w-4.5 text-purple-400" size={18} />
            <h2 className="text-white font-semibold">Phân bố trình độ học vấn</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={eduData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                {eduData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend formatter={v => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{v}</span>} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Global totals */}
      <div className="glass p-6">
        <h2 className="text-white font-semibold mb-4">Tổng kết toàn công ty (Global Query)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-white/40 text-xs">Tổng nhân viên</p>
            <p className="text-white text-2xl font-bold mt-1">{stats?.totalEmployees}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Lương TB toàn cty</p>
            <p className="text-white text-2xl font-bold mt-1">{formatCurrency(stats?.avgSalary ?? 0)}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Tổng chi lương</p>
            <p className="text-white text-2xl font-bold mt-1">{formatCurrency(stats?.totalSalaryPaid ?? 0)}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">HĐ có hiệu lực</p>
            <p className="text-white text-2xl font-bold mt-1">{stats?.activeContracts}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
