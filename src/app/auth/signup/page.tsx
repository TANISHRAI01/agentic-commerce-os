'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UserRole } from '@/types/auth';

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
};

const LABEL_STYLE = {
  display: 'block' as const,
  fontSize: '13px',
  color: 'rgba(232,230,255,0.6)',
  marginBottom: '8px',
};

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role') as UserRole | null;

  const [role, setRole] = useState<UserRole>(roleParam === 'MERCHANT' ? 'MERCHANT' : 'CUSTOMER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Common fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Customer fields
  const [agentSpendingLimit, setAgentSpendingLimit] = useState('5000');
  const [approvalThreshold, setApprovalThreshold] = useState('3000');
  const [monthlyPurchaseLimit, setMonthlyPurchaseLimit] = useState('50000');

  // Merchant fields
  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (roleParam === 'CUSTOMER' || roleParam === 'MERCHANT') setRole(roleParam);
  }, [roleParam]);

  const accentColor = role === 'CUSTOMER' ? '#c3c0ff' : '#fbbf24';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const body =
        role === 'CUSTOMER'
          ? {
              role: 'CUSTOMER',
              name,
              email,
              password,
              agentSpendingLimit: Number(agentSpendingLimit),
              approvalThreshold: Number(approvalThreshold),
              monthlyPurchaseLimit: Number(monthlyPurchaseLimit),
            }
          : {
              role: 'MERCHANT',
              name,
              email,
              password,
              shopName,
              shopDescription: shopDescription || undefined,
              category: category || undefined,
            };

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Signup failed. Please try again.');
        return;
      }

      router.push(role === 'CUSTOMER' ? '/customer' : '/merchant');
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
      background: '#0f0f14',
      padding: '24px',
      fontFamily: "'Geist', sans-serif",
    }}>
      <div style={{
        background: 'rgba(18,18,28,0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(195,192,255,0.15)',
        borderRadius: '24px',
        padding: '40px',
        width: '100%',
        maxWidth: '480px',
      }}>
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
              id={`signup-role-toggle-${r.toLowerCase()}`}
              onClick={() => setRole(r)}
              style={{
                flex: 1, padding: '8px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                background: role === r ? (r === 'CUSTOMER' ? 'rgba(195,192,255,0.15)' : 'rgba(251,191,36,0.15)') : 'transparent',
                color: role === r ? (r === 'CUSTOMER' ? '#c3c0ff' : '#fbbf24') : 'rgba(232,230,255,0.4)',
              }}
            >
              {r === 'CUSTOMER' ? '🛍️ Customer' : '🏪 Merchant'}
            </button>
          ))}
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#e8e6ff', marginBottom: '8px', fontFamily: "'Space Grotesk', sans-serif" }}>
          Create account
        </h1>
        <p style={{ fontSize: '14px', color: 'rgba(232,230,255,0.4)', marginBottom: '32px' }}>
          Join Agentic Commerce OS as a {role === 'CUSTOMER' ? 'customer' : 'merchant'}
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
          {/* Common fields */}
          <div>
            <label style={LABEL_STYLE}>Full Name</label>
            <input id="signup-name" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" style={INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Email</label>
            <input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Password <span style={{ color: 'rgba(232,230,255,0.3)' }}>(min 8 characters)</span></label>
            <input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="••••••••" style={INPUT_STYLE} />
          </div>

          {/* Role-specific fields */}
          {role === 'CUSTOMER' ? (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.4)' }}>
                💡 Policy defaults — you can change these later
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={LABEL_STYLE}>Agent Limit (₹)</label>
                  <input id="signup-agent-limit" type="number" value={agentSpendingLimit} onChange={e => setAgentSpendingLimit(e.target.value)} min={1} style={INPUT_STYLE} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={LABEL_STYLE}>Approval Above (₹)</label>
                  <input id="signup-approval-threshold" type="number" value={approvalThreshold} onChange={e => setApprovalThreshold(e.target.value)} min={1} style={INPUT_STYLE} />
                </div>
              </div>
              <div>
                <label style={LABEL_STYLE}>Monthly Purchase Limit (₹)</label>
                <input id="signup-monthly-limit" type="number" value={monthlyPurchaseLimit} onChange={e => setMonthlyPurchaseLimit(e.target.value)} min={1} style={INPUT_STYLE} />
              </div>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={LABEL_STYLE}>Shop Name *</label>
                <input id="signup-shop-name" type="text" value={shopName} onChange={e => setShopName(e.target.value)} required placeholder="Your store name" style={INPUT_STYLE} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Category <span style={{ color: 'rgba(232,230,255,0.3)' }}>(optional)</span></label>
                <input id="signup-category" type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Electronics, Books, Fashion" style={INPUT_STYLE} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Shop Description <span style={{ color: 'rgba(232,230,255,0.3)' }}>(optional)</span></label>
                <textarea id="signup-shop-desc" value={shopDescription} onChange={e => setShopDescription(e.target.value)} placeholder="Tell customers about your shop..." rows={3} style={{ ...INPUT_STYLE, resize: 'none' }} />
              </div>
            </div>
          )}

          <button
            id="signup-submit-btn"
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '8px', padding: '14px', borderRadius: '12px', border: 'none',
              background: role === 'CUSTOMER' ? 'rgba(195,192,255,0.2)' : 'rgba(251,191,36,0.2)',
              color: accentColor, fontSize: '15px', fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'rgba(232,230,255,0.4)' }}>
          Already have an account?{' '}
          <button
            id="go-to-login"
            onClick={() => router.push(`/auth/login?role=${role}`)}
            style={{ background: 'none', border: 'none', color: accentColor, cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupPageInner />
    </Suspense>
  );
}
