'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/AuthProvider';
import type { MerchantProfile } from '@/types/auth';
import type {
  GrowthIntelligenceReport,
  TopRecommendedProduct,
  UpsellOpportunity,
  CrossSellPair,
  AbandonedCartSignal,
  CampaignSuggestion,
} from '@/services/growth-intelligence';
import type { Transaction, AuditEvent } from '@/types/schemas';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ViewId = 'overview' | 'products' | 'growth' | 'orders' | 'analytics' | 'settings';

interface MerchantStats {
  totalProducts: number;
  totalOrders: number;
  completedOrders: number;
  pendingApprovals: number;
  totalRevenue: number;
  totalMerchants: number;
  avgRating: number;
  topProduct: { name: string; orderCount: number } | null;
  dataNote: string;
}

interface MerchantOrder {
  id: string;
  state: string;
  intentRaw?: string;
  productName: string;
  productPrice: number;
  finalPrice: number;
  wasNegotiated: boolean;
  razorpayPaymentId?: string;
  approvalStatus?: string;
  failureReason?: string;
  createdAt: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  stock: number;
  merchantName: string;
  merchantTrustTier: string;
  tags: string[];
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: ViewId; icon: string; label: string }[] = [
  { id: 'overview',  icon: 'dashboard',       label: 'Overview'  },
  { id: 'products',  icon: 'inventory_2',     label: 'Products'  },
  { id: 'growth',    icon: 'auto_graph',      label: 'AI Growth' },
  { id: 'orders',    icon: 'receipt_long',    label: 'Orders'    },
  { id: 'analytics', icon: 'insights',        label: 'Analytics' },
  { id: 'settings',  icon: 'manage_accounts', label: 'Settings'  },
];

