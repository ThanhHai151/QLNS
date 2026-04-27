import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  color?: 'indigo' | 'green' | 'amber' | 'red' | 'purple';
  trend?: { value: number; label: string };
}

const colorMap = {
  indigo: { bg: 'from-indigo-500/20 to-indigo-600/10', icon: 'bg-indigo-500/20 text-indigo-400', border: 'border-indigo-500/20' },
  green:  { bg: 'from-emerald-500/20 to-emerald-600/10', icon: 'bg-emerald-500/20 text-emerald-400', border: 'border-emerald-500/20' },
  amber:  { bg: 'from-amber-500/20 to-amber-600/10', icon: 'bg-amber-500/20 text-amber-400', border: 'border-amber-500/20' },
  red:    { bg: 'from-red-500/20 to-red-600/10', icon: 'bg-red-500/20 text-red-400', border: 'border-red-500/20' },
  purple: { bg: 'from-purple-500/20 to-purple-600/10', icon: 'bg-purple-500/20 text-purple-400', border: 'border-purple-500/20' },
};

export function StatCard({ title, value, subtitle, icon, color = 'indigo', trend }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border p-6 bg-gradient-to-br',
      c.bg, c.border, 'bg-slate-900/60 backdrop-blur-sm',
      'hover:shadow-lg hover:shadow-black/20 transition-all duration-300 group'
    )}>
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/50 text-sm font-medium">{title}</p>
          <p className="text-white text-3xl font-bold mt-1 tracking-tight">{value}</p>
          {subtitle && <p className="text-white/40 text-xs mt-1">{subtitle}</p>}
          {trend && (
            <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium',
              trend.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              <span className="text-white/30">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', c.icon,
          'group-hover:scale-110 transition-transform duration-300')}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── Branch Distribution Card ─────────────────────────────────
interface BranchBarProps {
  branch: string;
  city: string;
  count: number;
  total: number;
  color: string;
}

export function BranchBar({ branch, city, count, total, color }: BranchBarProps) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 text-xs font-bold font-mono" style={{ color }}>{branch}</div>
      <div className="flex-1">
        <div className="flex justify-between text-xs text-white/50 mb-1">
          <span>{city}</span>
          <span className="font-medium text-white/70">{count} NV ({pct}%)</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}
