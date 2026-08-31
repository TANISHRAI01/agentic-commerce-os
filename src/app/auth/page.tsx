'use client';

import { useRouter } from 'next/navigation';

const CUSTOMER_FEATURES = [
  { icon: 'smart_toy',             text: 'AI-powered product discovery'  },
  { icon: 'handshake',             text: 'Agent negotiation engine'       },
  { icon: 'policy',                text: 'Policy & budget guardrails'     },
  { icon: 'receipt_long',          text: 'Full audit trail'               },
];

const MERCHANT_FEATURES = [
  { icon: 'auto_graph',            text: 'Growth intelligence dashboard'  },
  { icon: 'trending_up',           text: 'Upsell & cross-sell analysis'   },
  { icon: 'shopping_cart_off',     text: 'Abandoned cart signals'         },
  { icon: 'campaign',              text: 'Campaign recommendations'       },
];

export default function AuthSelectionPage() {
  const router = useRouter();

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
      {/* Background orbs */}
      <div className="auth-orb" style={{
        width: '500px', height: '500px',
        background: '#c3c0ff',
        top: '-200px', left: '-150px',
        animationDelay: '0s',
      }} />
      <div className="auth-orb orb-float" style={{
        width: '400px', height: '400px',
        background: '#fbbf24',
        bottom: '-150px', right: '-100px',
        animationDelay: '4s',
      }} />

      {/* Header */}
      <div className="fade-up" style={{ textAlign: 'center', marginBottom: '56px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'var(--brand-dim)', border: '1px solid var(--brand-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--brand)' }}>
              terminal
            </span>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Agentic Commerce OS
          </span>
        </div>

        <h1 className="font-display" style={{
          fontSize: '52px',
          color: 'var(--text-1)',
          lineHeight: 1.1,
          marginBottom: '16px',
        }}>
          Who are you?
        </h1>
        <p style={{ fontSize: '17px', color: 'var(--text-2)', maxWidth: '380px', margin: '0 auto', lineHeight: 1.6 }}>
          Choose your role to enter the platform. AI does the heavy lifting either way.
        </p>
      </div>

      {/* Role Cards */}
      <div className="fade-up delay-2" style={{
        display: 'flex', gap: '20px', flexWrap: 'wrap',
        justifyContent: 'center', maxWidth: '780px', width: '100%',
        position: 'relative', zIndex: 1,
      }}>
        {/* Customer Card */}
        <button
          id="role-customer-btn"
          className="card-brand"
          onClick={() => router.push('/auth/login?role=CUSTOMER')}
          style={{ flex: '1 1 340px', maxWidth: '380px' }}
        >
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'var(--brand-dim)', border: '1px solid var(--brand-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '26px', color: 'var(--brand)' }}>
              shopping_bag
            </span>
          </div>

          <h2 className="font-heading" style={{ fontSize: '22px', color: 'var(--text-1)', marginBottom: '10px' }}>
            I&apos;m a Customer
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.65, marginBottom: '24px' }}>
            Let AI do your shopping. Negotiate deals, enforce spending limits, and track every purchase automatically.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
            {CUSTOMER_FEATURES.map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--green)', flexShrink: 0 }}>
                  check_circle
                </span>
                <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.65)' }}>{f.text}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--brand)', fontSize: '14px', fontWeight: 700 }}>
            Continue as Customer
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
          </div>
        </button>

        {/* Merchant Card */}
        <button
          id="role-merchant-btn"
          className="card-merchant"
          onClick={() => router.push('/auth/login?role=MERCHANT')}
          style={{ flex: '1 1 340px', maxWidth: '380px' }}
        >
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'var(--brand-merchant-dim)', border: '1px solid var(--brand-merchant-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '26px', color: 'var(--brand-merchant)' }}>
              storefront
            </span>
          </div>

          <h2 className="font-heading" style={{ fontSize: '22px', color: 'var(--text-1)', marginBottom: '10px' }}>
            I&apos;m a Merchant
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.65, marginBottom: '24px' }}>
            Grow your business with AI-powered insights. Discover upsell opportunities, track abandoned carts, and launch smart campaigns.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
            {MERCHANT_FEATURES.map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--brand-merchant)', flexShrink: 0 }}>
                  check_circle
                </span>
                <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.65)' }}>{f.text}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--brand-merchant)', fontSize: '14px', fontWeight: 700 }}>
            Continue as Merchant
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
          </div>
        </button>
      </div>

      {/* Demo note */}
      <div className="fade-up delay-4" style={{
        marginTop: '48px', display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 20px',
        background: 'rgba(195,192,255,0.04)',
        border: '1px solid rgba(195,192,255,0.10)',
        borderRadius: 'var(--r-full)',
        position: 'relative', zIndex: 1,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--text-3)' }}>info</span>
        <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>
          Razorpay AI Buildathon 2026 · Test Mode · No real payments processed
        </p>
      </div>
    </div>
  );
}
