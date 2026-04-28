'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Banknote, Clock3, FileText,
  BarChart3, Server, Briefcase, ChevronLeft, ChevronRight,
  Building2, Database, LogOut, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './SidebarContext';
import { useAuth } from '@/lib/auth';

// ── Navigation items ───────────────────────────────────────
// masterOnly: true  → chỉ master thấy
const navItems = [
  { href: '/',            label: 'Dashboard',    icon: LayoutDashboard, masterOnly: false },
  { href: '/employees',   label: 'Nhân viên',    icon: Users,           masterOnly: false },
  { href: '/salaries',    label: 'Bảng lương',   icon: Banknote,        masterOnly: false },
  { href: '/attendance',  label: 'Chấm công',    icon: Clock3,          masterOnly: false },
  { href: '/contracts',   label: 'Hợp đồng',     icon: FileText,        masterOnly: false },
  { href: '/recruitment', label: 'Tuyển dụng',   icon: Briefcase,       masterOnly: false },
  { href: '/reports',     label: 'Báo cáo',      icon: BarChart3,       masterOnly: true  },
  { href: '/system',      label: 'Hệ thống',     icon: Server,          masterOnly: true  },
  { href: '/sql',         label: 'SQL Terminal', icon: Database,        masterOnly: true  },
];

const BRANCH_COLORS: Record<string, string> = {
  master: '#6366f1',
  cn1: '#10b981',
  cn2: '#f59e0b',
  cn3: '#ef4444',
};

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const { user, logout, isMaster } = useAuth();

  const sidebarWidth = collapsed ? 64 : 256;
  const branchColor = user ? (BRANCH_COLORS[user.nodeId] ?? '#6366f1') : '#6366f1';

  // Filter nav items by role
  const visibleNavItems = navItems.filter(item => !item.masterOnly || isMaster);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col sidebar-transition overflow-hidden',
        'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-white/10'
      )}
      style={{ width: sidebarWidth }}
    >
      {/* ── Header: Logo + Collapse button ─────────────────── */}
      <div className={cn(
        'flex items-center flex-shrink-0 border-b border-white/10',
        collapsed ? 'justify-center py-4 px-2' : 'px-4 py-4'
      )}>
        {/* Logo icon always visible */}
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
          <Building2 className="h-5 w-5 text-white" />
        </div>

        {/* Title — only when expanded */}
        {!collapsed && (
          <div className="flex-1 ml-3 overflow-hidden">
            <p className="text-white font-bold text-sm leading-tight whitespace-nowrap">QLNS Phân Tán</p>
            <p className="text-white/40 text-xs whitespace-nowrap">Công ty ABC</p>
          </div>
        )}

        {/* Collapse toggle button — top-right of header */}
        <button
          onClick={toggle}
          title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          className={cn(
            'flex items-center justify-center h-7 w-7 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-all flex-shrink-0',
            collapsed ? 'mt-0' : 'ml-1'
          )}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* ── User badge ─────────────────────────────────────── */}
      {user && (
        <div className={cn(
          'flex-shrink-0 border-b border-white/[0.06] py-3',
          collapsed ? 'flex justify-center px-2' : 'px-4'
        )}>
          {collapsed ? (
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: `${branchColor}25`, border: `1px solid ${branchColor}40`, color: branchColor }}
              title={user.branchLabel}
            >
              {isMaster ? <ShieldCheck size={14} /> : user.username.toUpperCase()}
            </div>
          ) : (
            <div
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
              style={{ backgroundColor: `${branchColor}12`, border: `1px solid ${branchColor}25` }}
            >
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: `${branchColor}25`, color: branchColor }}
              >
                {isMaster ? <ShieldCheck size={14} /> : user.username.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white/80 text-xs font-semibold truncate capitalize">{user.username}</p>
                <p className="text-white/35 text-[10px] truncate">{user.branchLabel}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav className={cn('flex-1 py-3 overflow-y-auto overflow-x-hidden', collapsed ? 'px-2' : 'px-3')}>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn('nav-item', isActive && 'active', collapsed && 'justify-center px-0')}
            >
              <Icon size={22} />
              {!collapsed && <span className="nav-item-label">{item.label}</span>}
              {!collapsed && isActive && <ChevronRight size={16} className="text-indigo-400/60 flex-shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer: Logout button ────────────────── */}
      <div className={cn('flex-shrink-0 border-t border-white/10 p-3', collapsed ? 'px-2' : 'px-3')}>
        {/* Logout */}
        <button
          onClick={logout}
          title="Đăng xuất"
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-sm font-medium',
            'text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20',
            collapsed && 'justify-center px-0'
          )}
        >
          <LogOut size={20} />
          {!collapsed && <span className="text-sm">Đăng xuất</span>}
        </button>
      </div>
    </aside>
  );
}
