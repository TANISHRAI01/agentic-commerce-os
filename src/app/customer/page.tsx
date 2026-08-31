'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/AuthProvider';
import ChatMessage from '@/app/components/ChatMessage';
import LoadingState from '@/app/components/LoadingState';
import DemoPanel from '@/app/components/DemoPanel';
import type { CustomerProfile } from '@/types/auth';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  state: string;
  intentRaw?: string;
  selectedProductName?: string;
  selectedProductPrice?: number;
  negotiatedPrice?: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  policyResult?: Record<string, unknown>;
  approvalStatus?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  transactionId: string;
  event: string;
  result: string;
  reason: string;
}

interface Stats {
  totalSpentThisMonth: number;
  pendingApprovals: number;
  totalTransactions: number;
  completedPurchases: number;
  recentActivity: Array<{
    transactionId: string;
    intentRaw?: string;
    event: string;
    result: string;
    reason: string;
    timestamp: string;
  }>;
}

interface ChatMsg {
  id: string;
  type: 'user' | 'ai' | 'error';
  content: string;
  timestamp: string;
  shopResult?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────

type ViewId = 'home' | 'shop' | 'history' | 'spending' | 'activity' | 'profile';

const NAV_ITEMS: { id: ViewId; icon: string; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'shop', icon: 'smart_toy', label: 'AI Shop' },
  { id: 'history', icon: 'receipt_long', label: 'History' },
  { id: 'spending', icon: 'account_balance_wallet', label: 'Spending' },
  { id: 'activity', icon: 'timeline', label: 'Activity' },
  { id: 'profile', icon: 'person', label: 'Profile' },
];

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  COMPLETED:        { label: 'Completed',    color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  VERIFIED:         { label: 'Verified',     color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  PAYMENT_SUCCESS:  { label: 'Paid',         color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  APPROVAL_REQUIRED:{ label: 'Needs Approval', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  PAYMENT_PENDING:  { label: 'Processing',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  PAYMENT_FAILED:   { label: 'Failed',       color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  BLOCKED:          { label: 'Blocked',      color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  POLICY_FAIL:      { label: 'Policy Fail',  color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  CANCELLED:        { label: 'Cancelled',    color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  CART_READY:       { label: 'Cart Ready',   color: '#c3c0ff', bg: 'rgba(195,192,255,0.1)' },
  NEGOTIATING:      { label: 'Negotiating',  color: '#c3c0ff', bg: 'rgba(195,192,255,0.1)' },
  CREATED:          { label: 'Processing',   color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
};

function StateBadge({ state }: { state: string }) {
  const meta = STATE_META[state] ?? { label: state, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
      textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px',
      color: meta.color, background: meta.bg, whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  );
}

function ResultIcon({ result }: { result: string }) {
  if (result === 'SUCCESS') return <span style={{ color: '#4ade80' }}>✓</span>;
  if (result === 'FAILURE') return <span style={{ color: '#f87171' }}>✗</span>;
  if (result === 'WARNING') return <span style={{ color: '#fbbf24' }}>⚠</span>;
  return <span style={{ color: '#94a3b8' }}>ℹ</span>;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px' }}>
      <div className="spinner" style={{ width: '28px', height: '28px', color: 'var(--brand)' }} />
    </div>
  );
}

function EmptyState({ icon, title, sub, cta, onCta }: { icon: string; title: string; sub: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="empty-state fade-in">
      <span className="material-symbols-outlined empty-state-icon">{icon}</span>
      <p className="empty-state-title">{title}</p>
      <p className="empty-state-sub">{sub}</p>
      {cta && (
        <button onClick={onCta} className="btn btn-primary" style={{ marginTop: '8px' }}>{cta}</button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: Home
// ─────────────────────────────────────────────────────────────

function HomeView({
  user,
  profile,
  stats,
  statsLoading,
  recentTxns,
  txnsLoading,
  onNavigate,
}: {
  user: { name: string };
  profile: CustomerProfile | null;
  stats: Stats | null;
  statsLoading: boolean;
  recentTxns: Transaction[];
  txnsLoading: boolean;
  onNavigate: (v: ViewId) => void;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user.name.split(' ')[0];

  const limit = profile?.monthlyPurchaseLimit ?? 50000;
  const spent = stats?.totalSpentThisMonth ?? 0;
  const pct = Math.min((spent / limit) * 100, 100);
  const barColor = pct > 85 ? '#f87171' : pct > 60 ? '#fbbf24' : '#4ade80';

  const card = (icon: string, label: string, value: string, color: string) => (
    <div className="stat-card">
      <div className="stat-label">
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color }}>{icon}</span>
        {label}
      </div>
      <p className="stat-value">{value}</p>
    </div>
  );

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
      {/* Greeting */}
      <div className="fade-up" style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '13px', color: 'var(--brand)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{greeting}</p>
        <h1 className="font-display" style={{ fontSize: '36px', color: 'var(--text-1)', lineHeight: 1.1 }}>
          {firstName} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>👋</span>
        </h1>
      </div>

      {/* Spending Progress */}
      <div className="card fade-up delay-1" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
          <div>
            <p className="stat-label">This Month&apos;s Spending</p>
            <p className="font-display" style={{ fontSize: '30px', color: 'var(--text-1)' }}>
              ₹{spent.toLocaleString('en-IN')}
              <span style={{ fontSize: '16px', color: 'var(--text-2)', fontWeight: 400 }}> / ₹{limit.toLocaleString('en-IN')}</span>
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="stat-label">Remaining</p>
            <p className="font-heading" style={{ fontSize: '22px', color: barColor }}>
              ₹{Math.max(0, limit - spent).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '8px' }}>{pct.toFixed(0)}% of monthly limit used</p>
      </div>

      {/* Stat Cards */}
      <div className="fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {card('check_circle', 'Purchases', statsLoading ? '—' : String(stats?.completedPurchases ?? 0), 'var(--green)')}
        {card('pending', 'Pending Approvals', statsLoading ? '—' : String(stats?.pendingApprovals ?? 0), 'var(--yellow)')}
        {card('receipt_long', 'All Sessions', statsLoading ? '—' : String(stats?.totalTransactions ?? 0), 'var(--brand)')}
      </div>

      {/* CTA */}
      <button
        id="home-start-shopping-btn"
        className="fade-up delay-3"
        onClick={() => onNavigate('shop')}
        style={{
          width: '100%', padding: '18px 22px', borderRadius: 'var(--r-xl)',
          border: '1px solid var(--brand-border)',
          background: 'linear-gradient(135deg, var(--brand-dim), rgba(195,192,255,0.04))',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '32px', transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(195,192,255,0.12)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-border)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--brand)' }}>smart_toy</span>
            <p className="font-heading" style={{ fontSize: '15px', color: 'var(--text-1)' }}>Start Shopping with AI</p>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', paddingLeft: '26px' }}>Natural language → Agent negotiation → Checkout</p>
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: '22px', color: 'var(--brand)' }}>arrow_forward</span>
      </button>

      {/* Recent Purchases */}
      <div className="fade-up delay-4" style={{ marginBottom: '32px' }}>
        <div className="section-header">
          <h2 className="section-title">Recent Purchases</h2>
          <button className="section-link" onClick={() => onNavigate('history')}>View all →</button>
        </div>
        {txnsLoading ? <Spinner /> : recentTxns.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'rgba(232,230,255,0.3)', padding: '16px 0' }}>No purchases yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentTxns.slice(0, 4).map(txn => (
              <div key={txn.id} onClick={() => onNavigate('history')} style={{
                background: 'rgba(18,18,28,0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px',
                padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(195,192,255,0.2)')}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.05)')}
              >
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e6ff', marginBottom: '2px' }}>{txn.selectedProductName ?? txn.intentRaw ?? 'Shopping session'}</p>
                  <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>{formatDate(txn.createdAt)}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {(txn.negotiatedPrice ?? txn.selectedProductPrice) && (
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#e8e6ff', fontFamily: "'Space Grotesk', sans-serif" }}>
                      ₹{(txn.negotiatedPrice ?? txn.selectedProductPrice!).toLocaleString('en-IN')}
                    </span>
                  )}
                  <StateBadge state={txn.state} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {stats && stats.recentActivity.length > 0 && (
        <div className="fade-up delay-5">
          <div className="section-header">
            <h2 className="section-title">Recent AI Activity</h2>
            <button className="section-link" onClick={() => onNavigate('activity')}>View all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {stats.recentActivity.slice(0, 4).map(ev => (
              <div key={`${ev.transactionId}-${ev.timestamp}`} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '10px 14px', background: 'rgba(18,18,28,0.4)', borderRadius: '10px',
              }}>
                <ResultIcon result={ev.result} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', color: 'rgba(232,230,255,0.7)', lineHeight: 1.4 }}>{ev.reason}</p>
                  <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.3)', marginTop: '2px' }}>{formatTime(ev.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: AI Shop (reuses existing components)
// ─────────────────────────────────────────────────────────────

function ShopView({ onPurchaseComplete }: { onPurchaseComplete?: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;
    const userQuery = query.trim();
    setQuery('');
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: 'user', content: userQuery, timestamp: new Date().toLocaleTimeString() }]);
    setIsLoading(true);
    try {
      const res = await fetch('/api/shop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: userQuery }) });
      const data = await res.json();
      if (!res.ok) {
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, type: 'error', content: data.details || data.error || 'Something went wrong', timestamp: new Date().toLocaleTimeString() }]);
      } else {
        let negotiationResult = null;
        if (data.transactionId && data.selectedProduct) {
          try {
            const negRes = await fetch('/api/negotiate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId: data.transactionId }) });
            if (negRes.ok) { const negData = await negRes.json(); negotiationResult = negData.negotiationResult ?? null; }
          } catch { /* non-fatal */ }
        }
        setMessages(prev => [...prev, { id: `a-${Date.now()}`, type: 'ai', content: data.message || 'Here are the results:', timestamp: new Date().toLocaleTimeString(), shopResult: { ...data, negotiationResult } }]);
        // Notify parent to refresh stats/history after a shop response
        onPurchaseComplete?.();
      }
    } catch {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, type: 'error', content: 'Network error. Please try again.', timestamp: new Date().toLocaleTimeString() }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const SUGGESTIONS = [
    'Find me noise-cancelling headphones under ₹8,000',
    'Best laptop for college under ₹40,000',
    'Wireless earbuds under ₹3,000',
  ];

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: '120px' }}>
      {messages.length === 0 && (
        <div className="fade-up" style={{ textAlign: 'center', paddingTop: '40px', paddingBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', background: 'var(--brand-dim)', border: '1px solid var(--brand-border)', borderRadius: 'var(--r-full)', marginBottom: '20px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--brand)' }}>smart_toy</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Buyer Active</span>
          </div>
          <h2 className="font-display" style={{ fontSize: '34px', color: 'var(--text-1)', marginBottom: '12px' }}>What are you looking for?</h2>
          <p style={{ fontSize: '16px', color: 'var(--text-2)', marginBottom: '32px', lineHeight: 1.6 }}>Intent → Discovery → Negotiation → Checkout. Fully autonomous.</p>
          <DemoPanel onSelectScenario={q => { setQuery(q); setTimeout(() => inputRef.current?.focus(), 100); }} disabled={isLoading} />
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => setQuery(s)} className="ai-chip chip-animation" style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.map(msg => (
          <ChatMessage key={msg.id} type={msg.type} content={msg.content} timestamp={msg.timestamp} shopResult={msg.shopResult as never} />
        ))}
        {isLoading && <LoadingState />}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 240px)', maxWidth: '720px', zIndex: 50, paddingLeft: '80px' }}>
        <div className="chat-input-bar" style={{ display: 'flex', alignItems: 'center', padding: '8px 8px 8px 20px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-3)', marginRight: '10px', flexShrink: 0 }}>smart_toy</span>
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} disabled={isLoading}
            placeholder={isLoading ? 'Processing...' : 'Instruct your AI agent…'}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-1)', fontSize: '15px', outline: 'none', paddingRight: '12px', fontFamily: 'inherit' }} />
          <button type="submit" disabled={!query.trim() || isLoading} style={{
            width: '40px', height: '40px', borderRadius: '50%', border: 'none',
            cursor: query.trim() && !isLoading ? 'pointer' : 'not-allowed',
            background: query.trim() && !isLoading ? 'var(--brand-dim)' : 'rgba(255,255,255,0.05)',
            color: query.trim() && !isLoading ? 'var(--brand)' : 'var(--text-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'all 0.2s',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_upward</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: Purchase History
// ─────────────────────────────────────────────────────────────

function HistoryView({ onNavigateToShop }: { onNavigateToShop: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ transaction: Transaction; auditEvents: AuditEvent[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch('/api/customer/transactions')
      .then(r => r.json())
      .then(d => { setTransactions(d.transactions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const openDetail = async (id: string) => {
    if (selectedId === id) { setSelectedId(null); setDetail(null); return; }
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/customer/transactions/${id}`);
      if (res.ok) { const d = await res.json(); setDetail(d); }
    } finally { setDetailLoading(false); }
  };

  if (loading) return <Spinner />;
  if (transactions.length === 0) return <EmptyState icon="receipt_long" title="No purchases yet" sub="Your order history will appear here once you make your first purchase." cta="Start Shopping" onCta={onNavigateToShop} />;

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
      <h2 className="font-heading" style={{ fontSize: '22px', color: 'var(--text-1)', marginBottom: '20px' }}>Purchase History</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {transactions.map(txn => (
          <div key={txn.id}>
            <div
              onClick={() => openDetail(txn.id)}
              style={{
                background: selectedId === txn.id ? 'rgba(195,192,255,0.06)' : 'rgba(18,18,28,0.6)',
                border: `1px solid ${selectedId === txn.id ? 'rgba(195,192,255,0.25)' : 'rgba(255,255,255,0.05)'}`,
                borderRadius: selectedId === txn.id ? '16px 16px 0 0' : '12px',
                padding: '14px 18px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '12px',
                transition: 'all 0.15s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'rgba(195,192,255,0.4)', flexShrink: 0 }}>
                {txn.state.includes('FAIL') || txn.state === 'BLOCKED' ? 'error' : txn.state === 'COMPLETED' || txn.state === 'VERIFIED' ? 'check_circle' : 'pending'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e6ff', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {txn.selectedProductName ?? txn.intentRaw ?? 'Shopping session'}
                </p>
                <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>{formatDate(txn.createdAt)} · {txn.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                {(txn.negotiatedPrice || txn.selectedProductPrice) && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#e8e6ff', fontFamily: "'Space Grotesk', sans-serif" }}>
                      ₹{(txn.negotiatedPrice ?? txn.selectedProductPrice!).toLocaleString('en-IN')}
                    </span>
                    {txn.negotiatedPrice && txn.selectedProductPrice && txn.negotiatedPrice < txn.selectedProductPrice && (
                      <p style={{ fontSize: '11px', textDecoration: 'line-through', textDecorationColor: 'rgba(232,230,255,0.3)', color: 'rgba(232,230,255,0.3)' }}>
                        ₹{txn.selectedProductPrice.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                )}
                <StateBadge state={txn.state} />
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'rgba(232,230,255,0.3)', transition: 'transform 0.2s', transform: selectedId === txn.id ? 'rotate(180deg)' : 'none' }}>expand_more</span>
              </div>
            </div>

            {/* Detail Panel */}
            {selectedId === txn.id && (
              <div style={{
                background: 'rgba(12,12,20,0.9)', border: '1px solid rgba(195,192,255,0.15)', borderTop: 'none',
                borderRadius: '0 0 16px 16px', padding: '20px 18px',
              }}>
                {detailLoading ? <Spinner /> : detail ? (
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
                    {/* Negotiation savings */}
                    {detail.transaction.negotiatedPrice && detail.transaction.selectedProductPrice &&
                      detail.transaction.negotiatedPrice < detail.transaction.selectedProductPrice && (
                        <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="material-symbols-outlined" style={{ color: '#4ade80', fontSize: '18px' }}>savings</span>
                          <span style={{ fontSize: '13px', color: '#4ade80' }}>
                            AI negotiated ₹{(detail.transaction.selectedProductPrice - detail.transaction.negotiatedPrice).toLocaleString('en-IN')} off the listed price!
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: Spending & Limits
// ─────────────────────────────────────────────────────────────

interface SpendingData {
  monthlySpent: number;
  monthlyPurchaseLimit: number;
  remainingBudget: number;
  agentSpendingLimit: number;
  approvalThreshold: number;
  trustedMerchantsOnly: boolean;
  requireApprovalFirstPurchase: boolean;
}

function Toggle({ id, checked, onChange, label, desc }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e6ff', marginBottom: '4px' }}>{label}</p>
        <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', lineHeight: 1.5 }}>{desc}</p>
      </div>
      <button
        id={id}
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0, width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
          background: checked ? 'rgba(195,192,255,0.3)' : 'rgba(255,255,255,0.1)',
          position: 'relative', transition: 'background 0.2s',
        }}
        aria-checked={checked}
        role="switch"
      >
        <span style={{
          position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%',
          background: checked ? '#c3c0ff' : 'rgba(232,230,255,0.4)',
          left: checked ? 'calc(100% - 22px)' : '2px',
          transition: 'left 0.2s, background 0.2s',
        }} />
      </button>
    </div>
  );
}

function SpendingView({ profile: initProfile, stats, onProfileUpdate }: { profile: CustomerProfile | null; stats: Stats | null; onProfileUpdate: (p: CustomerProfile) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agentLimit, setAgentLimit] = useState(String(initProfile?.agentSpendingLimit ?? 5000));
  const [approvalThresh, setApprovalThresh] = useState(String(initProfile?.approvalThreshold ?? 3000));
  const [monthlyLimit, setMonthlyLimit] = useState(String(initProfile?.monthlyPurchaseLimit ?? 50000));
  const [monthlyIncome, setMonthlyIncome] = useState(String(initProfile?.monthlyIncome ?? ''));
  const [trustedOnly, setTrustedOnly] = useState<boolean>(initProfile?.trustedMerchantsOnly ?? false);
  const [requireFirstApproval, setRequireFirstApproval] = useState<boolean>(initProfile?.requireApprovalFirstPurchase ?? false);
  const [error, setError] = useState('');
  // Fresh spending data fetched from server (authoritative)
  const [spending, setSpending] = useState<SpendingData | null>(null);
  const [spendingLoading, setSpendingLoading] = useState(true);

  // Load authoritative spending data on mount
  useEffect(() => {
    fetch('/api/customer/profile')
      .then(r => r.json())
      .then(d => {
        if (d.spending) {
          setSpending(d.spending);
          setAgentLimit(String(d.spending.agentSpendingLimit));
          setApprovalThresh(String(d.spending.approvalThreshold));
          setMonthlyLimit(String(d.spending.monthlyPurchaseLimit));
          setTrustedOnly(d.spending.trustedMerchantsOnly);
          setRequireFirstApproval(d.spending.requireApprovalFirstPurchase);
        }
        if (d.profile?.monthlyIncome) setMonthlyIncome(String(d.profile.monthlyIncome));
        setSpendingLoading(false);
      })
      .catch(() => setSpendingLoading(false));
  }, []);

  const displaySpent = spending?.monthlySpent ?? stats?.totalSpentThisMonth ?? 0;
  const displayLimit = spending?.monthlyPurchaseLimit ?? initProfile?.monthlyPurchaseLimit ?? 50000;
  const displayRemaining = spending?.remainingBudget ?? Math.max(0, displayLimit - displaySpent);
  const pct = Math.min((displaySpent / displayLimit) * 100, 100);
  const barColor = pct > 85 ? '#f87171' : pct > 60 ? '#fbbf24' : '#4ade80';

  const effectiveAgentLimit = Number(editing ? agentLimit : (spending?.agentSpendingLimit ?? agentLimit));
  const effectiveApprovalThresh = Number(editing ? approvalThresh : (spending?.approvalThreshold ?? approvalThresh));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentSpendingLimit: Number(agentLimit),
          approvalThreshold: Number(approvalThresh),
          monthlyPurchaseLimit: Number(monthlyLimit),
          ...(monthlyIncome ? { monthlyIncome: Number(monthlyIncome) } : {}),
          trustedMerchantsOnly: trustedOnly,
          requireApprovalFirstPurchase: requireFirstApproval,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.spending) setSpending(data.spending);
        onProfileUpdate({ ...initProfile!, ...data.profile, trustedMerchantsOnly: trustedOnly, requireApprovalFirstPurchase: requireFirstApproval });
        setEditing(false);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to save');
      }
    } finally { setSaving(false); }
  };

  const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
  const inputSt: React.CSSProperties = { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(195,192,255,0.2)', borderRadius: '10px', color: '#e8e6ff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <h2 className="font-heading" style={{ fontSize: '22px', color: 'var(--text-1)', marginBottom: '24px' }}>Spending &amp; Limits</h2>

      {/* Monthly progress */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Monthly Spend</p>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#e8e6ff', fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(displaySpent)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)', marginBottom: '4px' }}>Limit</p>
            <p style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(232,230,255,0.6)', fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(displayLimit)}</p>
          </div>
        </div>
        <div style={{ height: '10px', borderRadius: '5px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: '8px' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '5px', transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: 'rgba(232,230,255,0.3)' }}>{pct.toFixed(0)}% used</span>
          <span style={{ color: barColor, fontWeight: 600 }}>{fmt(displayRemaining)} remaining</span>
        </div>
      </div>

      {/* Live Policy Preview */}
      <div style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand-border)', borderRadius: 'var(--r-lg)', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#c3c0ff' }}>policy</span>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#c3c0ff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your AI Spending Controls</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { icon: '✓', color: '#4ade80', text: `Under ${fmt(effectiveApprovalThresh)} — auto-approved by AI` },
            { icon: '⚠', color: '#fbbf24', text: `${fmt(effectiveApprovalThresh)}–${fmt(effectiveAgentLimit)} — requires your approval` },
            { icon: '✗', color: '#f87171', text: `Above ${fmt(effectiveAgentLimit)} — blocked by agent limit` },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0' }}>
              <span style={{ color: item.color, fontSize: '14px', width: '16px', textAlign: 'center' }}>{item.icon}</span>
              <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.65)' }}>{item.text}</span>
            </div>
          ))}
          {trustedOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '4px' }}>
              <span style={{ color: '#c3c0ff', fontSize: '14px', width: '16px', textAlign: 'center' }}>🔒</span>
              <span style={{ fontSize: '13px', color: 'rgba(195,192,255,0.7)' }}>Trusted merchants only (Platinum & Gold)</span>
            </div>
          )}
          {requireFirstApproval && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0' }}>
              <span style={{ color: '#fbbf24', fontSize: '14px', width: '16px', textAlign: 'center' }}>⚠</span>
              <span style={{ fontSize: '13px', color: 'rgba(232,230,255,0.65)' }}>First purchase from any merchant requires approval</span>
            </div>
          )}
        </div>
      </div>

      {/* Limit Fields */}
      <div className="card" style={{ marginBottom: '12px', padding: 'var(--sp-5)' }}>
        {[
          { label: 'Agent Spending Limit', desc: 'Max the AI can spend in a single purchase', value: agentLimit, setter: setAgentLimit, icon: 'smart_toy', color: '#c3c0ff' },
          { label: 'Approval Threshold', desc: 'Purchases above this require your approval', value: approvalThresh, setter: setApprovalThresh, icon: 'verified', color: '#fbbf24' },
          { label: 'Monthly Purchase Limit', desc: 'Total spending cap per month', value: monthlyLimit, setter: setMonthlyLimit, icon: 'calendar_month', color: '#4ade80' },
          { label: 'Monthly Income', desc: 'Optional — used for budget context only', value: monthlyIncome, setter: setMonthlyIncome, icon: 'payments', color: 'rgba(232,230,255,0.4)' },
        ].map((item, idx) => (
          <div key={item.label} style={{ padding: '14px 0', borderBottom: idx < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: editing ? '8px' : '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: item.color }}>{item.icon}</span>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e6ff' }}>{item.label}</p>
                <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.4)' }}>{item.desc}</p>
              </div>
            </div>
            {editing ? (
              <input type="number" value={item.value} onChange={e => item.setter(e.target.value)} min={1} placeholder={item.label === 'Monthly Income' ? 'Optional' : ''} style={inputSt} />
            ) : (
              <p style={{ fontSize: '22px', fontWeight: 700, color: item.color, fontFamily: "'Space Grotesk', sans-serif" }}>
                {item.value ? fmt(Number(item.value)) : <span style={{ fontSize: '14px', color: 'rgba(232,230,255,0.3)' }}>Not set</span>}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Policy Toggles */}
      <div className="card" style={{ padding: '4px 20px', marginBottom: '20px' }}>
        <Toggle
          id="toggle-trusted-merchants"
          checked={trustedOnly}
          onChange={v => { setTrustedOnly(v); if (!editing) setEditing(true); }}
          label="Trusted Merchants Only"
          desc="Only allow purchases from Platinum and Gold merchants. Bronze and unrated sellers will be blocked."
        />
        <Toggle
          id="toggle-first-purchase-approval"
          checked={requireFirstApproval}
          onChange={v => { setRequireFirstApproval(v); if (!editing) setEditing(true); }}
          label="Approve First Purchase from Any Merchant"
          desc="Require your manual approval the first time the AI buys from a new merchant."
        />
      </div>

      {error && <p style={{ color: '#f87171', fontSize: '14px', marginBottom: '12px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '10px' }}>
        {editing ? (
          <>
            <button id="save-limits-btn" onClick={handleSave} disabled={saving} className="btn btn-solid" style={{ flex: 1 }}>
              {saving ? <><span className="spinner" style={{ width: '14px', height: '14px', color: '#0f0f14' }} /> Saving…</> : 'Save Limits'}
            </button>
            <button onClick={() => { setEditing(false); }} className="btn btn-ghost">Cancel</button>
          </>
        ) : (
          <button id="edit-limits-btn" onClick={() => setEditing(true)} className="btn btn-primary">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
            Edit Limits
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: Activity
// ─────────────────────────────────────────────────────────────

function ActivityView({ onNavigateToShop }: { onNavigateToShop: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Array<{ txn: Transaction; ev: AuditEvent }>>([]);

  useEffect(() => {
    fetch('/api/customer/transactions?limit=20')
      .then(r => r.json())
      .then(async d => {
        const txns: Transaction[] = d.transactions ?? [];
        setTransactions(txns);
        const allEvents: Array<{ txn: Transaction; ev: AuditEvent }> = [];
        for (const txn of txns.slice(0, 10)) {
          try {
            const res = await fetch(`/api/customer/transactions/${txn.id}`);
            if (res.ok) {
              const data = await res.json();
              for (const ev of (data.auditEvents as AuditEvent[])) {
                if (ev.event !== 'STATE_TRANSITION') allEvents.push({ txn, ev });
              }
            }
          } catch { /* continue */ }
        }
        allEvents.sort((a, b) => b.ev.timestamp.localeCompare(a.ev.timestamp));
        setEvents(allEvents.slice(0, 50));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const EVENT_LABELS: Record<string, string> = {
    INTENT_RECEIVED: 'Shopping intent received',
    DISCOVERY_STARTED: 'AI analyzing your request',
    DISCOVERY_COMPLETE: 'Products discovered',
    DECISION_STARTED: 'AI ranking products',
    DECISION_COMPLETE: 'Product selected',
    CART_CREATED: 'Cart created',
    POLICY_CHECK: 'Policy check started',
    POLICY_EVALUATED: 'Policy evaluation complete',
    APPROVAL_REQUESTED: 'Approval requested',
    APPROVAL_RECEIVED: 'Approval received',
    APPROVAL_GRANTED: 'Approved',
    APPROVAL_REJECTED: 'Rejected by approval',
    ORDER_CREATED: 'Payment order created',
    PAYMENT_INITIATED: 'Payment initiated',
    PAYMENT_STATUS_POLLED: 'Payment status checked',
    PAYMENT_VERIFIED: 'Payment verified',
    PAYMENT_FAILED: 'Payment failed',
    TRANSACTION_COMPLETE: 'Purchase complete',
    TRANSACTION_FAILED: 'Transaction failed',
    NEGOTIATION_STARTED: 'Price negotiation started',
    NEGOTIATION_ROUND: 'Negotiation round',
    NEGOTIATION_COMPLETE: 'Negotiation finished',
    MERCHANT_AGENT_STARTED: 'Merchant recommendations loading',
    MERCHANT_AGENT_COMPLETE: 'Recommendations ready',
  };

  if (loading) return <Spinner />;
  if (events.length === 0) return <EmptyState icon="timeline" title="No activity yet" sub="Your AI shopping trail will appear here." cta="Start Shopping" onCta={onNavigateToShop} />;

  // Group by date
  const grouped: Record<string, typeof events> = {};
  for (const item of events) {
    const day = new Date(item.ev.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(item);
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <h2 className="font-heading" style={{ fontSize: '22px', color: 'var(--text-1)', marginBottom: '24px' }}>AI Activity</h2>
      {Object.entries(grouped).map(([day, items]) => (
        <div key={day} style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>{day}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {items.map((item, idx) => (
              <div key={item.ev.id} style={{ display: 'flex', gap: '16px', paddingBottom: '12px' }}>
                {/* Timeline line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24px', flexShrink: 0 }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: item.ev.result === 'SUCCESS' ? 'rgba(74,222,128,0.15)' : item.ev.result === 'FAILURE' ? 'rgba(248,113,113,0.15)' : item.ev.result === 'WARNING' ? 'rgba(251,191,36,0.15)' : 'rgba(148,163,184,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ResultIcon result={item.ev.result} />
                  </div>
                  {idx < items.length - 1 && <div style={{ flex: 1, width: '1px', background: 'rgba(255,255,255,0.06)', minHeight: '12px' }} />}
                </div>
                <div style={{ flex: 1, paddingTop: '2px', paddingBottom: idx < items.length - 1 ? '0' : '0' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(232,230,255,0.75)', marginBottom: '2px' }}>
                    {EVENT_LABELS[item.ev.event] ?? item.ev.event.replace(/_/g, ' ')}
                  </p>
                  <p style={{ fontSize: '12px', color: 'rgba(232,230,255,0.45)', lineHeight: 1.5, marginBottom: '2px' }}>{item.ev.reason}</p>
                  {item.txn.intentRaw && (
                    <p style={{ fontSize: '11px', color: 'rgba(195,192,255,0.4)', fontStyle: 'italic' }}>"{item.txn.intentRaw.substring(0, 60)}{item.txn.intentRaw.length > 60 ? '…' : ''}"</p>
                  )}
                  <p style={{ fontSize: '11px', color: 'rgba(232,230,255,0.25)', marginTop: '3px' }}>{formatTime(item.ev.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View: Profile
// ─────────────────────────────────────────────────────────────

function ProfileView({ user, logout }: { user: { name: string; email: string; createdAt: string }; logout: () => Promise<void> }) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);

  const saveName = async () => {
    setSaving(true);
    await fetch('/api/customer/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    setSaving(false);
    setEditingName(false);
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
      <h2 className="font-heading" style={{ fontSize: '22px', color: 'var(--text-1)', marginBottom: '24px' }}>Profile</h2>
      <div className="card" style={{ marginBottom: '16px' }}>
        {/* Avatar + Name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--brand-dim)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="font-heading" style={{ fontSize: '17px', color: 'var(--text-1)', marginBottom: '2px' }}>{name}</p>
            <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{user.email}</p>
          </div>
          <span className="badge badge-info">CUSTOMER</span>
        </div>
        {/* Name edit */}
        <div style={{ marginBottom: '16px' }}>
          <p className="form-label">Display Name</p>
          {editingName ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={name} onChange={e => setName(e.target.value)} className="form-input" style={{ flex: 1 }} />
              <button onClick={saveName} disabled={saving} className="btn btn-primary btn-sm">{saving ? '…' : 'Save'}</button>
              <button onClick={() => { setEditingName(false); setName(user.name); }} className="btn btn-ghost btn-sm">✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '15px', color: 'var(--text-1)' }}>{name}</p>
              <button onClick={() => setEditingName(true)} className="btn btn-ghost btn-sm">Edit</button>
            </div>
          )}
        </div>
        {/* Member since */}
        <div>
          <p className="form-label">Member Since</p>
          <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>{formatDate(user.createdAt)}</p>
        </div>
      </div>

      <button
        id="profile-logout-btn"
        onClick={logout}
        className="btn btn-danger btn-lg"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
        Sign Out
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Customer Dashboard
// ─────────────────────────────────────────────────────────────

export default function CustomerDashboard() {
  const router = useRouter();
  const { user, profile: rawProfile, isLoading: authLoading, logout, refetch } = useAuth();
  const [activeView, setActiveView] = useState<ViewId>('home');
  const [navOpen, setNavOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(true);
  const [profile, setProfile] = useState<CustomerProfile | null>(rawProfile as CustomerProfile | null);
  // Incrementing key — forces History/Activity to remount (re-fetch) on each visit
  const [refreshKey, setRefreshKey] = useState(0);

  // Redirect if not authenticated or wrong role
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'CUSTOMER')) {
      router.replace('/auth/login?role=CUSTOMER');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    setProfile(rawProfile as CustomerProfile | null);
  }, [rawProfile]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/customer/stats');
      if (res.ok) setStats(await res.json());
    } finally { setStatsLoading(false); }
  }, []);

  const loadRecentTxns = useCallback(async () => {
    setTxnsLoading(true);
    try {
      const res = await fetch('/api/customer/transactions?limit=8');
      if (res.ok) { const d = await res.json(); setRecentTxns(d.transactions ?? []); }
    } finally { setTxnsLoading(false); }
  }, []);

  useEffect(() => {
    if (user && user.role === 'CUSTOMER') {
      loadStats();
      loadRecentTxns();
    }
  }, [user, loadStats, loadRecentTxns]);

  // Refresh data when switching back to home, history, or activity
  useEffect(() => {
    if (user) {
      // Always refresh stats + recent txns when navigating to these views
      if (activeView === 'home' || activeView === 'history' || activeView === 'activity') {
        loadStats();
        loadRecentTxns();
        setRefreshKey(k => k + 1); // force-remount History/Activity sub-views
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surf-0)' }}>
        <div className="spinner" style={{ width: '32px', height: '32px', color: 'var(--brand)' }} />
      </div>
    );
  }
  if (!user) return null;

  const navigate = (v: ViewId) => { setActiveView(v); setNavOpen(false); };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surf-0)', display: 'flex' }}>
      {/* Sidebar */}
      <nav style={{
        position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 40,
        width: navOpen ? '220px' : '64px',
        background: 'rgba(10,10,18,0.97)', backdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '16px 0',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden',
      }}
        onMouseEnter={() => setNavOpen(true)}
        onMouseLeave={() => setNavOpen(false)}
      >
        {/* Logo */}
        <div style={{ padding: '0 12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--brand-dim)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--brand)' }}>smart_toy</span>
          </div>
          <div style={{ opacity: navOpen ? 1 : 0, transition: 'opacity 0.15s' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand)', lineHeight: 1.2 }}>Customer</p>
            <p style={{ fontSize: '10px', color: 'var(--text-3)' }}>AI Commerce OS</p>
          </div>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 8px' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => navigate(item.id)}
              className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
            >
              <span className="material-symbols-outlined nav-icon" style={{ fontVariationSettings: activeView === item.id ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
              <span style={{ opacity: navOpen ? 1 : 0, transition: 'opacity 0.15s' }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* User avatar at bottom */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--brand-dim)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--brand)', flexShrink: 0 }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ opacity: navOpen ? 1 : 0, transition: 'opacity 0.15s', minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: '64px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{ padding: '0 28px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10,10,18,0.85)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 30, height: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="font-heading" style={{ fontSize: '16px', color: 'var(--text-1)' }}>
              {NAV_ITEMS.find(n => n.id === activeView)?.label ?? 'Dashboard'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeView !== 'shop' && (
              <button
                onClick={() => navigate('shop')}
                className="btn btn-primary btn-sm"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>smart_toy</span>
                New Shop
              </button>
            )}
            <div style={{ fontSize: '11px', color: 'var(--text-3)', background: 'var(--surf-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-full)', padding: '4px 12px' }}>
              Phase 10H
            </div>
            <button
              id="topbar-logout-btn"
              onClick={logout}
              title="Logout"
              className="btn btn-ghost btn-icon"
              style={{ width: '36px', height: '36px', borderRadius: '50%' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
            </button>
          </div>
        </header>

        {/* View content */}
        <div style={{ flex: 1, padding: activeView === 'shop' ? '28px 0 0' : '32px 28px', overflowY: 'auto' }} className="custom-scrollbar">
          {activeView === 'home' && (
            <HomeView
              user={user}
              profile={profile}
              stats={stats}
              statsLoading={statsLoading}
              recentTxns={recentTxns}
              txnsLoading={txnsLoading}
              onNavigate={navigate}
            />
          )}
          {activeView === 'shop' && <ShopView onPurchaseComplete={() => { loadStats(); loadRecentTxns(); setRefreshKey(k => k + 1); }} />}
          {activeView === 'history' && <HistoryView key={refreshKey} onNavigateToShop={() => navigate('shop')} />}
          {activeView === 'spending' && (
            <SpendingView
              profile={profile}
              stats={stats}
              onProfileUpdate={p => { setProfile(p); refetch(); }}
            />
          )}
          {activeView === 'activity' && <ActivityView key={refreshKey} onNavigateToShop={() => navigate('shop')} />}
          {activeView === 'profile' && (
            <ProfileView
              user={{ name: user.name, email: user.email, createdAt: user.createdAt }}
              logout={logout}
            />
          )}
        </div>
      </main>
    </div>
  );
}
