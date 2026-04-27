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
        className={cn('min-h-screen flex flex-col content-transition')}
        style={{ marginLeft: sidebarWidth }}
      >
        <ServerStatusBar />
        <main className={cn('flex-1', isFullBleed ? 'overflow-hidden' : 'p-6')}>{children}</main>
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