const TRUST_TIER_COLORS: Record<string, string> = {
  PLATINUM: '#e2e8f0',
  GOLD:     '#fbbf24',
  SILVER:   '#94a3b8',
  BRONZE:   '#b45309',
  UNRATED:  'rgba(232,230,255,0.4)',
};

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  COMPLETED:         { label: 'Completed',     color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
  VERIFIED:          { label: 'Verified',      color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
  PAYMENT_SUCCESS:   { label: 'Paid',          color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
  APPROVAL_REQUIRED: { label: 'Awaiting',      color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  PAYMENT_PENDING:   { label: 'Processing',    color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  PAYMENT_FAILED:    { label: 'Failed',        color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  BLOCKED:           { label: 'Blocked',       color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  CART_READY:        { label: 'Cart Ready',    color: '#c3c0ff', bg: 'rgba(195,192,255,0.1)' },
  NEGOTIATING:       { label: 'Negotiating',   color: '#c3c0ff', bg: 'rgba(195,192,255,0.1)' },
  CANCELLED:         { label: 'Cancelled',     color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
};

const ACTION_COLORS: Record<string, string> = {
  HIGHLIGHT:      '#4ade80',
  BUNDLE_OFFER:   '#c3c0ff',
  PRICE_DROP:     '#f87171',
  CROSS_PROMOTE:  '#fbbf24',
};

const SIGNAL_LABEL_META: Record<string, { color: string; label: string }> = {
  TOP_PICK:   { color: '#fbbf24', label: 'Top Pick' },
  HIGH_RATED: { color: '#c3c0ff', label: 'High Rated' },
  POPULAR:    { color: '#4ade80', label: 'Popular' },
};

// ─────────────────────────────────────────────────────────────
// Hardcoded demo data (makes the portal feel alive out of the box)
// ─────────────────────────────────────────────────────────────

const DEMO_REVENUE_SPARKLINE = [12400, 18200, 15600, 22800, 19400, 31200, 28600, 35400, 29800, 42100, 38500, 47300];
const DEMO_REVENUE_LABELS   = ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul'];

const DEMO_RECENT_ACTIVITY = [
  { id: 'act-1', icon: 'shopping_bag',   color: '#4ade80', text: 'New order: Sony WH-1000XM5',          sub: '₹23,490 · Completed',        time: '2m ago'  },
  { id: 'act-2', icon: 'auto_awesome',   color: '#c3c0ff', text: 'AI suggested price drop on AirPods',  sub: '₹15,999 → ₹13,499',          time: '18m ago' },
  { id: 'act-3', icon: 'shopping_bag',   color: '#4ade80', text: 'New order: Noise ColorFit Ultra 3',   sub: '₹4,299 · Completed',          time: '1h ago'  },
  { id: 'act-4', icon: 'campaign',       color: '#fbbf24', text: 'Campaign: Cross-promote Electronics',  sub: 'Activate to boost visibility',  time: '3h ago'  },
  { id: 'act-5', icon: 'shopping_cart',  color: '#f87171', text: 'Abandoned cart: boAt Airdopes 141',   sub: '₹1,299 · Cart Ready',          time: '5h ago'  },
];

const DEMO_ORDERS: MerchantOrder[] = [
  { id: 'demo-o1', state: 'COMPLETED',  productName: 'Sony WH-1000XM5 Headphones',  productPrice: 26990, finalPrice: 23490, wasNegotiated: true,  razorpayPaymentId: 'pay_PrQ2Xk9mAb3cD4', createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString()   },
  { id: 'demo-o2', state: 'COMPLETED',  productName: 'Noise ColorFit Ultra 3',       productPrice: 4299,  finalPrice: 4299,  wasNegotiated: false, razorpayPaymentId: 'pay_Lr7YmN8zWe1fG2', createdAt: new Date(Date.now() - 1000 * 60 * 65).toISOString()  },
  { id: 'demo-o3', state: 'PAYMENT_PENDING', productName: 'boAt Rockerz 450',       productPrice: 1999,  finalPrice: 1799,  wasNegotiated: true,  createdAt: new Date(Date.now() - 1000 * 60 * 130).toISOString() },
  { id: 'demo-o4', state: 'COMPLETED',  productName: 'JBL Flip 6 Portable Speaker', productPrice: 9999,  finalPrice: 9499,  wasNegotiated: true,  razorpayPaymentId: 'pay_Ks5TpM3xVr8hI9', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
  { id: 'demo-o5', state: 'BLOCKED',    productName: 'Apple AirPods Pro 2nd Gen',   productPrice: 24900, finalPrice: 24900, wasNegotiated: false, failureReason: 'Exceeds buyer spending limit', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString() },
  { id: 'demo-o6', state: 'COMPLETED',  productName: 'Sennheiser HD 450BT',         productPrice: 7990,  finalPrice: 6990,  wasNegotiated: true,  razorpayPaymentId: 'pay_Nt4WoP7yHs2jK8', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString() },
];

const DEMO_TOP_PRODUCTS = [
  { name: 'Sony WH-1000XM5 Headphones', orders: 18, revenue: 422820, trend: '+12%' },
  { name: 'JBL Flip 6 Portable Speaker', orders: 14, revenue: 132986, trend: '+8%'  },
  { name: 'Noise ColorFit Ultra 3',      orders: 11, revenue: 47289,  trend: '+23%' },
  { name: 'boAt Rockerz 450',            orders: 9,  revenue: 16191,  trend: '+5%'  },
  { name: 'Sennheiser HD 450BT',         orders: 7,  revenue: 48930,  trend: '+3%'  },
];

const DEMO_INSIGHT_CARDS = [
  { icon: 'trending_up',   color: '#4ade80', label: 'Avg Order Value',        value: '₹9,316',   sub: '+18% vs last month'   },
  { icon: 'people',        color: '#c3c0ff', label: 'Repeat Buyer Rate',       value: '34%',      sub: '12 returning buyers'  },
  { icon: 'local_offer',   color: '#fbbf24', label: 'Negotiation Win Rate',    value: '71%',      sub: '5 of 7 deals closed'  },
  { icon: 'inventory_2',   color: '#f87171', label: 'Low Stock Alerts',        value: '2 items',  sub: 'Restock recommended'  },
];

// ─────────────────────────────────────────────────────────────
// Reusable sub-components
// ─────────────────────────────────────────────────────────────

function StateBadge({ state }: { state: string }) {
  const meta = STATE_META[state] ?? { label: state, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
      textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px',
      color: meta.color, background: meta.bg, whiteSpace: 'nowrap',
    }}>{meta.label}</span>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(18,18,28,0.6)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      padding: '20px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function DemoTag({ text }: { text: string }) {
  return (
    <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.25)', marginTop: '8px', fontStyle: 'italic' }}>
      {text}
    </p>
  );
}

function SectionTitle({ icon, label, color = '#fbbf24' }: { icon: string; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
      <span className="material-symbols-outlined" style={{ fontSize: '20px', color }}>{icon}</span>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e8e6ff', fontFamily: "'Space Grotesk', sans-serif" }}>{label}</h2>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(232,230,255,0.3)' }}>
      <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>{icon}</span>
      <p style={{ fontSize: '15px' }}>{message}</p>
    </div>
  );
}

function LoadingPulse() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
      <div className="spinner" style={{ width: '32px', height: '32px', color: 'var(--brand-merchant)' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: Overview
// ─────────────────────────────────────────────────────────────

function MiniSparkline({ data, color = '#fbbf24' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 200; const H = 48;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');
  const fillPts = `0,${H} ${pts} ${W},${H}`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill="url(#spark-fill)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OverviewView({
  stats,
  growth,
  merchantProfile,
  tierColor,
  onNavigate,
}: {
  stats: MerchantStats | null;
  growth: GrowthIntelligenceReport | null;
  merchantProfile: MerchantProfile | null;
  tierColor: string;
  onNavigate: (v: ViewId) => void;
}) {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const initials = (merchantProfile?.shopName ?? 'MS').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const statCards = [
    { icon: 'inventory_2',  label: 'Total Products',   value: stats?.totalProducts   ?? 12, color: '#c3c0ff' },
    { icon: 'receipt_long', label: 'Platform Orders',  value: stats?.totalOrders     ?? 59, color: '#fbbf24' },
    { icon: 'check_circle', label: 'Completed',        value: stats?.completedOrders ?? 47, color: '#4ade80' },
    { icon: 'pending',      label: 'Pending Approval', value: stats?.pendingApprovals ?? 3,  color: '#f87171' },
  ];

  const totalRevenue = stats?.totalRevenue ?? 691974;

  const quickActions = [
    { icon: 'add_box',      label: 'Add Product',    color: '#fbbf24', view: 'products'   as ViewId },
    { icon: 'auto_graph',   label: 'AI Growth',      color: '#c3c0ff', view: 'growth'     as ViewId },
    { icon: 'receipt_long', label: 'View Orders',    color: '#4ade80', view: 'orders'     as ViewId },
    { icon: 'insights',     label: 'Analytics',      color: '#f87171', view: 'analytics'  as ViewId },
  ];

  return (
    <div>
      {/* ── Hero Banner ─────────────────────────────────────── */}
      <div className="fade-up" style={{
        background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(195,192,255,0.06) 100%)',
        border: '1px solid rgba(251,191,36,0.15)',
        borderRadius: '20px',
        padding: '24px 28px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px', flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(251,191,36,0.3), rgba(195,192,255,0.2))',
          border: '1px solid rgba(251,191,36,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', fontWeight: 800, color: '#fbbf24', fontFamily: "'Space Grotesk', sans-serif",
        }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '12px', color: 'rgba(251,191,36,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '4px' }}>Merchant Portal</p>
          <h1 className="font-display" style={{ fontSize: '26px', color: 'var(--text-1)', marginBottom: '4px' }}>
            {merchantProfile?.shopName ?? 'Your Shop'}
          </h1>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {merchantProfile?.category && <span className="badge badge-neutral">{merchantProfile.category}</span>}
            <span style={{ fontSize: '11px', color: tierColor, background: `${tierColor}18`, border: `1px solid ${tierColor}40`, borderRadius: '20px', padding: '2px 10px', fontWeight: 700 }}>
              {merchantProfile?.trustTier ?? 'UNRATED'}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.4)', marginBottom: '4px' }}>Total Revenue (Demo)</p>
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#4ade80', fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(totalRevenue)}</p>
          <p style={{ fontSize: '11px', color: 'rgba(74,222,128,0.5)', marginTop: '2px' }}>↑ 22% vs last month</p>
        </div>
      </div>

      {/* ── Stat Grid ───────────────────────────────────────── */}
      <div className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {statCards.map(sc => (
          <div key={sc.label} className="stat-card">
            <div className="stat-label">
              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: sc.color }}>{sc.icon}</span>
              {sc.label}
            </div>
            <p className="stat-value" style={{ color: sc.color }}>{sc.value}</p>
          </div>
        ))}
      </div>

      {/* ── Revenue Sparkline ───────────────────────────────── */}
      <div className="fade-up delay-2">
        <Card style={{ marginBottom: '24px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.5)', fontWeight: 600, marginBottom: '4px' }}>Revenue Trend · Last 12 Months</p>
              <p style={{ fontSize: '22px', fontWeight: 800, color: '#fbbf24', fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(DEMO_REVENUE_SPARKLINE[DEMO_REVENUE_SPARKLINE.length - 1] * 10)}</p>
            </div>
            <span style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '20px', padding: '4px 10px', fontWeight: 700 }}>↑ 28% YoY</span>
          </div>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 0, alignItems: 'flex-end', height: '70px', paddingBottom: '4px' }}>
              {DEMO_REVENUE_SPARKLINE.map((v, i) => {
                const max = Math.max(...DEMO_REVENUE_SPARKLINE);
                const h = Math.round((v / max) * 60) + 10;
                const isLast = i === DEMO_REVENUE_SPARKLINE.length - 1;
                return (
                  <div key={i} title={`${DEMO_REVENUE_LABELS[i]}: ₹${(v * 10).toLocaleString('en-IN')}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'default' }}>
                    <div style={{
                      width: '80%', height: `${h}px`,
                      background: isLast
                        ? 'linear-gradient(180deg, #fbbf24, rgba(251,191,36,0.4))'
                        : 'rgba(251,191,36,0.18)',
                      borderRadius: '4px 4px 0 0',
                      border: isLast ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(251,191,36,0.1)',
                      transition: 'opacity 0.2s',
                    }} />
                    <span style={{ fontSize: '9px', color: 'rgba(232,230,255,0.3)', whiteSpace: 'nowrap' }}>{DEMO_REVENUE_LABELS[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Insight Cards ───────────────────────────────────── */}
      <div className="fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {DEMO_INSIGHT_CARDS.map(c => (
          <Card key={c.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: c.color }}>{c.icon}</span>
              <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.5)', fontWeight: 600 }}>{c.label}</p>
            </div>
            <p style={{ fontSize: '22px', fontWeight: 800, color: c.color, fontFamily: "'Space Grotesk', sans-serif" }}>{c.value}</p>
            <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.35)', marginTop: '4px' }}>{c.sub}</p>
          </Card>
        ))}
      </div>

      {/* ── Quick Actions ───────────────────────────────────── */}
      <div className="fade-up delay-3" style={{ marginBottom: '24px' }}>
        <SectionTitle icon="bolt" label="Quick Actions" color="#fbbf24" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {quickActions.map(a => (
            <button
              key={a.label}
              onClick={() => onNavigate(a.view)}
              style={{
                padding: '16px 10px', borderRadius: '14px', cursor: 'pointer',
                background: `${a.color}0d`, border: `1px solid ${a.color}28`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                transition: 'transform 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${a.color}1a`; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${a.color}0d`; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: a.color }}>{a.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(232,230,255,0.7)' }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Top Products ────────────────────────────────────── */}
      <div className="fade-up delay-3" style={{ marginBottom: '24px' }}>
        <SectionTitle icon="star" label="Top Performing Products" color="#fbbf24" />
        <Card>
          {DEMO_TOP_PRODUCTS.map((p, i) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < DEMO_TOP_PRODUCTS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span style={{ width: '22px', fontSize: '13px', fontWeight: 800, color: i === 0 ? '#fbbf24' : 'rgba(232,230,255,0.3)', textAlign: 'center' }}>#{i + 1}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#e8e6ff' }}>{p.name}</p>
                <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.35)' }}>{p.orders} orders</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24', fontFamily: "'Space Grotesk', sans-serif" }}>₹{p.revenue.toLocaleString('en-IN')}</p>
                <p style={{ fontSize: '11px', color: '#4ade80' }}>{p.trend}</p>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* ── Recent Activity ─────────────────────────────────── */}
      <div className="fade-up delay-3" style={{ marginBottom: '24px' }}>
        <SectionTitle icon="history" label="Recent Activity" color="#c3c0ff" />
        <Card>
          {DEMO_RECENT_ACTIVITY.map((a, i) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 0', borderBottom: i < DEMO_RECENT_ACTIVITY.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: `${a.color}12`, border: `1px solid ${a.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: a.color }}>{a.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#e8e6ff' }}>{a.text}</p>
                <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.4)', marginTop: '2px' }}>{a.sub}</p>
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(232,230,255,0.25)', whiteSpace: 'nowrap', flexShrink: 0 }}>{a.time}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* ── AI Growth Quick Summary ─────────────────────────── */}
      {growth && (
        <div>
          <SectionTitle icon="auto_graph" label="AI Growth Snapshot" color="#fbbf24" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {[
              { icon: 'trending_up',   color: '#fbbf24', title: 'Top Picks',   count: growth.topRecommended.length         || 8,  note: growth.topRecommended[0]?.name        ?? 'Sony WH-1000XM5' },
              { icon: 'arrow_upward',  color: '#c3c0ff', title: 'Upsell Opps', count: growth.upsellOpportunities.length    || 5,  note: growth.upsellOpportunities[0]?.category ?? 'Electronics'  },
              { icon: 'hub',           color: '#4ade80', title: 'Cross-Sell',  count: growth.crossSellOpportunities.length || 4,  note: growth.crossSellOpportunities[0]?.primaryCategory ?? 'Audio' },
              { icon: 'shopping_cart', color: '#f87171', title: 'Abandoned',   count: growth.abandonedCartSignals.length   || 2,  note: growth.abandonedCartSignals.length > 0 ? 'Needs attention' : '2 carts stalled' },
              { icon: 'campaign',      color: '#fbbf24', title: 'Campaigns',   count: growth.campaignSuggestions.length    || 3,  note: growth.campaignSuggestions[0]?.suggestedAction ?? 'CROSS_PROMOTE' },
            ].map(g => (
              <Card key={g.title}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: g.color }}>{g.icon}</span>
                  <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.5)', fontWeight: 600 }}>{g.title}</p>
                </div>
                <p style={{ fontSize: '22px', fontWeight: 800, color: g.color, fontFamily: "'Space Grotesk', sans-serif" }}>{g.count}</p>
                <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.35)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.note}</p>
              </Card>
            ))}
          </div>
          <DemoTag text={growth.dataNote} />
        </div>
      )}

      <DemoTag text="Revenue, activity and top products include demo data for illustration." />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: Products (Phase 10E — full management)
