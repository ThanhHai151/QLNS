'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Banknote, Clock3, FileText,
  BarChart3, Server, Briefcase, ChevronLeft, ChevronRight,
  Building2, Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './SidebarContext';

const navItems = [
  { href: '/',            label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/employees',   label: 'Nhân viên',     icon: Users },
  { href: '/salaries',    label: 'Bảng lương',    icon: Banknote },
  { href: '/attendance',  label: 'Chấm công',     icon: Clock3 },
  { href: '/contracts',   label: 'Hợp đồng',      icon: FileText },
  { href: '/recruitment', label: 'Tuyển dụng',    icon: Briefcase },
  { href: '/reports',     label: 'Báo cáo',       icon: BarChart3 },
  { href: '/system',      label: 'Hệ thống',      icon: Server },
  { href: '/sql',         label: 'SQL Terminal',  icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  const sidebarWidth = collapsed ? 64 : 256;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col sidebar-transition overflow-hidden',
        'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-white/10'
      )}
      style={{ width: sidebarWidth }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center flex-shrink-0 border-b border-white/10',
        collapsed ? 'justify-center py-5 px-0' : 'gap-3 px-5 py-5'
      )}>
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-white font-bold text-base leading-tight whitespace-nowrap">QLNS Phân Tán</p>
            <p className="text-white/40 text-xs whitespace-nowrap">Công ty ABC</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 py-3 overflow-y-auto overflow-x-hidden', collapsed ? 'px-2' : 'px-3')}>
        {navItems.map((item) => {
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

      {/* Footer / Collapse toggle */}
      <div className={cn('flex-shrink-0 border-t border-white/10 p-2', collapsed ? 'px-2' : 'px-3')}>
        {!collapsed && (
          <div className="mb-2 px-1">
            <p className="text-white/25 text-xs text-center">Distributed DB System v1.0</p>
            <p className="text-white/15 text-xs text-center mt-0.5">4 SQL Server Nodes</p>
          </div>
        )}
        <button
          onClick={toggle}
          title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          className="sidebar-collapse-btn"
        >
          {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Thu gọn</span></>}
        </button>
      </div>
    </aside>
  );
}
