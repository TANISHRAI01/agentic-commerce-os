'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UserRole } from '@/types/auth';

// Demo credentials for the hackathon demo
const DEMO_CREDENTIALS: Record<UserRole, { email: string; password: string; label: string }> = {
  CUSTOMER: { email: 'customer@demo.com', password: 'demo1234', label: 'Customer Demo' },
  MERCHANT: { email: 'merchant@demo.com', password: 'demo1234', label: 'Merchant Demo' },
};

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role') as UserRole | null;
  const redirectTo = searchParams.get('redirect') ?? null;

  const [role, setRole] = useState<UserRole>(roleParam === 'MERCHANT' ? 'MERCHANT' : 'CUSTOMER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (roleParam === 'CUSTOMER' || roleParam === 'MERCHANT') {
      setRole(roleParam);
    }
  }, [roleParam]);

  const isCustomer = role === 'CUSTOMER';
  const accentColor = isCustomer ? 'var(--brand)' : 'var(--brand-merchant)';
  const accentDim = isCustomer ? 'var(--brand-dim)' : 'var(--brand-merchant-dim)';
  const accentBorder = isCustomer ? 'var(--brand-border)' : 'var(--brand-merchant-border)';
  const demo = DEMO_CREDENTIALS[role];

  const fillDemo = () => {
    setEmail(demo.email);
    setPassword(demo.password);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid email or password');
        return;
      }

      if (data.user.role !== role) {
        setError(`This account is registered as a ${data.user.role.toLowerCase()}. Please use the correct login.`);
        await fetch('/api/auth/logout', { method: 'POST' });
        return;
      }

      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.push(role === 'CUSTOMER' ? '/customer' : '/merchant');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surf-0)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background orb */}
      <div className="auth-orb" style={{
        width: '400px', height: '400px',
        background: isCustomer ? '#c3c0ff' : '#fbbf24',
        top: '-150px', right: '-100px',
        opacity: 0.12,
      }} />

      {/* Back link */}
      <button
        onClick={() => router.push('/auth')}
        className="btn btn-ghost btn-sm"
        style={{ position: 'absolute', top: '24px', left: '24px', gap: '6px' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
        Back
      </button>

      <div className="fade-up" style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '48px', height: '48px', borderRadius: '14px',
            background: accentDim, border: `1px solid ${accentBorder}`,
            marginBottom: '16px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: accentColor }}>
              {isCustomer ? 'shopping_bag' : 'storefront'}
            </span>
          </div>
          <h1 className="font-heading" style={{ fontSize: '26px', color: 'var(--text-1)', marginBottom: '6px' }}>
            {isCustomer ? 'Customer Login' : 'Merchant Login'}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>
            Sign in to your {isCustomer ? 'shopping' : 'merchant'} dashboard
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '32px' }}>
          {/* Role toggle */}
          <div style={{
            display: 'flex', gap: '8px', padding: '4px',
            background: 'var(--surf-2)', borderRadius: 'var(--r-md)',
            marginBottom: '24px',
          }}>
            {(['CUSTOMER', 'MERCHANT'] as UserRole[]).map(r => (
              <button
                key={r}
                onClick={() => { setRole(r); setError(''); }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  transition: 'all 0.2s',
                  background: role === r
                    ? (r === 'CUSTOMER' ? 'var(--brand-dim)' : 'var(--brand-merchant-dim)')
                    : 'transparent',
                  color: role === r
                    ? (r === 'CUSTOMER' ? 'var(--brand)' : 'var(--brand-merchant)')
                    : 'var(--text-3)',
                  border: role === r
                    ? `1px solid ${r === 'CUSTOMER' ? 'var(--brand-border)' : 'var(--brand-merchant-border)'}`
                    : '1px solid transparent',
                }}
              >
                {r === 'CUSTOMER' ? '🛍️ Customer' : '🏪 Merchant'}
              </button>
            ))}
          </div>

          {/* Demo fill button */}
          <button
            onClick={fillDemo}
            type="button"
            style={{
              width: '100%', padding: '10px', borderRadius: 'var(--r-md)',
              background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-strong)',
              cursor: 'pointer', marginBottom: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              color: 'var(--text-2)', fontSize: '13px', fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = accentBorder)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: accentColor }}>bolt</span>
            Use demo credentials ({demo.email})
          </button>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="form-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                className={`form-input${!isCustomer ? ' merchant' : ''}`}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="login-password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className={`form-input${!isCustomer ? ' merchant' : ''}`}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-3)', display: 'flex',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {showPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="form-error fade-in">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', flexShrink: 0 }}>error</span>
                {error}
              </div>
            )}

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading || !email || !password}
              className="btn btn-lg"
              style={{
                background: accentDim,
                border: `1px solid ${accentBorder}`,
                color: accentColor,
                marginTop: '4px',
                fontSize: '15px',
                fontWeight: 700,
              }}
            >
              {isLoading ? (
                <>
                  <span className="spinner" style={{ width: '16px', height: '16px' }} />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-3)' }}>
          Don&apos;t have an account?{' '}
          <button
            onClick={() => router.push(`/auth/signup?role=${role}`)}
            style={{ background: 'none', border: 'none', color: accentColor, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--surf-0)' }} />}>
      <LoginPageInner />
    </Suspense>
  );
}
