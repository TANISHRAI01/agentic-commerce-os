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
      <div className="fade-up" style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '13px', color: 'var(--brand-merchant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', fontWeight: 600 }}>Merchant Portal</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1 className="font-display" style={{ fontSize: '34px', color: 'var(--text-1)' }}>
            {merchantProfile?.shopName ?? 'Your Shop'}
          </h1>
          {merchantProfile?.category && (
            <span className="badge badge-neutral">{merchantProfile.category}</span>
          )}
        </div>
      </div>

      {/* Trust Tier + Revenue Banner */}
      <div className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="stat-card">
          <div className="stat-label">
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--brand-merchant)' }}>verified_user</span>
            Trust Tier
          </div>
          <p className="stat-value" style={{ color: tierColor }}>{merchantProfile?.trustTier ?? 'UNRATED'}</p>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--green)' }}>payments</span>
            Completed Revenue
          </div>
          <p className="stat-value" style={{ color: 'var(--green)' }}>{stats ? fmt(stats.totalRevenue) : '—'}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px', fontStyle: 'italic' }}>Demo transactions only</p>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
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
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/merchant/orders/${id}`);
      if (res.ok) { const d = await res.json(); setDetail(d); }
    } finally { setDetailLoading(false); }
  };

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
