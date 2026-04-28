'use client';

// ============================================================
// Auth — Branch-based authentication (client-side only)
// ============================================================
import { createContext, useContext, useState, useEffect, ReactNode, createElement } from 'react';

export type UserRole = 'master' | 'branch';
export type BranchCode = 'CN1' | 'CN2' | 'CN3' | null;

export interface AuthUser {
  username: string;
  role: UserRole;
  branch: BranchCode;          // null = master (xem tất cả)
  branchLabel: string;         // "Hà Nội" / "Đà Nẵng" / "TP.HCM" / "Master"
  nodeId: 'master' | 'cn1' | 'cn2' | 'cn3';
}

// ── Hardcoded credentials ──────────────────────────────────
interface Credential {
  password: string;
  user: AuthUser;
}

export const ACCOUNTS: Record<string, Credential> = {
  master: {
    password: 'master123',
    user: {
      username: 'master',
      role: 'master',
      branch: null,
      branchLabel: 'Toàn hệ thống',
      nodeId: 'master',
    },
  },
  cn1: {
    password: 'cn1@123',
    user: {
      username: 'cn1',
      role: 'branch',
      branch: 'CN1',
      branchLabel: 'CN1 — Hà Nội',
      nodeId: 'cn1',
    },
  },
  cn2: {
    password: 'cn2@123',
    user: {
      username: 'cn2',
      role: 'branch',
      branch: 'CN2',
      branchLabel: 'CN2 — Đà Nẵng',
      nodeId: 'cn2',
    },
  },
  cn3: {
    password: 'cn3@123',
    user: {
      username: 'cn3',
      role: 'branch',
      branch: 'CN3',
      branchLabel: 'CN3 — TP.HCM',
      nodeId: 'cn3',
    },
  },
};

const STORAGE_KEY = 'qlns_auth_user';

// ── Context ────────────────────────────────────────────────
interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  isMaster: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const cred = ACCOUNTS[username.trim().toLowerCase()];
    if (!cred) return { ok: false, error: 'Tên đăng nhập không tồn tại' };
    if (cred.password !== password) return { ok: false, error: 'Mật khẩu không đúng' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cred.user));
    setUser(cred.user);
    return { ok: true };
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return createElement(AuthContext.Provider, {
    value: { user, isLoading, login, logout, isMaster: user?.role === 'master' },
    children,
  });
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
