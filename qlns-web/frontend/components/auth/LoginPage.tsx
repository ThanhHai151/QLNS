'use client';

import { useState, KeyboardEvent } from 'react';
import { useAuth, ACCOUNTS } from '@/lib/auth';
import { Building2, Lock, User, Eye, EyeOff, Loader2, AlertCircle, ChevronRight } from 'lucide-react';

const BRANCH_COLORS: Record<string, string> = {
  master: '#6366f1',
  cn1: '#10b981',
  cn2: '#f59e0b',
  cn3: '#ef4444',
};

const BRANCH_DESCRIPTIONS: Record<string, string> = {
  master: 'Toàn quyền — tất cả chi nhánh',
  cn1: 'Chi nhánh Hà Nội',
  cn2: 'Chi nhánh Đà Nẵng',
  cn3: 'Chi nhánh TP.HCM',
};

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    setLoading(true);
    setError('');
    await new Promise(r => setTimeout(r, 400));
    const result = await login(username, password);
    if (!result.ok) {
      setError(result.error ?? 'Đăng nhập thất bại');
    }
    setLoading(false);
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const fillAccount = (user: string) => {
    setUsername(user);
    setPassword(ACCOUNTS[user].password);
    setError('');
  };

  return (
    <div
      className="min-h-screen bg-slate-950 relative overflow-hidden"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}
    >
      {/* Background glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-60 -left-60 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-60 -right-60 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-900/8 rounded-full blur-3xl" />
      </div>

      <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 10 }}>
        {/* Card */}
        <div
          className="rounded-3xl shadow-2xl shadow-black/60 overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.95) 100%)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Top gradient strip */}
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          {/* Card content */}
          <div style={{ padding: '40px 32px 44px' }}>

            {/* Logo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
              <div
                className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/40"
                style={{ width: '72px', height: '72px', marginBottom: '20px' }}
              >
                <Building2 className="h-9 w-9 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">QLNS Phân Tán</h1>
              <p className="text-slate-400 text-sm" style={{ marginTop: '8px' }}>
                Hệ thống Quản lý Nhân sự — Công ty ABC
              </p>
            </div>

            {/* ─── Form ─── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Username */}
              <div>
                <label
                  className="text-slate-300 text-xs font-semibold tracking-widest uppercase"
                  style={{ display: 'block', marginBottom: '10px' }}
                >
                  Tên đăng nhập
                </label>
                <div style={{ position: 'relative' }}>
                  <User
                    className="text-slate-500 pointer-events-none"
                    size={18}
                    style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(''); }}
                    onKeyDown={handleKey}
                    placeholder="master / cn1 / cn2 / cn3"
                    autoComplete="username"
                    className="placeholder-slate-500"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1.5px solid rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      height: '52px',
                      paddingLeft: '52px',
                      paddingRight: '16px',
                      color: 'white',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.background = 'rgba(255,255,255,0.09)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.background = 'rgba(255,255,255,0.06)'; }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  className="text-slate-300 text-xs font-semibold tracking-widest uppercase"
                  style={{ display: 'block', marginBottom: '10px' }}
                >
                  Mật khẩu
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    className="text-slate-500 pointer-events-none"
                    size={18}
                    style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    onKeyDown={handleKey}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="placeholder-slate-500"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1.5px solid rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      height: '52px',
                      paddingLeft: '52px',
                      paddingRight: '52px',
                      color: 'white',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.background = 'rgba(255,255,255,0.09)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.background = 'rgba(255,255,255,0.06)'; }}
                  />
                  <button
                    onClick={() => setShowPass(p => !p)}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', padding: '6px', background: 'none', border: 'none', cursor: 'pointer' }}
                    tabIndex={-1}
                    type="button"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)' }}>
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                id="login-submit"
                onClick={handleSubmit}
                disabled={loading}
                type="button"
                className="font-semibold text-base text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
                style={{ width: '100%', height: '52px', borderRadius: '12px', border: 'none', cursor: 'pointer', marginTop: '4px' }}
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Đang xác thực...</>
                ) : (
                  <><span>Đăng nhập</span><ChevronRight size={18} /></>
                )}
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '32px 0 24px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
              <span className="text-slate-500 text-xs tracking-widest uppercase font-medium">Chọn nhanh tài khoản</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
            </div>

            {/* Quick access grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%' }}>
              {Object.entries(ACCOUNTS).map(([key]) => (
                <button
                  key={key}
                  onClick={() => fillAccount(key)}
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1.5px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    minWidth: 0,
                    width: '100%',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                    (e.currentTarget as HTMLElement).style.borderColor = `${BRANCH_COLORS[key]}50`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: `${BRANCH_COLORS[key]}22`,
                      border: `1.5px solid ${BRANCH_COLORS[key]}45`,
                      color: BRANCH_COLORS[key],
                    }}
                  >
                    {key === 'master' ? 'M' : key.toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <p className="text-slate-200 text-sm font-semibold capitalize">{key}</p>
                    <p className="text-slate-500 text-xs" style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {BRANCH_DESCRIPTIONS[key]}
                    </p>
                  </div>
                </button>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
