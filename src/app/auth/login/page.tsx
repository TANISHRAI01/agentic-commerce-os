'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UserRole } from '@/types/auth';

const CARD_STYLE = {
  background: 'rgba(18,18,28,0.8)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(195,192,255,0.15)',
  borderRadius: '24px',
  padding: '40px',
  width: '100%',
  maxWidth: '440px',
};

const INPUT_STYLE = {
  width: '100%',
  padding: '12px 16px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(195,192,255,0.15)',
  borderRadius: '12px',
  color: '#e8e6ff',
  fontSize: '15px',
  outline: 'none',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s',
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

  useEffect(() => {
    if (roleParam === 'CUSTOMER' || roleParam === 'MERCHANT') {
      setRole(roleParam);
    }
  }, [roleParam]);

  const accentColor = role === 'CUSTOMER' ? '#c3c0ff' : '#fbbf24';

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

      // Verify logged-in role matches requested role
      if (data.user.role !== role) {
        setError(`This account is a ${data.user.role.toLowerCase()} account. Please use the correct login.`);
        await fetch('/api/auth/logout', { method: 'POST' });
        return;
      }

      // Redirect to the appropriate dashboard or the originally requested page
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.push(role === 'CUSTOMER' ? '/customer' : '/merchant');
      }
    } catch {
      setError('Network error. Please try again.');
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
      background: 'var(--color-background, #0f0f14)',
      padding: '24px',
      fontFamily: "'Geist', sans-serif",
    }}>
      <div style={CARD_STYLE}>
        {/* Back */}
        <button
          id="back-to-role-select"
          onClick={() => router.push('/auth')}
          style={{ background: 'none', border: 'none', color: 'rgba(232,230,255,0.4)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '32px', padding: 0 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          Back
        </button>

        {/* Role toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px' }}>
          {(['CUSTOMER', 'MERCHANT'] as UserRole[]).map(r => (
            <button
              key={r}
              id={`role-toggle-${r.toLowerCase()}`}
              onClick={() => setRole(r)}
              style={{
                flex: 1, padding: '8px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                background: role === r ? (r === 'CUSTOMER' ? 'rgba(195,192,255,0.15)' : 'rgba(251,191,36,0.15)') : 'transparent',
                color: role === r ? (r === 'CUSTOMER' ? '#c3c0ff' : '#fbbf24') : 'rgba(232,230,255,0.4)',
                transition: 'all 0.2s',
              }}
            >
              {r === 'CUSTOMER' ? '🛍️ Customer' : '🏪 Merchant'}
            </button>
          ))}
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#e8e6ff', marginBottom: '8px', fontFamily: "'Space Grotesk', sans-serif" }}>
          Sign in
        </h1>
        <p style={{ fontSize: '14px', color: 'rgba(232,230,255,0.4)', marginBottom: '32px' }}>
          Welcome back to Agentic Commerce OS
        </p>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '12px', padding: '12px 16px', marginBottom: '24px',
            color: '#fca5a5', fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'rgba(232,230,255,0.6)', marginBottom: '8px' }}>Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={INPUT_STYLE}
              onFocus={e => (e.target.style.borderColor = accentColor)}
              onBlur={e => (e.target.style.borderColor = 'rgba(195,192,255,0.15)')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'rgba(232,230,255,0.6)', marginBottom: '8px' }}>Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={INPUT_STYLE}
              onFocus={e => (e.target.style.borderColor = accentColor)}
              onBlur={e => (e.target.style.borderColor = 'rgba(195,192,255,0.15)')}
            />
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '8px', padding: '14px', borderRadius: '12px', border: 'none',
              background: role === 'CUSTOMER' ? 'rgba(195,192,255,0.2)' : 'rgba(251,191,36,0.2)',
              color: accentColor, fontSize: '15px', fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'rgba(232,230,255,0.4)' }}>
          Don&apos;t have an account?{' '}
          <button
            id="go-to-signup"
            onClick={() => router.push(`/auth/signup?role=${role}`)}
            style={{ background: 'none', border: 'none', color: accentColor, cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
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
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
