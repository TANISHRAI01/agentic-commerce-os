'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UserRole } from '@/types/auth';

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role') as UserRole | null;

  const [role, setRole] = useState<UserRole>(roleParam === 'MERCHANT' ? 'MERCHANT' : 'CUSTOMER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

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

  const isCustomer = role === 'CUSTOMER';
  const accentColor = isCustomer ? 'var(--brand)' : 'var(--brand-merchant)';
  const accentDim = isCustomer ? 'var(--brand-dim)' : 'var(--brand-merchant-dim)';
  const accentBorder = isCustomer ? 'var(--brand-border)' : 'var(--brand-merchant-border)';

  // Password strength
  const passStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthLabel = ['', 'Weak', 'Fair', 'Strong'][passStrength];
  const strengthColor = ['', 'var(--red)', 'var(--yellow)', 'var(--green)'][passStrength];

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
      background: 'var(--surf-0)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background orb */}
      <div className="auth-orb" style={{
        width: '400px', height: '400px',
        background: isCustomer ? '#c3c0ff' : '#fbbf24',
        bottom: '-150px', left: '-100px',
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

      <div className="fade-up custom-scrollbar" style={{
        width: '100%', maxWidth: '480px',
        position: 'relative', zIndex: 1,
        maxHeight: '90vh', overflowY: 'auto',
        paddingBottom: '8px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '48px', height: '48px', borderRadius: '14px',
            background: accentDim, border: `1px solid ${accentBorder}`,
            marginBottom: '14px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: accentColor }}>
              {isCustomer ? 'person_add' : 'store'}
            </span>
          </div>
          <h1 className="font-heading" style={{ fontSize: '24px', color: 'var(--text-1)', marginBottom: '6px' }}>
            Create {isCustomer ? 'Customer' : 'Merchant'} Account
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
            Join the AI commerce ecosystem
          </p>
        </div>

        <div className="card" style={{ padding: '28px 32px' }}>
          {/* Role toggle */}
          <div style={{
            display: 'flex', gap: '8px', padding: '4px',
            background: 'var(--surf-2)', borderRadius: 'var(--r-md)',
            marginBottom: '24px',
          }}>
            {(['CUSTOMER', 'MERCHANT'] as UserRole[]).map(r => (
              <button
                key={r}
                type="button"
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Common fields */}
            <div>
              <label className="form-label" htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                className={`form-input${!isCustomer ? ' merchant' : ''}`}
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" required autoComplete="name"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                className={`form-input${!isCustomer ? ' merchant' : ''}`}
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoComplete="email"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="signup-password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-password"
                  type={showPass ? 'text' : 'password'}
                  className={`form-input${!isCustomer ? ' merchant' : ''}`}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" required minLength={8}
                  style={{ paddingRight: '44px' }}
                />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {showPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {passStrength > 0 && (
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{
                        flex: 1, height: '3px', borderRadius: '2px',
                        background: i <= passStrength ? strengthColor : 'var(--border)',
                        transition: 'background 0.3s',
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', color: strengthColor, fontWeight: 600 }}>{strengthLabel}</span>
                </div>
              )}
            </div>

            <div className="divider" style={{ margin: '2px 0' }} />

            {/* Customer-specific fields */}
            {isCustomer && (
              <>
                <p style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Spending Limits
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" htmlFor="signup-monthly-limit">Monthly Limit (₹)</label>
                    <input
                      id="signup-monthly-limit"
                      type="number" min="0"
                      className="form-input"
                      value={monthlyPurchaseLimit}
                      onChange={e => setMonthlyPurchaseLimit(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="signup-agent-limit">AI Purchase Limit (₹)</label>
                    <input
                      id="signup-agent-limit"
                      type="number" min="0"
                      className="form-input"
                      value={agentSpendingLimit}
                      onChange={e => setAgentSpendingLimit(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label" htmlFor="signup-approval-threshold">Approval Threshold (₹)</label>
                  <input
                    id="signup-approval-threshold"
                    type="number" min="0"
                    className="form-input"
                    value={approvalThreshold}
                    onChange={e => setApprovalThreshold(e.target.value)}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
                    AI will ask for your approval before purchases above this amount
                  </p>
                </div>
              </>
            )}

            {/* Merchant-specific fields */}
            {!isCustomer && (
              <>
                <p style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Shop Details
                </p>
                <div>
                  <label className="form-label" htmlFor="signup-shop-name">Shop Name *</label>
                  <input
                    id="signup-shop-name"
                    className="form-input merchant"
                    value={shopName} onChange={e => setShopName(e.target.value)}
                    placeholder="My Awesome Store" required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="signup-category">Category</label>
                  <input
                    id="signup-category"
                    className="form-input merchant"
                    value={category} onChange={e => setCategory(e.target.value)}
                    placeholder="Electronics, Fashion, Books…"
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="signup-shop-desc">Description</label>
                  <textarea
                    id="signup-shop-desc"
                    className="form-input merchant"
                    value={shopDescription} onChange={e => setShopDescription(e.target.value)}
                    placeholder="Tell customers about your shop…"
                    rows={2}
                    style={{ resize: 'none' }}
                  />
                </div>
              </>
            )}

            {error && (
              <div className="form-error fade-in">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', flexShrink: 0 }}>error</span>
                {error}
              </div>
            )}

            <button
              id="signup-submit-btn"
              type="submit"
              disabled={isLoading}
              className="btn btn-lg"
              style={{
                background: accentDim,
                border: `1px solid ${accentBorder}`,
                color: accentColor,
                fontSize: '15px', fontWeight: 700,
                marginTop: '4px',
              }}
            >
              {isLoading ? (
                <>
                  <span className="spinner" style={{ width: '16px', height: '16px' }} />
                  Creating account…
                </>
              ) : (
                <>
                  Create Account
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-3)' }}>
          Already have an account?{' '}
          <button
            onClick={() => router.push(`/auth/login?role=${role}`)}
            style={{ background: 'none', border: 'none', color: accentColor, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
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
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--surf-0)' }} />}>
      <SignupPageInner />
    </Suspense>
  );
}
