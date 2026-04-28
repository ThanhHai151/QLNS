'use client';

import { useQuery } from '@tanstack/react-query';
import { reportApi, employeeApi, NODE_COLORS, formatCurrency } from '@/lib/api';
import { StatCard, BranchBar } from '@/components/ui/StatCard';
import { QueryBadge } from '@/components/ui/QueryBadge';
import { useAuth } from '@/lib/auth';
import {
  Users, Banknote, FileText, Briefcase,
  TrendingUp, Globe, AlertCircle, Loader2, Building2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

export default function DashboardPage() {
  const { user, isMaster } = useAuth();
  const { data: statsRes, isLoading: statsLoading, error: statsErr } = useQuery({
    queryKey: ['reports', 'global'],
    queryFn: () => reportApi.global().then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: empRes, isLoading: empLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.list().then((r) => r.data),
  });

  const stats = statsRes?.data;
  const employees = empRes?.data ?? [];
  const isLoading = statsLoading || empLoading;

  const BRANCH_COLORS_MAP: Record<string, string> = {
    cn1: '#10b981', cn2: '#f59e0b', cn3: '#ef4444',
  };
  const branchColor = user?.nodeId ? BRANCH_COLORS_MAP[user.nodeId] ?? '#6366f1' : '#6366f1';


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400 mx-auto mb-3" />
          <p className="text-white/50 text-sm">Đang tải dữ liệu từ các nodes...</p>
        </div>
      </div>
    );
  }

  if (statsErr) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
        <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
        <p className="text-red-300 text-sm">Không thể kết nối tới backend API. Đảm bảo backend đang chạy tại port 4000.</p>
      </div>
    );
  }

  const branchChartData = stats?.byBranch?.map(b => ({
    name: b.branch, count: b.count, city: b.city,
  })) ?? [];

  // Gender distribution
  const genderData = [
    { name: 'Nam', value: employees.filter(e => e.GIOITINH === 'Nam').length },
    { name: 'Nữ', value: employees.filter(e => e.GIOITINH === 'Nữ').length },
    { name: 'Khác', value: employees.filter(e => e.GIOITINH !== 'Nam' && e.GIOITINH !== 'Nữ').length },
  ].filter(d => d.value > 0);

  const PIE_COLORS = ['#6366f1', '#ec4899', '#10b981'];

  return (
    <div className="space-y-7 p-4 md:p-6 bg-slate-900/40 rounded-2xl border border-white/5 mx-2 md:mx-4 mt-2">
      {/* Branch banner — shown only for branch accounts */}
      {!isMaster && user && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{
            backgroundColor: `${branchColor}12`,
            borderColor: `${branchColor}35`,
          }}
        >
          <Building2 className="h-5 w-5 flex-shrink-0" style={{ color: branchColor }} />
          <div>
            <p className="text-white/80 text-sm font-semibold">
              Đang xem: <span style={{ color: branchColor }}>{user.branchLabel}</span>
            </p>
            <p className="text-white/35 text-xs">Dữ liệu được lọc theo chi nhánh của bạn</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isMaster ? 'Dashboard Tổng Quan' : `Dashboard — ${user?.branchLabel}`}
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {isMaster
              ? 'Dữ liệu tổng hợp từ tất cả chi nhánh phân tán'
              : 'Dữ liệu nhân sự của chi nhánh bạn quản lý'}
          </p>
        </div>
        {statsRes?.meta && (
          <QueryBadge
            nodes={statsRes.meta.sourceNodes}
            executionTimeMs={statsRes.meta.executionTimeMs}
            queryMode={statsRes.meta.queryMode}
          />
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Tổng nhân viên"
          value={stats?.totalEmployees ?? 0}
          subtitle="Từ tất cả chi nhánh"
          icon={<Users className="h-6 w-6" />}
          color="indigo"
        />
        <StatCard
          title="Lương TB/tháng"
          value={formatCurrency(stats?.avgSalary ?? 0)}
          subtitle="Trung bình toàn công ty"
          icon={<Banknote className="h-6 w-6" />}
          color="green"
        />
        <StatCard
          title="Hợp đồng HLực"
          value={stats?.activeContracts ?? 0}
          subtitle="Đang có hiệu lực"
          icon={<FileText className="h-6 w-6" />}
          color="amber"
        />
        <StatCard
          title="Tuyển dụng mở"
          value={stats?.openRecruitments ?? 0}
          subtitle="Vị trí đang tuyển"
          icon={<Briefcase className="h-6 w-6" />}
          color="purple"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Bar chart: employees by branch */}
        <div className="xl:col-span-2 glass p-6">
          <div className="flex items-center gap-2 mb-5">
            <Globe className="h-4.5 w-4.5 text-indigo-400" size={18} />
            <h2 className="text-white font-semibold">Phân bố nhân viên theo chi nhánh</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={branchChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 12 }} width={30} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
                itemStyle={{ color: 'rgba(255,255,255,0.6)' }}
                cursor={{ fill: 'transparent' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {branchChartData.map((_, i) => (
                  <Cell key={i} fill={Object.values(NODE_COLORS).slice(1)[i % 3]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Branch bars */}
          <div className="space-y-3 mt-5">
            {stats?.byBranch?.map((b, i) => (
              <BranchBar
                key={b.branch}
                branch={b.branch}
                city={b.city}
                count={b.count}
                total={stats.totalEmployees}
                color={Object.values(NODE_COLORS).slice(1)[i % 3]}
              />
            ))}
          </div>
        </div>

        {/* Pie chart: gender */}
        <div className="glass p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-4.5 w-4.5 text-purple-400" size={18} />
            <h2 className="text-white font-semibold">Giới tính</h2>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={genderData}
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={80}
                dataKey="value"
              >
                {genderData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend
                formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{value}</span>}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Recent employees */}
          <div className="mt-4">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-3">NV gần đây</p>
            <div className="space-y-2">
              {employees.slice(0, 4).map((emp) => (
                <div key={emp.IDNV} className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {emp.TENNV?.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-xs font-medium truncate">{emp.TENNV}</p>
                    <p className="text-white/30 text-[10px]">{emp.TEN_CHUCVU || emp.CHUCVU}</p>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      color: emp.CHINHANH === 'CN1' ? NODE_COLORS.cn1 : emp.CHINHANH === 'CN2' ? NODE_COLORS.cn2 : NODE_COLORS.cn3,
                      background: `${emp.CHINHANH === 'CN1' ? NODE_COLORS.cn1 : emp.CHINHANH === 'CN2' ? NODE_COLORS.cn2 : NODE_COLORS.cn3}20`,
                    }}>
                    {emp.CHINHANH}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System info */}
      <div className="glass p-5">
        <h3 className="text-white/60 text-xs uppercase tracking-wide mb-3 font-semibold">Kiến trúc phân tán</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Master', desc: 'localhost:1432', color: NODE_COLORS.master },
            { label: 'CN1 — Hà Nội', desc: 'localhost:1437', color: NODE_COLORS.cn1 },
            { label: 'CN2 — Đà Nẵng', desc: 'localhost:1435', color: NODE_COLORS.cn2 },
            { label: 'CN3 — TP.HCM', desc: 'localhost:1436', color: NODE_COLORS.cn3 },
          ].map((n) => (
            <div key={n.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="h-2 w-2 rounded-full mx-auto mb-2" style={{ backgroundColor: n.color }} />
              <p className="text-white/70 text-xs font-medium">{n.label}</p>
              <p className="text-white/30 text-[10px] font-mono mt-0.5">{n.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
