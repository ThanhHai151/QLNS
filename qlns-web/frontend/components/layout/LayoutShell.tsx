'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { Sidebar } from './Sidebar';
import { ServerStatusBar } from './ServerStatusBar';
import { cn } from '@/lib/utils';

function Shell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const isFullBleed = pathname.startsWith('/sql');
  const sidebarWidth = collapsed ? 64 : 256;
  return (
    <>
      <Sidebar />
      <div
        className={cn('h-screen flex flex-col content-transition overflow-hidden')}
        style={{ marginLeft: sidebarWidth }}
      >
        <ServerStatusBar />
        <main className={cn('flex-1 min-h-0', isFullBleed ? 'overflow-hidden' : 'overflow-auto p-6')}>{children}</main>
      </div>
    </>
  );
}

export function LayoutShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Shell>{children}</Shell>
    </SidebarProvider>
  );
}
