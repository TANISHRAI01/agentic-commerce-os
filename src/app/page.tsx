'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './components/AuthProvider';

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      // Redirect authenticated users directly to their dashboard
      router.replace(user.role === 'MERCHANT' ? '/merchant' : '/customer');
    }
  }, [user, isLoading, router]);

  // While auth is loading show spinner
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--surf-0)',
      }}>
        <div className="spinner" style={{ width: '28px', height: '28px', color: 'var(--brand)' }} />
      </div>
    );
  }

  // Not logged in — show landing page
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--surf-0)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: '24px',
    }}>
      {/* Background orbs */}
      <div className="auth-orb orb-float" style={{
        width: '600px', height: '600px',
        background: '#c3c0ff',
        top: '-200px', left: '-200px',
        opacity: 0.07,
      }} />
      <div className="auth-orb orb-float" style={{
        width: '500px', height: '500px',
        background: '#fbbf24',
        bottom: '-150px', right: '-150px',
        opacity: 0.07,
        animationDelay: '-4s',
      }} />

      {/* Hero content */}
      <div className="fade-up" style={{
        maxWidth: '680px', textAlign: 'center',
        position: 'relative', zIndex: 1,
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 16px',
          background: 'var(--brand-dim)',
          border: '1px solid var(--brand-border)',
          borderRadius: 'var(--r-full)',
          marginBottom: '28px',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--brand)' }}>
            smart_toy
          </span>
          <span style={{
            fontSize: '12px', fontWeight: 700, color: 'var(--brand)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Razorpay AI Buildathon 2026
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display" style={{
          fontSize: 'clamp(36px, 7vw, 72px)',
          color: 'var(--text-1)',
          lineHeight: 1.05,
          marginBottom: '20px',
        }}>
          Your AI Does<br />
          <span style={{ color: 'var(--brand)' }}>the Shopping.</span>
        </h1>

        <p style={{
          fontSize: '18px', color: 'var(--text-2)', lineHeight: 1.7,
          marginBottom: '48px', maxWidth: '520px', margin: '0 auto 48px',
        }}>
          Intent → Discovery → Negotiation → Checkout. Fully autonomous.
          AI that shops within your limits, asks when it should, and pays when you approve.
        </p>

        {/* CTA buttons */}
        <div className="fade-up delay-2" style={{
          display: 'flex', gap: '16px', justifyContent: 'center',
          flexWrap: 'wrap', marginBottom: '60px',
        }}>
          <button
            id="landing-customer-btn"
            onClick={() => router.push('/auth/login?role=CUSTOMER')}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '16px 32px', borderRadius: 'var(--r-lg)',
              background: 'var(--brand-dim)',
              border: '1px solid var(--brand-border)',
              color: 'var(--brand)', fontSize: '16px', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(195,192,255,0.22)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(195,192,255,0.15)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-dim)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-border)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>shopping_bag</span>
            Shop as Customer
          </button>

          <button
            id="landing-merchant-btn"
            onClick={() => router.push('/auth/login?role=MERCHANT')}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '16px 32px', borderRadius: 'var(--r-lg)',
              background: 'var(--brand-merchant-dim)',
              border: '1px solid var(--brand-merchant-border)',
              color: 'var(--brand-merchant)', fontSize: '16px', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(251,191,36,0.22)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-merchant)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(251,191,36,0.12)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-merchant-dim)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-merchant-border)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>storefront</span>
            Run a Shop
          </button>
        </div>

        {/* Feature pills */}
        <div className="fade-up delay-3" style={{
          display: 'flex', flexWrap: 'wrap', gap: '10px',
          justifyContent: 'center',
        }}>
          {[
            { icon: 'policy',         label: 'Spending limits enforced' },
            { icon: 'handshake',      label: 'AI negotiates price' },
            { icon: 'verified',       label: 'Approval gating' },
            { icon: 'receipt_long',   label: 'Full audit trail' },
            { icon: 'currency_rupee', label: 'Razorpay checkout' },
          ].map(f => (
            <div key={f.label} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px',
              background: 'var(--surf-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-full)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-3)' }}>
                {f.icon}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 500 }}>
                {f.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: '24px',
        fontSize: '11px', color: 'var(--text-3)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <span>Agentic Commerce OS</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span>Phase 10H</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)' }} />
          Razorpay TEST MODE
        </div>
      </div>
    </div>
  );
}
