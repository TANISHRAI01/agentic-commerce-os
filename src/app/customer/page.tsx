'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/AuthProvider';
import type { CustomerProfile } from '@/types/auth';

export default function CustomerDashboard() {
  const router = useRouter();
  const { user, profile, isLoading, logout } = useAuth();

  // Redirect if not authenticated or wrong role
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'CUSTOMER')) {
      router.replace('/auth/login?role=CUSTOMER');
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

  const customerProfile = profile as CustomerProfile | null;

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
          <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#c3c0ff' }}>terminal</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#c3c0ff' }}>Agentic Commerce OS</span>
        </div>
        <button
          id="customer-logout-btn"
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
          <p style={{ fontSize: '14px', color: 'rgba(195,192,255,0.6)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Welcome back</p>
          <h1 style={{ fontSize: '40px', fontWeight: 800, color: '#e8e6ff', fontFamily: "'Space Grotesk', sans-serif", marginBottom: '8px' }}>
            {user.name}
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(232,230,255,0.4)' }}>{user.email}</p>
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Agent Spending Limit', value: `₹${(customerProfile?.agentSpendingLimit ?? 5000).toLocaleString()}`, icon: 'smart_toy', color: '#c3c0ff' },
            { label: 'Approval Threshold', value: `₹${(customerProfile?.approvalThreshold ?? 3000).toLocaleString()}`, icon: 'verified', color: '#4ade80' },
            { label: 'Monthly Purchase Limit', value: `₹${(customerProfile?.monthlyPurchaseLimit ?? 50000).toLocaleString()}`, icon: 'calendar_month', color: '#fbbf24' },
          ].map(card => (
            <div key={card.label} style={{
              background: 'rgba(18,18,28,0.7)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              padding: '24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: card.color }}>{card.icon}</span>
                <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.5)' }}>{card.label}</span>
              </div>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#e8e6ff', fontFamily: "'Space Grotesk', sans-serif" }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(195,192,255,0.08), rgba(195,192,255,0.03))',
          border: '1px solid rgba(195,192,255,0.15)',
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
              Ready to shop with AI?
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(232,230,255,0.5)' }}>
              Let the agent find, negotiate, and checkout for you.
            </p>
          </div>
          <button
            id="go-to-shopping"
            onClick={() => router.push('/')}
            style={{
              background: 'rgba(195,192,255,0.15)', border: '1px solid rgba(195,192,255,0.3)',
              borderRadius: '12px', padding: '12px 24px', color: '#c3c0ff',
              fontSize: '15px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>shopping_cart</span>
            Start Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