// ─────────────────────────────────────────────────────────────

interface OwnProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  deliveryDays: number;
  rating: number;
  tags: string[];
  description: string;
  availability: string;
  createdAt: string;
}

interface AIProductSuggestion {
  suggestedTags: string[];
  suggestedDescription: string;
  suggestedPrice: number;
  pricingRationale: string;
  positioningNote: string;
  searchKeywords: string[];
}

type ProdSubView = 'list' | 'add' | 'preview';

interface ProductFormData {
  name: string;
  description: string;
  category: string;
  price: string;
  stock: string;
  deliveryDays: string;
  tags: string;
}

const EMPTY_FORM: ProductFormData = {
  name: '', description: '', category: '', price: '', stock: '0', deliveryDays: '7', tags: '',
};

function InputField({
  label, id, value, onChange, type = 'text', placeholder = '', hint = '', multiline = false, required = false,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string; multiline?: boolean; required?: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', padding: '10px 12px', color: '#e8e6ff', fontSize: '14px',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };
  return (
    <div style={{ marginBottom: '16px' }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: '12px', color: 'rgba(232,230,255,0.5)', marginBottom: '6px', fontWeight: 600 }}>
        {label}{required && <span style={{ color: '#f87171', marginLeft: '4px' }}>*</span>}
      </label>
      {multiline
        ? <textarea id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4} style={{ ...baseStyle, resize: 'vertical' }} />
        : <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={baseStyle} />
      }
      {hint && <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.3)', marginTop: '4px' }}>{hint}</p>}
    </div>
  );
}

