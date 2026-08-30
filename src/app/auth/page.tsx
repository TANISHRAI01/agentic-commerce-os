'use client';

import { useRouter } from 'next/navigation';

export default function AuthSelectionPage() {
  const router = useRouter();

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
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '56px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#c3c0ff' }}>
            terminal
          </span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#c3c0ff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Agentic Commerce OS
          </span>
        </div>
        <h1 style={{
          fontSize: '48px',
          fontWeight: 800,
          color: '#e8e6ff',
          lineHeight: 1.1,
          marginBottom: '16px',
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          Who are you?
        </h1>
        <p style={{ fontSize: '18px', color: 'rgba(232,230,255,0.5)', maxWidth: '420px', margin: '0 auto' }}>
          Choose your role to enter the platform
        </p>
      </div>

      {/* Role Cards */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '720px', width: '100%' }}>
        {/* Customer Card */}
        <button
          id="role-customer-btn"
          onClick={() => router.push('/auth/login?role=CUSTOMER')}
          style={{
            flex: '1 1 300px',
            background: 'rgba(18,18,28,0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(195,192,255,0.15)',
            borderRadius: '24px',
            padding: '40px 32px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(195,192,255,0.5)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 20px 60px rgba(195,192,255,0.1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(195,192,255,0.15)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'rgba(195,192,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '24px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#c3c0ff' }}>
              shopping_cart
            </span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#e8e6ff', marginBottom: '12px', fontFamily: "'Space Grotesk', sans-serif" }}>
            I&apos;m a Customer
          </h2>
          <p style={{ fontSize: '15px', color: 'rgba(232,230,255,0.5)', lineHeight: 1.6, marginBottom: '24px' }}>
            Let AI do your shopping. Negotiate deals, enforce spending limits, and track every purchase automatically.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {['AI-powered product discovery', 'Agent negotiation engine', 'Policy & budget guardrails', 'Full audit trail'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#4ade80' }}>check_circle</span>
                <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.6)' }}>{f}</span>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: '32px', display: 'flex', alignItems: 'center',
            gap: '8px', color: '#c3c0ff', fontSize: '14px', fontWeight: 600,
          }}>
            Continue as Customer
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
          </div>
        </button>

        {/* Merchant Card */}
        <button
          id="role-merchant-btn"
          onClick={() => router.push('/auth/login?role=MERCHANT')}
          style={{
            flex: '1 1 300px',
            background: 'rgba(18,18,28,0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(251,191,36,0.15)',
            borderRadius: '24px',
            padding: '40px 32px',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(251,191,36,0.5)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 20px 60px rgba(251,191,36,0.08)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(251,191,36,0.15)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'rgba(251,191,36,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '24px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#fbbf24' }}>
              storefront
            </span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#e8e6ff', marginBottom: '12px', fontFamily: "'Space Grotesk', sans-serif" }}>
            I&apos;m a Merchant
          </h2>
          <p style={{ fontSize: '15px', color: 'rgba(232,230,255,0.5)', lineHeight: 1.6, marginBottom: '24px' }}>
            Grow your business with AI-powered insights. Discover upsell opportunities, track abandoned carts, and launch smart campaigns.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {['Growth intelligence dashboard', 'Upsell & cross-sell analysis', 'Abandoned cart signals', 'Campaign recommendations'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#fbbf24' }}>check_circle</span>
                <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.6)' }}>{f}</span>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: '32px', display: 'flex', alignItems: 'center',
            gap: '8px', color: '#fbbf24', fontSize: '14px', fontWeight: 600,
          }}>
            Continue as Merchant
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
          </div>
        </button>
      </div>

      {/* Footer note */}
      <p style={{ marginTop: '48px', fontSize: '13px', color: 'rgba(232,230,255,0.25)', textAlign: 'center' }}>
        Razorpay AI Buildathon 2026 · Test Mode · No real payments
      </p>
    </div>
  );
}
