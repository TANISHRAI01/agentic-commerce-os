'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/AuthProvider';
import type { MerchantProfile } from '@/types/auth';

const TRUST_TIER_COLORS: Record<string, string> = {
  PLATINUM: '#e2e8f0',
  GOLD: '#fbbf24',
  SILVER: '#94a3b8',
  BRONZE: '#b45309',
  UNRATED: 'rgba(232,230,255,0.4)',
};

export default function MerchantDashboard() {
  const router = useRouter();
  const { user, profile, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'MERCHANT')) {
      router.replace('/auth/login?role=MERCHANT');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f14' }}>
        <div style={{ color: 'rgba(232,230,255,0.4)', fontSize: '14px' }}>Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const merchantProfile = profile as MerchantProfile | null;
  const tierColor = TRUST_TIER_COLORS[merchantProfile?.trustTier ?? 'UNRATED'] ?? 'rgba(232,230,255,0.4)';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f14',
      fontFamily: "'Geist', sans-serif",
      padding: '32px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '900px', margin: '0 auto 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#fbbf24' }}>storefront</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#fbbf24' }}>Merchant Portal</span>
        </div>
        <button
          id="merchant-logout-btn"
          onClick={logout}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 16px', color: 'rgba(232,230,255,0.5)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
          Logout
        </button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Welcome */}
        <div style={{ marginBottom: '40px' }}>
          <p style={{ fontSize: '14px', color: 'rgba(251,191,36,0.6)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Welcome back</p>
          <h1 style={{ fontSize: '40px', fontWeight: 800, color: '#e8e6ff', fontFamily: "'Space Grotesk', sans-serif", marginBottom: '4px' }}>
            {merchantProfile?.shopName ?? user.name}
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(232,230,255,0.4)', marginBottom: '8px' }}>Managed by {user.name} · {user.email}</p>
          {merchantProfile?.category && (
            <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.5)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '4px 12px' }}>
              {merchantProfile.category}
            </span>
          )}
        </div>

        {/* Profile Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <div style={{ background: 'rgba(18,18,28,0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: tierColor }}>verified_user</span>
              <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.5)' }}>Trust Tier</span>
            </div>
            <p style={{ fontSize: '28px', fontWeight: 700, color: tierColor, fontFamily: "'Space Grotesk', sans-serif" }}>
              {merchantProfile?.trustTier ?? 'UNRATED'}
            </p>
          </div>

          <div style={{ background: 'rgba(18,18,28,0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#fbbf24' }}>store</span>
              <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.5)' }}>Shop Status</span>
            </div>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#4ade80', fontFamily: "'Space Grotesk', sans-serif" }}>Active</p>
          </div>
        </div>

        {merchantProfile?.shopDescription && (
          <div style={{ background: 'rgba(18,18,28,0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
            <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.4)', marginBottom: '8px' }}>About the shop</p>
            <p style={{ fontSize: '15px', color: 'rgba(232,230,255,0.7)', lineHeight: 1.6 }}>{merchantProfile.shopDescription}</p>
          </div>
        )}

        {/* CTA */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.03))',
          border: '1px solid rgba(251,191,36,0.15)',
          borderRadius: '20px',
          padding: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#e8e6ff', marginBottom: '8px', fontFamily: "'Space Grotesk', sans-serif" }}>
              View Growth Intelligence
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(232,230,255,0.5)' }}>
              Upsell opportunities, abandoned carts, campaign recommendations.
            </p>
          </div>
          <button
            id="go-to-merchant-dashboard"
            onClick={() => router.push('/')}
            style={{
              background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: '12px', padding: '12px 24px', color: '#fbbf24',
              fontSize: '15px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>analytics</span>
            Open Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