function ProductsView({ growth }: { growth: GrowthIntelligenceReport | null }) {
  const [subView, setSubView] = useState<ProdSubView>('list');
  const [products, setProducts] = useState<OwnProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AIProductSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [priceDecision, setPriceDecision] = useState<'accepted' | 'rejected' | null>(null);
  const [editedPrice, setEditedPrice] = useState<string>('');

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const loadProducts = useCallback(() => {
    setLoading(true);
    fetch('/api/merchant/products')
      .then(r => r.json())
      .then(d => { setProducts(d.products ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const setField = (key: keyof ProductFormData) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'Product name is required';
    if (!form.description.trim() || form.description.trim().length < 10) return 'Description must be at least 10 characters';
    if (!form.category.trim()) return 'Category is required';
    const price = Number(form.price);
    if (isNaN(price) || price <= 0) return 'Price must be a positive number';
    const stock = Number(form.stock);
    if (isNaN(stock) || !Number.isInteger(stock) || stock < 0) return 'Stock must be a non-negative whole number';
    const delivery = Number(form.deliveryDays);
    if (isNaN(delivery) || delivery < 1 || delivery > 30) return 'Delivery days must be between 1 and 30';
    return null;
  };

  const handleSave = async () => {
    const err = validateForm();
    if (err) { setFormError(err); return; }
    setFormError(null);
    setSaving(true);
    const payload = {
      name: form.name.trim(), description: form.description.trim(), category: form.category.trim(),
      price: Number(form.price), stock: Number(form.stock), deliveryDays: Number(form.deliveryDays),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    try {
      const url = editingId ? `/api/merchant/products/${editingId}` : '/api/merchant/products';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? 'Failed to save product'); setSaving(false); return; }
      loadProducts();
      setSubView('list');
      setForm(EMPTY_FORM);
      setEditingId(null);
      setAiSuggestion(null);
      setPriceDecision(null);
    } catch { setFormError('Network error — could not save product'); }
    setSaving(false);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this product? It will no longer be discoverable by AI buyers.')) return;
    await fetch(`/api/merchant/products/${id}/deactivate`, { method: 'POST' });
    loadProducts();
  };

  const handleEdit = (p: OwnProduct) => {
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description, category: p.category, price: String(p.price), stock: String(p.stock), deliveryDays: String(p.deliveryDays), tags: p.tags.join(', ') });
    setAiSuggestion(null); setPriceDecision(null); setFormError(null);
    setSubView('add');
  };

  const handleGetAISuggestions = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.category.trim()) { setAiError('Fill in Name, Description and Category first'); return; }
    setAiLoading(true); setAiError(null); setPriceDecision(null);
    try {
      const res = await fetch('/api/merchant/products/ai-suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, description: form.description, category: form.category, currentPrice: form.price ? Number(form.price) : undefined }) });
      const d = await res.json();
      if (!res.ok) setAiError(d.error ?? 'AI suggestions unavailable');
      else setAiSuggestion(d.suggestion);
    } catch { setAiError('Could not reach AI service'); }
    setAiLoading(false);
  };

  const upsellIds = new Set(growth?.upsellOpportunities.map(u => u.id) ?? []);
  const topIds = new Set(growth?.topRecommended.map(t => t.id) ?? []);

  // ── List ─────────────────────────────────────────────────────
  if (subView === 'list') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <SectionTitle icon="inventory_2" label="My Products" color="#c3c0ff" />
          <button id="add-product-btn" onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setAiSuggestion(null); setFormError(null); setSubView('add'); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '10px', color: '#fbbf24', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span> Add Product
          </button>
        </div>
        {loading ? <LoadingPulse /> : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'rgba(232,230,255,0.2)', display: 'block', marginBottom: '12px' }}>inventory_2</span>
            <p style={{ fontSize: '15px', color: 'rgba(232,230,255,0.3)', marginBottom: '16px' }}>No products yet.</p>
            <button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setAiSuggestion(null); setFormError(null); setSubView('add'); }} style={{ padding: '10px 24px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '10px', color: '#fbbf24', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Add your first product</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {products.map(p => (
              <Card key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: '#e8e6ff' }}>{p.name}</p>
                      {topIds.has(p.id) && <span style={{ fontSize: '10px', fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '20px', padding: '2px 8px' }}>AI TOP PICK</span>}
                      {upsellIds.has(p.id) && <span style={{ fontSize: '10px', fontWeight: 700, color: '#c3c0ff', background: 'rgba(195,192,255,0.1)', border: '1px solid rgba(195,192,255,0.25)', borderRadius: '20px', padding: '2px 8px' }}>UPSELL</span>}
                      <span style={{ fontSize: '10px', fontWeight: 700, color: p.availability === 'IN_STOCK' ? '#4ade80' : '#f87171', background: p.availability === 'IN_STOCK' ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', borderRadius: '20px', padding: '2px 8px' }}>{p.availability === 'IN_STOCK' ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>{p.category}</span>
                      <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>Stock: {p.stock}</span>
                      <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>{p.deliveryDays}d delivery</span>
                      {p.rating > 0 && <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>⭐ {p.rating}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <p style={{ fontSize: '18px', fontWeight: 700, color: '#fbbf24', fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(p.price)}</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button id={`edit-product-${p.id}`} onClick={() => handleEdit(p)} style={{ padding: '5px 12px', background: 'rgba(195,192,255,0.08)', border: '1px solid rgba(195,192,255,0.2)', borderRadius: '8px', color: '#c3c0ff', fontSize: '12px', cursor: 'pointer' }}>Edit</button>
                      {p.availability === 'IN_STOCK' && <button id={`deactivate-product-${p.id}`} onClick={() => handleDeactivate(p.id)} style={{ padding: '5px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', color: '#f87171', fontSize: '12px', cursor: 'pointer' }}>Deactivate</button>}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Add / Edit ────────────────────────────────────────────────
  if (subView === 'add') {
    return (
      <div style={{ maxWidth: '580px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => { setSubView('list'); setEditingId(null); setAiSuggestion(null); }} style={{ background: 'none', border: 'none', color: 'rgba(232,230,255,0.5)', cursor: 'pointer', padding: '4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
          </button>
          <SectionTitle icon={editingId ? 'edit' : 'add_box'} label={editingId ? 'Edit Product' : 'Add Product'} color="#c3c0ff" />
        </div>

        <InputField required id="prod-name" label="Product Name" value={form.name} onChange={setField('name')} placeholder="e.g. Sony WH-1000XM5 Headphones" />
        <InputField required id="prod-desc" label="Description" value={form.description} onChange={setField('description')} placeholder="Describe the product (min 10 characters)" multiline />
        <InputField required id="prod-cat" label="Category" value={form.category} onChange={setField('category')} placeholder="e.g. electronics, footwear" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <InputField required id="prod-price" label="Price (₹)" value={form.price} onChange={setField('price')} type="number" placeholder="e.g. 4999" />
          <InputField required id="prod-stock" label="Stock" value={form.stock} onChange={setField('stock')} type="number" placeholder="e.g. 50" />
        </div>
        <InputField required id="prod-delivery" label="Delivery Days" value={form.deliveryDays} onChange={setField('deliveryDays')} type="number" placeholder="e.g. 5" hint="1–30 days" />
        <InputField id="prod-tags" label="Tags" value={form.tags} onChange={setField('tags')} placeholder="wireless, noise-cancelling, premium" hint="Comma-separated — helps AI buyers discover your product" />

        {/* AI Suggestions */}
        <Card style={{ marginBottom: '20px', border: '1px solid rgba(195,192,255,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#c3c0ff' }}>auto_awesome</span>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#c3c0ff' }}>AI Assistant</p>
            </div>
            <button id="get-ai-suggestions-btn" onClick={handleGetAISuggestions} disabled={aiLoading} style={{ padding: '7px 14px', background: aiLoading ? 'rgba(195,192,255,0.04)' : 'rgba(195,192,255,0.1)', border: '1px solid rgba(195,192,255,0.25)', borderRadius: '8px', color: aiLoading ? 'rgba(195,192,255,0.4)' : '#c3c0ff', fontSize: '12px', fontWeight: 600, cursor: aiLoading ? 'default' : 'pointer' }}>
              {aiLoading ? 'Getting suggestions…' : 'Get AI Suggestions'}
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.35)' }}>Fill Name, Description and Category above, then click to get AI-suggested tags, description, and price.</p>
          {aiError && <p style={{ fontSize: '12px', color: '#f87171', marginTop: '10px' }}>{aiError}</p>}

          {aiSuggestion && (
            <div style={{ marginTop: '16px' }}>
              {/* Tags */}
              <div style={{ marginBottom: '14px' }}>
                <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.4)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suggested Tags</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {aiSuggestion.suggestedTags.map(t => <span key={t} style={{ fontSize: '12px', color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '20px', padding: '3px 10px' }}>{t}</span>)}
                </div>
                <button id="accept-ai-tags" onClick={() => setForm(f => ({ ...f, tags: aiSuggestion.suggestedTags.join(', ') }))} style={{ fontSize: '12px', color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer' }}>Apply Tags</button>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '14px' }}>
                <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.4)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suggested Description</p>
                <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.6)', lineHeight: 1.5, marginBottom: '8px' }}>{aiSuggestion.suggestedDescription}</p>
                <button id="accept-ai-description" onClick={() => setForm(f => ({ ...f, description: aiSuggestion.suggestedDescription }))} style={{ fontSize: '12px', color: '#c3c0ff', background: 'rgba(195,192,255,0.08)', border: '1px solid rgba(195,192,255,0.2)', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer' }}>Use This Description</button>
              </div>

              {/* Price — Accept / Edit / Reject */}
              <div style={{ padding: '14px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: '12px' }}>
                <p style={{ fontSize: '11px', color: 'rgba(251,191,36,0.6)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suggested Price</p>
                <p style={{ fontSize: '22px', fontWeight: 800, color: '#fbbf24', fontFamily: "'Space Grotesk', sans-serif", marginBottom: '4px' }}>{fmt(aiSuggestion.suggestedPrice)}</p>
                <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.5)', lineHeight: 1.5, marginBottom: '12px' }}>{aiSuggestion.pricingRationale}</p>
                {priceDecision === null && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button id="accept-ai-price" onClick={() => { setForm(f => ({ ...f, price: String(aiSuggestion.suggestedPrice) })); setPriceDecision('accepted'); }} style={{ padding: '7px 16px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '8px', color: '#4ade80', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>✓ Accept</button>
                    <input id="edit-ai-price" type="number" placeholder="Enter custom price" value={editedPrice} onChange={e => setEditedPrice(e.target.value)} style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e8e6ff', fontSize: '13px', width: '150px', fontFamily: 'inherit', outline: 'none' }} />
                    <button id="apply-edited-price" onClick={() => { const v = Number(editedPrice); if (v > 0) { setForm(f => ({ ...f, price: String(v) })); setPriceDecision('accepted'); } }} style={{ padding: '7px 14px', background: 'rgba(195,192,255,0.1)', border: '1px solid rgba(195,192,255,0.25)', borderRadius: '8px', color: '#c3c0ff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Apply Custom</button>
                    <button id="reject-ai-price" onClick={() => setPriceDecision('rejected')} style={{ padding: '7px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', color: '#f87171', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>✕ Reject</button>
                  </div>
                )}
                {priceDecision === 'accepted' && <p style={{ fontSize: '13px', color: '#4ade80' }}>✓ Price applied: {form.price ? fmt(Number(form.price)) : '—'}</p>}
                {priceDecision === 'rejected' && <p style={{ fontSize: '13px', color: '#f87171' }}>✕ Suggestion rejected. Current price: {form.price ? fmt(Number(form.price)) : 'not set'}</p>}
              </div>

              {/* Positioning */}
              <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.35)', marginBottom: '4px', fontWeight: 600 }}>AI POSITIONING NOTE</p>
                <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.5)', lineHeight: 1.5 }}>{aiSuggestion.positioningNote}</p>
              </div>
            </div>
          )}
        </Card>

        {formError && <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', marginBottom: '16px' }}><p style={{ fontSize: '13px', color: '#f87171' }}>{formError}</p></div>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button id="preview-product-btn" onClick={() => { const err = validateForm(); if (err) { setFormError(err); return; } setFormError(null); setSubView('preview'); }} style={{ flex: 1, padding: '12px', background: 'rgba(195,192,255,0.08)', border: '1px solid rgba(195,192,255,0.2)', borderRadius: '12px', color: '#c3c0ff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Preview</button>
          <button id="save-product-btn" onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '12px', background: saving ? 'rgba(251,191,36,0.04)' : 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '12px', color: saving ? 'rgba(251,191,36,0.4)' : '#fbbf24', fontSize: '14px', fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Publish Product'}
          </button>
        </div>
      </div>
    );
  }

  // ── Preview ───────────────────────────────────────────────────
  if (subView === 'preview') {
    const previewTags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    return (
      <div style={{ maxWidth: '580px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => setSubView('add')} style={{ background: 'none', border: 'none', color: 'rgba(232,230,255,0.5)', cursor: 'pointer', padding: '4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
          </button>
          <SectionTitle icon="visibility" label="Product Preview" color="#4ade80" />
        </div>
        <p style={{ fontSize: '12px', color: 'rgba(74,222,128,0.6)', marginBottom: '20px' }}>This is how the AI Buyer will see your product after publishing.</p>
        <Card style={{ marginBottom: '16px', border: '1px solid rgba(74,222,128,0.15)' }}>
          <p style={{ fontSize: '22px', fontWeight: 800, color: '#e8e6ff', fontFamily: "'Space Grotesk', sans-serif", marginBottom: '8px' }}>{form.name || '—'}</p>
          <p style={{ fontSize: '24px', fontWeight: 700, color: '#fbbf24', fontFamily: "'Space Grotesk', sans-serif", marginBottom: '12px' }}>{form.price ? fmt(Number(form.price)) : '—'}</p>
          <p style={{ fontSize: '14px', color: 'rgba(232,230,255,0.6)', lineHeight: 1.6, marginBottom: '16px' }}>{form.description || '—'}</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.5)' }}>Category: <strong style={{ color: '#e8e6ff' }}>{form.category || '—'}</strong></span>
            <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.5)' }}>Stock: <strong style={{ color: '#e8e6ff' }}>{form.stock}</strong></span>
            <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.5)' }}>Delivery: <strong style={{ color: '#e8e6ff' }}>{form.deliveryDays} days</strong></span>
          </div>
          {previewTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {previewTags.map(t => <span key={t} style={{ fontSize: '11px', color: 'rgba(232,230,255,0.5)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '3px 10px' }}>{t}</span>)}
            </div>
          )}
        </Card>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setSubView('add')} style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'rgba(232,230,255,0.5)', fontSize: '14px', cursor: 'pointer' }}>Back to Edit</button>
          <button id="publish-from-preview-btn" onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '12px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '12px', color: '#4ade80', fontSize: '14px', fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Publishing…' : editingId ? 'Save Changes' : '✓ Publish Product'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}




// ─────────────────────────────────────────────────────────────
// View: AI Growth
// ─────────────────────────────────────────────────────────────

type GrowthTab = 'top' | 'upsell' | 'crosssell' | 'abandoned' | 'campaigns';

function GrowthView({ growth, loading }: { growth: GrowthIntelligenceReport | null; loading: boolean }) {
  const [tab, setTab] = useState<GrowthTab>('top');
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const tabs: { id: GrowthTab; label: string; icon: string; color: string }[] = [
    { id: 'top',       label: 'Top Picks',  icon: 'trending_up',   color: '#fbbf24' },
    { id: 'upsell',    label: 'Upsell',     icon: 'arrow_upward',  color: '#c3c0ff' },
    { id: 'crosssell', label: 'Cross-Sell', icon: 'hub',           color: '#4ade80' },
    { id: 'abandoned', label: 'Abandoned',  icon: 'shopping_cart', color: '#f87171' },
    { id: 'campaigns', label: 'Campaigns',  icon: 'campaign',      color: '#fbbf24' },
  ];

  if (loading) return <LoadingPulse />;
  if (!growth) return <EmptyState icon="auto_graph" message="AI Growth data unavailable." />;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#fbbf24' }}>auto_graph</span>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e8e6ff', fontFamily: "'Space Grotesk', sans-serif" }}>AI Growth Intelligence</h2>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            id={`growth-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '10px', cursor: 'pointer',
              border: tab === t.id ? `1px solid ${t.color}33` : '1px solid rgba(255,255,255,0.06)',
              background: tab === t.id ? `${t.color}12` : 'rgba(18,18,28,0.5)',
              color: tab === t.id ? t.color : 'rgba(232,230,255,0.5)',
              fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Top Recommended */}
      {tab === 'top' && (
        <div>
          {growth.topRecommended.length === 0
            ? <EmptyState icon="trending_up" message="No top picks available yet." />
            : growth.topRecommended.map((p: TopRecommendedProduct) => {
                const sig = SIGNAL_LABEL_META[p.signalLabel] ?? { color: '#94a3b8', label: p.signalLabel };
                return (
                  <Card key={p.id} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <p style={{ fontSize: '15px', fontWeight: 600, color: '#e8e6ff' }}>{p.name}</p>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: sig.color, background: `${sig.color}18`, border: `1px solid ${sig.color}40`, borderRadius: '20px', padding: '2px 8px' }}>{sig.label.toUpperCase()}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>{p.category}</span>
                          <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>⭐ {p.rating}</span>
                          <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>{p.merchantName}</span>
                        </div>
                      </div>
                      <p style={{ fontSize: '18px', fontWeight: 700, color: '#fbbf24', fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap' }}>{fmt(p.price)}</p>
                    </div>
                  </Card>
                );
              })}
        </div>
      )}

      {/* Tab: Upsell */}
      {tab === 'upsell' && (
        <div>
          {growth.upsellOpportunities.length === 0
            ? <EmptyState icon="arrow_upward" message="No upsell opportunities identified." />
            : growth.upsellOpportunities.map((u: UpsellOpportunity) => (
                <Card key={u.id} style={{ marginBottom: '10px', border: '1px solid rgba(195,192,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: '#e8e6ff', marginBottom: '4px' }}>{u.name}</p>
                      <p style={{ fontSize: '13px', color: '#c3c0ff', marginBottom: '4px' }}>{u.upsellReason}</p>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>{u.category}</span>
                        <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>Category avg: {fmt(u.medianCategoryPrice)}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '18px', fontWeight: 700, color: '#c3c0ff', fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(u.price)}</p>
                      <p style={{ fontSize: '11px', color: 'rgba(195,192,255,0.5)', marginTop: '2px' }}>{u.premiumFactor}x avg</p>
                    </div>
                  </div>
                </Card>
              ))}
        </div>
      )}

      {/* Tab: Cross-Sell */}
      {tab === 'crosssell' && (
        <div>
          {growth.crossSellOpportunities.length === 0
            ? <EmptyState icon="hub" message="No cross-sell pairs identified." />
            : growth.crossSellOpportunities.map((cs: CrossSellPair) => (
                <Card key={`${cs.primaryCategory}-${cs.complementaryCategory}`} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.1)', borderRadius: '8px', padding: '4px 10px', textTransform: 'capitalize' }}>{cs.primaryCategory}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'rgba(232,230,255,0.3)' }}>arrow_forward</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.1)', borderRadius: '8px', padding: '4px 10px', textTransform: 'capitalize' }}>{cs.complementaryCategory}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(232,230,255,0.3)', marginLeft: 'auto' }}>overlap: {Math.round(cs.tagOverlapScore * 100)}%</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.6)', marginBottom: '10px' }}>{cs.suggestion}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[{ label: 'Example', product: cs.examplePrimary }, { label: 'Complements with', product: cs.exampleComplement }].map(ex => (
                      <div key={ex.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px' }}>
                        <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.3)', marginBottom: '4px' }}>{ex.label}</p>
                        <p style={{ fontSize: '13px', color: '#e8e6ff', fontWeight: 600 }}>{ex.product.name}</p>
                        <p style={{ fontSize: '12px', color: '#4ade80' }}>₹{ex.product.price.toLocaleString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
        </div>
      )}

      {/* Tab: Abandoned */}
      {tab === 'abandoned' && (
        <div>
          {growth.abandonedCartSignals.length === 0
            ? <EmptyState icon="shopping_cart" message="No abandoned sessions detected. All clear!" />
            : growth.abandonedCartSignals.map((a: AbandonedCartSignal) => (
                <Card key={a.transactionId} style={{ marginBottom: '10px', border: '1px solid rgba(248,113,113,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: '#e8e6ff', marginBottom: '4px' }}>{a.productName}</p>
                      <StateBadge state={a.state} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '16px', fontWeight: 700, color: '#f87171', fontFamily: "'Space Grotesk', sans-serif" }}>₹{a.productPrice.toLocaleString('en-IN')}</p>
                      <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.3)', marginTop: '2px' }}>{a.ageMinutes}m ago</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(248,113,113,0.05)', borderRadius: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#f87171' }}>lightbulb</span>
                    <p style={{ fontSize: '12px', color: 'rgba(248,113,113,0.7)' }}>{a.recoveryHint}</p>
                  </div>
                </Card>
              ))}
        </div>
      )}

      {/* Tab: Campaigns */}
      {tab === 'campaigns' && (
        <div>
          {growth.campaignSuggestions.length === 0
            ? <EmptyState icon="campaign" message="No campaign suggestions available." />
            : growth.campaignSuggestions.map((c: CampaignSuggestion) => {
                const color = ACTION_COLORS[c.suggestedAction] ?? '#94a3b8';
                return (
                  <Card key={c.category} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color, background: `${color}15`, border: `1px solid ${color}30`, borderRadius: '8px', padding: '3px 10px' }}>{c.suggestedAction.replace('_', ' ')}</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#e8e6ff', textTransform: 'capitalize' }}>{c.category}</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.6)', lineHeight: 1.5 }}>{c.suggestion}</p>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.35)' }}>{c.productCount} products</span>
                          <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.35)' }}>avg ⭐ {c.avgRating}</span>
                          <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.35)' }}>₹{c.priceRange.min.toLocaleString('en-IN')}–₹{c.priceRange.max.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
        </div>
      )}

      <DemoTag text={growth.dataNote} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: Orders
// ─────────────────────────────────────────────────────────────

function ResultIcon({ result }: { result: 'SUCCESS' | 'FAILURE' | 'INFO' | 'WARNING' }) {
  if (result === 'SUCCESS') return <span className="material-symbols-outlined" style={{ color: '#4ade80', fontSize: '16px' }}>check_circle</span>;
  if (result === 'FAILURE') return <span className="material-symbols-outlined" style={{ color: '#f87171', fontSize: '16px' }}>cancel</span>;
  if (result === 'WARNING') return <span className="material-symbols-outlined" style={{ color: '#fbbf24', fontSize: '16px' }}>warning</span>;
  return <span className="material-symbols-outlined" style={{ color: 'rgba(232,230,255,0.4)', fontSize: '16px' }}>info</span>;
}

const formatDate = (ds: string) => new Date(ds).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
const formatTime = (ds: string) => new Date(ds).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

function OrdersView() {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dataNote, setDataNote] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ transaction: Transaction; auditEvents: AuditEvent[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/merchant/orders?page=${page}&limit=15`)
      .then(r => r.json())
      .then(d => {
        setOrders(d.orders ?? []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
        setDataNote(d.dataNote ?? '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  const openDetail = async (id: string) => {
    if (selectedId === id) { setSelectedId(null); setDetail(null); return; }
    setSelectedId(id);
    // Demo orders don't have real API rows — skip fetch
    if (id.startsWith('demo-')) return;
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/merchant/orders/${id}`);
      if (res.ok) { const d = await res.json(); setDetail(d); }
    } finally { setDetailLoading(false); }
  };

  // Merge real orders with demo orders (demo ones shown when real list is empty)
  const displayOrders = orders.length > 0 ? orders : DEMO_ORDERS;
  const displayTotal  = orders.length > 0 ? total  : DEMO_ORDERS.length;
  const isDemo        = orders.length === 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <SectionTitle icon="receipt_long" label="Platform Orders" color="#fbbf24" />
        {/* Summary pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { label: 'Completed', count: displayOrders.filter(o => o.state === 'COMPLETED' || o.state === 'VERIFIED' || o.state === 'PAYMENT_SUCCESS').length, color: '#4ade80' },
            { label: 'Pending',   count: displayOrders.filter(o => o.state === 'PAYMENT_PENDING' || o.state === 'APPROVAL_REQUIRED').length, color: '#fbbf24' },
            { label: 'Failed',    count: displayOrders.filter(o => o.state === 'BLOCKED' || o.state === 'PAYMENT_FAILED').length, color: '#f87171' },
          ].map(s => (
            <span key={s.label} style={{ fontSize: '11px', fontWeight: 700, color: s.color, background: `${s.color}12`, border: `1px solid ${s.color}30`, borderRadius: '20px', padding: '3px 10px' }}>
              {s.label} · {s.count}
            </span>
          ))}
        </div>
      </div>

      {loading
        ? <LoadingPulse />
        : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.4)' }}>{displayTotal} order{displayTotal !== 1 ? 's' : ''} total</p>
                {isDemo && <span style={{ fontSize: '11px', color: 'rgba(251,191,36,0.5)', fontStyle: 'italic' }}>Demo orders shown — real orders will appear once customers purchase</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {displayOrders.map(o => (
                  <div key={o.id}>
                    <div 
                      onClick={() => openDetail(o.id)}
                      style={{
                        background: selectedId === o.id ? 'rgba(195,192,255,0.06)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${selectedId === o.id ? 'rgba(195,192,255,0.25)' : 'rgba(255,255,255,0.05)'}`,
                        borderRadius: selectedId === o.id ? '16px 16px 0 0' : '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e6ff' }}>{o.productName}</p>
                          <StateBadge state={o.state} />
                          {o.wasNegotiated && (
                            <span style={{ fontSize: '10px', color: '#c3c0ff', background: 'rgba(195,192,255,0.1)', border: '1px solid rgba(195,192,255,0.2)', borderRadius: '20px', padding: '2px 8px', fontWeight: 700 }}>NEGOTIATED</span>
                          )}
                        </div>
                        {o.intentRaw && (
                          <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.35)', marginBottom: '4px' }}>"{o.intentRaw.slice(0, 60)}{o.intentRaw.length > 60 ? '…' : ''}"</p>
                        )}
                        <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.25)' }}>{new Date(o.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '16px', fontWeight: 700, color: '#fbbf24', fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(o.finalPrice)}</p>
                          {o.wasNegotiated && (
                            <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.3)', textDecoration: 'line-through', marginTop: '2px' }}>{fmt(o.productPrice)}</p>
                          )}
                        </div>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'rgba(232,230,255,0.3)', transition: 'transform 0.2s', transform: selectedId === o.id ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                      </div>
                    </div>

                    {/* Detail Panel */}
                    {selectedId === o.id && (
                      <div style={{
                        background: 'rgba(12,12,20,0.9)', border: '1px solid rgba(195,192,255,0.15)', borderTop: 'none',
                        borderRadius: '0 0 16px 16px', padding: '20px 18px',
                      }}>
                        {o.id.startsWith('demo-') && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {o.razorpayPaymentId && (
                              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                                <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.35)', marginBottom: '4px', textTransform: 'uppercase' }}>Payment ID</p>
                                <p style={{ fontSize: '12px', color: '#e8e6ff', fontFamily: 'monospace' }}>{o.razorpayPaymentId}</p>
                              </div>
                            )}
                            {o.wasNegotiated && (
                              <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span className="material-symbols-outlined" style={{ color: '#4ade80', fontSize: '18px' }}>savings</span>
                                <span style={{ fontSize: '13px', color: '#4ade80' }}>AI negotiated price: {fmt(o.finalPrice)} (saved {fmt(o.productPrice - o.finalPrice)})</span>
                              </div>
                            )}
                            {o.failureReason && (
                              <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', padding: '12px' }}>
                                <p style={{ fontSize: '12px', color: '#f87171' }}>{o.failureReason}</p>
                              </div>
                            )}
                            <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.25)', fontStyle: 'italic' }}>Demo order — full audit trail available on real transactions.</p>
                          </div>
                        )}
                        {!o.id.startsWith('demo-') && (<>
                          {detailLoading ? <LoadingPulse /> : detail ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              {/* Payment info */}
                              {detail.transaction.razorpayOrderId && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                                    <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.35)', marginBottom: '4px', textTransform: 'uppercase' }}>Razorpay Order</p>
                                    <p style={{ fontSize: '12px', color: '#e8e6ff', fontFamily: 'monospace' }}>{detail.transaction.razorpayOrderId}</p>
                                  </div>
                                  {detail.transaction.razorpayPaymentId && (
                                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                                      <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.35)', marginBottom: '4px', textTransform: 'uppercase' }}>Payment ID</p>
                                      <p style={{ fontSize: '12px', color: '#e8e6ff', fontFamily: 'monospace' }}>{detail.transaction.razorpayPaymentId}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Negotiation Info */}
                              {detail.transaction.negotiatedPrice && detail.transaction.selectedProductPrice &&
                                detail.transaction.negotiatedPrice < detail.transaction.selectedProductPrice && (
                                  <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span className="material-symbols-outlined" style={{ color: '#4ade80', fontSize: '18px' }}>savings</span>
                                    <span style={{ fontSize: '13px', color: '#4ade80' }}>
                                      AI negotiated price: ₹{detail.transaction.negotiatedPrice.toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                )}
                              {/* Failure reason */}
                              {detail.transaction.failureReason && (
                                <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', padding: '12px' }}>
                                  <p style={{ fontSize: '12px', color: '#f87171' }}>{detail.transaction.failureReason}</p>
                                </div>
                              )}
                              {/* Audit Timeline */}
                              <div>
                                <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Audit Timeline</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {detail.auditEvents.filter(e => e.event !== 'STATE_TRANSITION').map(ev => (
                                    <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                      <ResultIcon result={ev.result} />
                                      <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.75)', lineHeight: 1.5 }}>{ev.reason}</p>
                                        <p style={{ fontSize: '10px', color: 'rgba(232,230,255,0.3)', marginTop: '2px' }}>{formatTime(ev.timestamp)} · {ev.event.replace(/_/g, ' ')}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : <p style={{ color: 'rgba(232,230,255,0.4)', fontSize: '14px' }}>Could not load details.</p>}
                        </>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: page === 1 ? 'rgba(232,230,255,0.2)' : '#e8e6ff', cursor: page === 1 ? 'default' : 'pointer' }}>←</button>
                  <span style={{ padding: '8px 16px', color: 'rgba(232,230,255,0.5)', fontSize: '13px' }}>Page {page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: page === totalPages ? 'rgba(232,230,255,0.2)' : '#e8e6ff', cursor: page === totalPages ? 'default' : 'pointer' }}>→</button>
                </div>
              )}
              <DemoTag text={dataNote} />
            </>
          )
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: Analytics
// ─────────────────────────────────────────────────────────────

const DEMO_CATALOG_CATEGORIES = [
  { name: 'Electronics',   products: 18, revenue: 421800, avgRating: 4.6, minPrice: 1299,  maxPrice: 89990, color: '#c3c0ff' },
  { name: 'Audio',         products: 12, revenue: 198400, avgRating: 4.8, minPrice: 999,   maxPrice: 26990, color: '#fbbf24' },
  { name: 'Wearables',     products: 9,  revenue: 87200,  avgRating: 4.3, minPrice: 1999,  maxPrice: 24900, color: '#4ade80' },
  { name: 'Accessories',   products: 7,  revenue: 32100,  avgRating: 4.1, minPrice: 299,   maxPrice: 4999,  color: '#f87171' },
  { name: 'Smart Home',    products: 5,  revenue: 54300,  avgRating: 4.4, minPrice: 2499,  maxPrice: 14999, color: '#c3c0ff' },
];

const DEMO_CATALOG_HEALTH = [
  { label: 'Products with Tags',       pct: 83, color: '#4ade80' },
  { label: 'Products In Stock',        pct: 91, color: '#fbbf24' },
  { label: 'Products with Rating',     pct: 74, color: '#c3c0ff' },
  { label: 'AI-Optimised Pricing',     pct: 67, color: '#fbbf24' },
];

function AnalyticsView({ growth }: { growth: GrowthIntelligenceReport | null }) {
  const campaigns = (growth?.campaignSuggestions ?? []);
  // Merge real campaign data with demo categories
  const catData = DEMO_CATALOG_CATEGORIES;
  const maxRevenue = Math.max(...catData.map(c => c.revenue), 1);
  const maxRating  = 5;

  const totalRevenue  = catData.reduce((s, c) => s + c.revenue, 0);
  const totalProducts = catData.reduce((s, c) => s + c.products, 0);
  const avgRating     = (catData.reduce((s, c) => s + c.avgRating, 0) / catData.length).toFixed(1);

  return (
    <div>
      <SectionTitle icon="insights" label="Catalog Analytics" color="#c3c0ff" />

      {/* ── Summary cards ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Revenue',  value: `₹${totalRevenue.toLocaleString('en-IN')}`, color: '#4ade80', icon: 'payments'       },
          { label: 'Total Products', value: `${totalProducts}`,                          color: '#c3c0ff', icon: 'inventory_2'    },
          { label: 'Avg Rating',     value: `⭐ ${avgRating}`,                           color: '#fbbf24', icon: 'star'           },
          { label: 'Categories',     value: `${catData.length}`,                         color: '#f87171', icon: 'category'       },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">
              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: s.color }}>{s.icon}</span>
              {s.label}
            </div>
            <p className="stat-value" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Revenue by category bar chart ──────────────────── */}
      <Card style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e6ff', marginBottom: '20px' }}>Revenue by Category</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {catData.map(c => (
            <div key={c.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#e8e6ff', fontWeight: 600 }}>{c.name}</span>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>{c.products} products</span>
                  <span style={{ fontSize: '13px', color: c.color, fontWeight: 700 }}>₹{c.revenue.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div style={{ height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(c.revenue / maxRevenue) * 100}%`, background: `linear-gradient(90deg, ${c.color}cc, ${c.color}66)`, borderRadius: '5px', transition: 'width 0.6s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Rating per category ────────────────────────────── */}
      <Card style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e6ff', marginBottom: '16px' }}>Avg Rating per Category</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[...catData].sort((a, b) => b.avgRating - a.avgRating).map(c => (
            <div key={c.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#e8e6ff' }}>{c.name}</span>
                <span style={{ fontSize: '13px', color: c.avgRating >= 4.5 ? '#4ade80' : c.avgRating >= 4.0 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>⭐ {c.avgRating}</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(c.avgRating / maxRating) * 100}%`, background: c.avgRating >= 4.5 ? '#4ade80' : c.avgRating >= 4.0 ? '#fbbf24' : '#f87171', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Catalog Health Score ───────────────────────────── */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e6ff' }}>Catalog Health Score</p>
          <span style={{ fontSize: '20px', fontWeight: 800, color: '#4ade80', fontFamily: "'Space Grotesk', sans-serif" }}>79<span style={{ fontSize: '13px', color: 'rgba(74,222,128,0.6)' }}>/100</span></span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {DEMO_CATALOG_HEALTH.map(h => (
            <div key={h.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.6)' }}>{h.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: h.color }}>{h.pct}%</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${h.pct}%`, background: h.color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Price ranges ───────────────────────────────────── */}
      <Card style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e6ff', marginBottom: '16px' }}>Price Range per Category</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {catData.map(c => (
            <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#e8e6ff', flex: 1 }}>{c.name}</span>
              <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.5)' }}>₹{c.minPrice.toLocaleString('en-IN')} – ₹{c.maxPrice.toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      </Card>

      {campaigns.length > 0 && <DemoTag text={growth!.dataNote} />}
      <DemoTag text="Analytics include demo catalog data for illustration." />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: Settings
// ─────────────────────────────────────────────────────────────

function SettingsView({ merchantProfile, tierColor, user, logout }: {
  merchantProfile: MerchantProfile | null;
  tierColor: string;
  user: { name: string; email: string };
  logout: () => void;
}) {
  const initials = (merchantProfile?.shopName ?? user.name ?? 'MS').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const memberSince = new Date(2025, 3, 12).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const infoRows = [
    { label: 'Shop Name',    value: merchantProfile?.shopName    ?? '—'       },
    { label: 'Category',     value: merchantProfile?.category    ?? '—'       },
    { label: 'Member Since', value: memberSince                                },
    { label: 'Plan',         value: 'Merchant Pro (Demo)'                     },
  ];

  return (
    <div style={{ maxWidth: '600px' }}>
      <SectionTitle icon="manage_accounts" label="Shop Settings" color="#fbbf24" />

      {/* ── Profile Hero ───────────────────────────────────── */}
      <Card style={{ marginBottom: '20px', background: 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(195,192,255,0.04))', border: '1px solid rgba(251,191,36,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px', flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(251,191,36,0.3), rgba(195,192,255,0.2))',
            border: '2px solid rgba(251,191,36,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: 800, color: '#fbbf24', fontFamily: "'Space Grotesk', sans-serif",
          }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '20px', fontWeight: 800, color: '#e8e6ff', fontFamily: "'Space Grotesk', sans-serif" }}>{merchantProfile?.shopName ?? user.name}</p>
            <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.5)', marginTop: '2px' }}>{user.email}</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: tierColor, background: `${tierColor}18`, border: `1px solid ${tierColor}40`, borderRadius: '20px', padding: '2px 10px' }}>
                {merchantProfile?.trustTier ?? 'UNRATED'}
              </span>
              {merchantProfile?.category && (
                <span style={{ fontSize: '11px', color: 'rgba(232,230,255,0.5)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '2px 10px' }}>
                  {merchantProfile.category}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Shop Info ─────────────────────────────────────── */}
      <Card style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>Shop Information</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {infoRows.map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.45)' }}>{r.label}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#e8e6ff' }}>{r.value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Trust Tier ────────────────────────────────────── */}
      <Card style={{ marginBottom: '16px', background: `${tierColor}08`, border: `1px solid ${tierColor}25` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <span className="material-symbols-outlined" style={{ color: tierColor, fontSize: '20px' }}>verified_user</span>
          <p style={{ fontSize: '14px', fontWeight: 700, color: tierColor }}>Trust Tier · {merchantProfile?.trustTier ?? 'UNRATED'}</p>
        </div>
        <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', lineHeight: 1.6 }}>
          Trust tier is assigned by the Agentic Commerce platform based on your transaction history, dispute rate, and fulfilment speed.
          Maintain a high tier to appear in AI buyer recommendation pools.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          {['UNRATED','BRONZE','SILVER','GOLD','PLATINUM'].map(t => (
            <span key={t} style={{
              fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
              background: (merchantProfile?.trustTier ?? 'UNRATED') === t ? `${TRUST_TIER_COLORS[t]}25` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${(merchantProfile?.trustTier ?? 'UNRATED') === t ? TRUST_TIER_COLORS[t] : 'rgba(255,255,255,0.08)'}`,
              color: (merchantProfile?.trustTier ?? 'UNRATED') === t ? TRUST_TIER_COLORS[t] : 'rgba(232,230,255,0.25)',
            }}>{t}</span>
          ))}
        </div>
      </Card>

      {/* ── Description ───────────────────────────────────── */}
      {merchantProfile?.shopDescription && (
        <Card style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Shop Description</p>
          <p style={{ fontSize: '14px', color: 'rgba(232,230,255,0.7)', lineHeight: 1.6 }}>{merchantProfile.shopDescription}</p>
        </Card>
      )}

      {/* ── API / Platform Info ───────────────────────────── */}
      <Card style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>Platform Access</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { label: 'AI Catalog Visibility', value: 'Enabled',     color: '#4ade80' },
            { label: 'Razorpay Integration',  value: 'TEST MODE',   color: '#fbbf24' },
            { label: 'Agent-to-Agent Trade',  value: 'Active',      color: '#4ade80' },
            { label: 'Price Negotiation',     value: 'Enabled',     color: '#4ade80' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.5)' }}>{r.label}</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <button
        id="merchant-logout-settings-btn"
        onClick={logout}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 24px', borderRadius: '12px',
          border: '1px solid rgba(248,113,113,0.3)',
          background: 'rgba(248,113,113,0.08)', color: '#f87171',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
        Log Out
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Root Dashboard Component
// ─────────────────────────────────────────────────────────────

export default function MerchantDashboard() {
  const router = useRouter();
  const { user, profile, isLoading, logout } = useAuth();

  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [growth, setGrowth] = useState<GrowthIntelligenceReport | null>(null);
  const [growthLoading, setGrowthLoading] = useState(true);

  const merchantProfile = profile as MerchantProfile | null;
  const tierColor = TRUST_TIER_COLORS[merchantProfile?.trustTier ?? 'UNRATED'] ?? 'rgba(232,230,255,0.4)';

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'MERCHANT')) {
      router.replace('/auth/login?role=MERCHANT');
    }
  }, [user, isLoading, router]);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, growthRes] = await Promise.all([
        fetch('/api/merchant/stats'),
        fetch('/api/merchant-intelligence'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (growthRes.ok) setGrowth(await growthRes.json());
    } catch {
      // Non-fatal
    } finally {
      setGrowthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role === 'MERCHANT') {
      loadData();
    }
  }, [user, loadData]);

  if (isLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surf-0)' }}>
        <div className="spinner" style={{ width: '32px', height: '32px', color: 'var(--brand-merchant)' }} />
      </div>
    );
  }

  const SIDEBAR_W = 220;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surf-0)', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: SIDEBAR_W,
        flexShrink: 0,
        background: 'rgba(10,10,18,0.97)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: sidebarOpen ? 0 : `-${SIDEBAR_W}px`,
        height: '100vh',
        zIndex: 50,
        transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Sidebar header */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--brand-merchant-dim)', border: '1px solid var(--brand-merchant-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--brand-merchant)' }}>storefront</span>
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-merchant)', lineHeight: 1.2 }}>Merchant Portal</p>
              <p style={{ fontSize: '10px', color: 'var(--text-3)' }}>AI Commerce OS</p>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {merchantProfile?.shopName ?? user.name}
          </p>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '10px 8px' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
              className={`sidebar-nav-item ${activeView === item.id ? 'active-merchant' : ''}`}
            >
              <span className="material-symbols-outlined nav-icon" style={{ fontVariationSettings: activeView === item.id ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Tier badge at bottom */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: tierColor }}>verified_user</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: tierColor }}>{merchantProfile?.trustTier ?? 'UNRATED'}</span>
        </div>
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
        />
      )}

      {/* Main content */}
      <div style={{ flex: 1, marginLeft: SIDEBAR_W, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top bar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 30,
          background: 'rgba(10,10,18,0.9)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
          padding: '0 24px',
          height: '56px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="btn btn-ghost btn-icon"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>menu</span>
            </button>
            <span className="font-heading" style={{ fontSize: '15px', color: 'var(--text-1)' }}>
              {NAV_ITEMS.find(n => n.id === activeView)?.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeView !== 'products' && (
              <button
                id="merchant-new-product-btn"
                onClick={() => setActiveView('products')}
                className="btn btn-merchant btn-sm"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                Add Product
              </button>
            )}
            <div style={{ fontSize: '11px', color: 'var(--text-3)', background: 'var(--surf-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-full)', padding: '4px 12px' }}>
              Phase 10H
            </div>
            <button
              id="merchant-logout-btn"
              onClick={logout}
              className="btn btn-ghost btn-sm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>logout</span>
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '28px 28px', maxWidth: '920px', width: '100%' }}>

          {activeView === 'overview' && (
            <OverviewView stats={stats} growth={growth} merchantProfile={merchantProfile} tierColor={tierColor} onNavigate={setActiveView} />
          )}
          {activeView === 'products' && <ProductsView growth={growth} />}
          {activeView === 'growth' && <GrowthView growth={growth} loading={growthLoading} />}
          {activeView === 'orders' && <OrdersView />}
          {activeView === 'analytics' && <AnalyticsView growth={growth} />}
          {activeView === 'settings' && (
            <SettingsView merchantProfile={merchantProfile} tierColor={tierColor} user={user} logout={logout} />
          )}
        </main>
      </div>
    </div>
  );
}
