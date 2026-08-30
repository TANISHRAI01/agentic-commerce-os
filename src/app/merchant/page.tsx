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
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        border: '3px solid rgba(251,191,36,0.2)',
        borderTop: '3px solid #fbbf24',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: Overview
// ─────────────────────────────────────────────────────────────

function OverviewView({
  stats,
  growth,
  merchantProfile,
  tierColor,
}: {
  stats: MerchantStats | null;
  growth: GrowthIntelligenceReport | null;
  merchantProfile: MerchantProfile | null;
  tierColor: string;
}) {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const statCards = stats ? [
    { icon: 'inventory_2',   label: 'Total Products',    value: stats.totalProducts,   color: '#c3c0ff' },
    { icon: 'receipt_long',  label: 'Platform Orders',   value: stats.totalOrders,     color: '#fbbf24' },
    { icon: 'check_circle',  label: 'Completed',         value: stats.completedOrders, color: '#4ade80' },
    { icon: 'pending',       label: 'Pending Approval',  value: stats.pendingApprovals,color: '#f87171' },
  ] : [];

  return (
    <div>
      {/* Welcome */}
      <div style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '13px', color: 'rgba(251,191,36,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Merchant Portal</p>
        <h1 style={{ fontSize: '34px', fontWeight: 800, color: '#e8e6ff', fontFamily: "'Space Grotesk', sans-serif", marginBottom: '4px' }}>
          {merchantProfile?.shopName ?? 'Your Shop'}
        </h1>
        {merchantProfile?.category && (
          <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.5)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '4px 12px' }}>
            {merchantProfile.category}
          </span>
        )}
      </div>

      {/* Trust Tier + Revenue Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <Card>
          <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', marginBottom: '6px' }}>Trust Tier</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: tierColor }}>verified_user</span>
            <p style={{ fontSize: '26px', fontWeight: 800, color: tierColor, fontFamily: "'Space Grotesk', sans-serif" }}>
              {merchantProfile?.trustTier ?? 'UNRATED'}
            </p>
          </div>
        </Card>
        <Card>
          <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', marginBottom: '6px' }}>Completed Revenue</p>
          <p style={{ fontSize: '26px', fontWeight: 800, color: '#4ade80', fontFamily: "'Space Grotesk', sans-serif" }}>
            {stats ? fmt(stats.totalRevenue) : '—'}
          </p>
          <DemoTag text="Demo transactions only" />
        </Card>
      </div>

      {/* Stat Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {statCards.map(sc => (
          <Card key={sc.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: sc.color }}>{sc.icon}</span>
              <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>{sc.label}</p>
            </div>
            <p style={{ fontSize: '28px', fontWeight: 800, color: sc.color, fontFamily: "'Space Grotesk', sans-serif" }}>{sc.value}</p>
          </Card>
        ))}
      </div>

      {/* Top Product */}
      {stats?.topProduct && (
        <Card style={{ marginBottom: '24px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#fbbf24' }}>star</span>
            <p style={{ fontSize: '13px', color: 'rgba(251,191,36,0.7)', fontWeight: 600 }}>Most Ordered Product</p>
          </div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: '#e8e6ff' }}>{stats.topProduct.name}</p>
          <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.4)', marginTop: '4px' }}>{stats.topProduct.orderCount} order{stats.topProduct.orderCount !== 1 ? 's' : ''}</p>
        </Card>
      )}

      {/* AI Growth Quick Summary */}
      {growth && (
        <div>
          <SectionTitle icon="auto_graph" label="AI Growth Snapshot" color="#fbbf24" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {[
              { icon: 'trending_up',    color: '#fbbf24', title: 'Top Picks',    count: growth.topRecommended.length,         note: `${growth.topRecommended[0]?.name ?? '—'}` },
              { icon: 'arrow_upward',   color: '#c3c0ff', title: 'Upsell Opps',  count: growth.upsellOpportunities.length,    note: `${growth.upsellOpportunities[0]?.category ?? '—'}` },
              { icon: 'hub',            color: '#4ade80', title: 'Cross-Sell',   count: growth.crossSellOpportunities.length, note: `${growth.crossSellOpportunities[0]?.primaryCategory ?? '—'}` },
              { icon: 'shopping_cart',  color: '#f87171', title: 'Abandoned',    count: growth.abandonedCartSignals.length,   note: growth.abandonedCartSignals.length > 0 ? 'Needs attention' : 'All clear' },
              { icon: 'campaign',       color: '#fbbf24', title: 'Campaigns',    count: growth.campaignSuggestions.length,    note: `${growth.campaignSuggestions[0]?.suggestedAction ?? '—'}` },
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: Products
// ─────────────────────────────────────────────────────────────

function ProductsView({ growth }: { growth: GrowthIntelligenceReport | null }) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/merchants')
      .then(r => r.json())
      .then(data => {
        if (data.merchants?.length) {
          // Fetch catalog from first available merchant
          return fetch(`/api/merchants/${data.merchants[0].id}/catalog`).then(r => r.json());
        }
        return { products: [] };
      })
      .then(d => {
        setProducts(d.products ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const upsellIds = new Set(growth?.upsellOpportunities.map(u => u.id) ?? []);
  const topIds = new Set(growth?.topRecommended.map(t => t.id) ?? []);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  if (loading) return <LoadingPulse />;
  if (!products.length) return <EmptyState icon="inventory_2" message="No catalog products available." />;

  return (
    <div>
      <SectionTitle icon="inventory_2" label="Catalog Products" color="#c3c0ff" />
      <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.4)', marginBottom: '20px' }}>
        {products.length} products in the platform catalog. Badges are AI-derived signals.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {products.map(p => (
          <Card key={p.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#e8e6ff' }}>{p.name}</p>
                  {topIds.has(p.id) && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '20px', padding: '2px 8px' }}>AI TOP PICK</span>
                  )}
                  {upsellIds.has(p.id) && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#c3c0ff', background: 'rgba(195,192,255,0.1)', border: '1px solid rgba(195,192,255,0.25)', borderRadius: '20px', padding: '2px 8px' }}>UPSELL</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>{p.category}</span>
                  <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>⭐ {p.rating}</span>
                  <span style={{ fontSize: '12px', color: p.stock > 0 ? '#4ade80' : '#f87171' }}>{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</span>
                </div>
              </div>
              <p style={{ fontSize: '18px', fontWeight: 700, color: '#fbbf24', fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap' }}>
                {fmt(p.price)}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
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

function OrdersView() {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dataNote, setDataNote] = useState('');

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

  return (
    <div>
      <SectionTitle icon="receipt_long" label="Platform Orders" color="#fbbf24" />
      {loading
        ? <LoadingPulse />
        : orders.length === 0
          ? <EmptyState icon="receipt_long" message="No orders yet. Orders will appear here once customers complete purchases." />
          : (
            <>
              <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.4)', marginBottom: '16px' }}>{total} order{total !== 1 ? 's' : ''} total</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {orders.map(o => (
                  <Card key={o.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
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
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '16px', fontWeight: 700, color: '#fbbf24', fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(o.finalPrice)}</p>
                        {o.wasNegotiated && (
                          <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.3)', textDecoration: 'line-through', marginTop: '2px' }}>{fmt(o.productPrice)}</p>
                        )}
                      </div>
                    </div>
                  </Card>
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

function AnalyticsView({ growth }: { growth: GrowthIntelligenceReport | null }) {
  if (!growth) return <EmptyState icon="insights" message="Analytics data unavailable." />;

  const campaigns = growth.campaignSuggestions;
  const maxCount = Math.max(...campaigns.map(c => c.productCount), 1);
  const maxRating = 5;

  return (
    <div>
      <SectionTitle icon="insights" label="Catalog Analytics" color="#c3c0ff" />

      {/* Category breakdown */}
      <Card style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e6ff', marginBottom: '16px' }}>Products per Category</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {campaigns.map(c => (
            <div key={c.category}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#e8e6ff', textTransform: 'capitalize' }}>{c.category}</span>
                <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.5)' }}>{c.productCount} products</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(c.productCount / maxCount) * 100}%`, background: ACTION_COLORS[c.suggestedAction] ?? '#c3c0ff', borderRadius: '4px', transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Rating per category */}
      <Card style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e6ff', marginBottom: '16px' }}>Avg Rating per Category</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {campaigns.sort((a, b) => b.avgRating - a.avgRating).map(c => (
            <div key={c.category}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#e8e6ff', textTransform: 'capitalize' }}>{c.category}</span>
                <span style={{ fontSize: '13px', color: c.avgRating >= 4.5 ? '#4ade80' : c.avgRating >= 4.0 ? '#fbbf24' : '#f87171' }}>⭐ {c.avgRating}</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(c.avgRating / maxRating) * 100}%`, background: c.avgRating >= 4.5 ? '#4ade80' : c.avgRating >= 4.0 ? '#fbbf24' : '#f87171', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Price ranges */}
      <Card>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e6ff', marginBottom: '16px' }}>Price Range per Category</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {campaigns.map(c => (
            <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#e8e6ff', textTransform: 'capitalize', flex: 1 }}>{c.category}</span>
              <span style={{ fontSize: '12px', color: 'rgba(232,230,255,0.5)' }}>
                ₹{c.priceRange.min.toLocaleString('en-IN')} – ₹{c.priceRange.max.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <DemoTag text={growth.dataNote} />
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
  return (
    <div style={{ maxWidth: '560px' }}>
      <SectionTitle icon="manage_accounts" label="Shop Settings" color="#fbbf24" />

      <Card style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', marginBottom: '6px' }}>Shop Name</p>
        <p style={{ fontSize: '18px', fontWeight: 700, color: '#e8e6ff' }}>{merchantProfile?.shopName ?? '—'}</p>
      </Card>

      <Card style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', marginBottom: '6px' }}>Trust Tier</p>
        <p style={{ fontSize: '18px', fontWeight: 700, color: tierColor }}>{merchantProfile?.trustTier ?? 'UNRATED'}</p>
        <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.3)', marginTop: '4px' }}>Trust tier is assigned by the platform and cannot be changed.</p>
      </Card>

      {merchantProfile?.category && (
        <Card style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', marginBottom: '6px' }}>Category</p>
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#e8e6ff' }}>{merchantProfile.category}</p>
        </Card>
      )}

      {merchantProfile?.shopDescription && (
        <Card style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', marginBottom: '6px' }}>Description</p>
          <p style={{ fontSize: '14px', color: 'rgba(232,230,255,0.7)', lineHeight: 1.6 }}>{merchantProfile.shopDescription}</p>
        </Card>
      )}

      <Card style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', marginBottom: '6px' }}>Account</p>
        <p style={{ fontSize: '15px', color: '#e8e6ff', fontWeight: 600 }}>{user.name}</p>
        <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.4)' }}>{user.email}</p>
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f14' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          border: '3px solid rgba(251,191,36,0.2)', borderTop: '3px solid #fbbf24',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  const SIDEBAR_W = 220;

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f14', fontFamily: "'Geist', 'Inter', sans-serif", display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: SIDEBAR_W,
        flexShrink: 0,
        background: 'rgba(12,12,18,0.95)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: sidebarOpen ? 0 : `-${SIDEBAR_W}px`,
        height: '100vh',
        zIndex: 50,
        transition: 'left 0.25s ease',
      }}>
        {/* Sidebar header */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#fbbf24' }}>storefront</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24' }}>Merchant Portal</span>
          </div>
          <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', paddingLeft: '28px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {merchantProfile?.shopName ?? user.name}
          </p>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                border: 'none', cursor: 'pointer', marginBottom: '2px',
                background: activeView === item.id ? 'rgba(251,191,36,0.1)' : 'transparent',
                color: activeView === item.id ? '#fbbf24' : 'rgba(232,230,255,0.5)',
                transition: 'all 0.15s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{item.icon}</span>
              <span style={{ fontSize: '14px', fontWeight: activeView === item.id ? 700 : 400 }}>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Tier badge */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: tierColor }}>verified_user</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: tierColor }}>{merchantProfile?.trustTier ?? 'UNRATED'}</span>
          </div>
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
          background: 'rgba(15,15,20,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: '0 24px',
          height: '56px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: 'none', border: 'none', color: 'rgba(232,230,255,0.5)', cursor: 'pointer', padding: '4px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>menu</span>
            </button>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#e8e6ff' }}>
              {NAV_ITEMS.find(n => n.id === activeView)?.label}
            </span>
          </div>
          <button
            id="merchant-logout-btn"
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 12px', color: 'rgba(232,230,255,0.4)', cursor: 'pointer', fontSize: '13px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>logout</span>
            Logout
          </button>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '28px 28px', maxWidth: '880px', width: '100%' }}>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            button { font-family: inherit; }
          `}</style>

          {activeView === 'overview' && (
            <OverviewView stats={stats} growth={growth} merchantProfile={merchantProfile} tierColor={tierColor} />
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
