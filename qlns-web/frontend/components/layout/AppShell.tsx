'use client';

import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { Sidebar } from './Sidebar';
import { ServerStatusBar } from './ServerStatusBar';
import { LoginPage } from '@/components/auth/LoginPage';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// ── Routes chỉ dành cho master ─────────────────────────────
const MASTER_ONLY_ROUTES = ['/system', '/sql'];

function Shell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isMaster } = useAuth();

  const isFullBleed = pathname.startsWith('/sql');
  const sidebarWidth = collapsed ? 64 : 256;

  // Redirect nếu branch account cố vào route master-only
  useEffect(() => {
    if (user && !isMaster) {
      const restricted = MASTER_ONLY_ROUTES.some(r => pathname.startsWith(r));
      if (restricted) {
        router.replace('/');
      }
    }
  }, [pathname, user, isMaster, router]);

  return (
    <>
      <Sidebar />
      <div
        className={cn('h-screen flex flex-col content-transition overflow-hidden')}
        style={{ marginLeft: sidebarWidth }}
      >
        <ServerStatusBar />
        <main className={cn('flex-1 min-h-0', isFullBleed ? 'overflow-hidden' : 'overflow-auto p-6')}>
          {children}
        </main>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <SidebarProvider>
      <Shell>{children}</Shell>
    </SidebarProvider>
  );
}
