'use client';

import React, { useEffect, useState } from 'react';

// ── Type Definitions ──────────────────────────────────────────

interface TopRecommendedProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  merchantName: string;
  merchantTrustTier: string;
  signalLabel: 'TOP_PICK' | 'HIGH_RATED' | 'POPULAR';
}

interface UpsellOpportunity {
  id: string;
  name: string;
  category: string;
  price: number;
  medianCategoryPrice: number;
  premiumFactor: number;
  rating: number;
  merchantTrustTier: string;
  upsellReason: string;
}

interface CrossSellPair {
  primaryCategory: string;
  complementaryCategory: string;
  tagOverlapScore: number;
  examplePrimary: { id: string; name: string; price: number };
  exampleComplement: { id: string; name: string; price: number };
  suggestion: string;
}

interface AbandonedCartSignal {
  transactionId: string;
  productName: string;
  productPrice: number;
  state: string;
  ageMinutes: number;
  recoveryHint: string;
}

interface CampaignSuggestion {
  category: string;
  productCount: number;
  avgRating: number;
  priceRange: { min: number; max: number };
  suggestion: string;
  suggestedAction: 'PRICE_DROP' | 'BUNDLE_OFFER' | 'HIGHLIGHT' | 'CROSS_PROMOTE';
}

interface GrowthReport {
  topRecommended: TopRecommendedProduct[];
  upsellOpportunities: UpsellOpportunity[];
  crossSellOpportunities: CrossSellPair[];
  abandonedCartSignals: AbandonedCartSignal[];
  campaignSuggestions: CampaignSuggestion[];
  generatedAt: string;
  dataNote: string;
}

// ── Sub-components ────────────────────────────────────────────

const SIGNAL_LABEL_META = {
  TOP_PICK: { cls: 'signal-top', text: '🏆 Top Pick' },
  HIGH_RATED: { cls: 'signal-high', text: '⭐ High Rated' },
  POPULAR: { cls: 'signal-pop', text: '📈 Popular' },
};

const CAMPAIGN_ACTION_META = {
  HIGHLIGHT: { cls: 'campaign-highlight', icon: '💡' },
  BUNDLE_OFFER: { cls: 'campaign-bundle', icon: '📦' },
  PRICE_DROP: { cls: 'campaign-price', icon: '🏷️' },
  CROSS_PROMOTE: { cls: 'campaign-cross', icon: '🔗' },
};

function TopRecommendedTable({ items }: { items: TopRecommendedProduct[] }) {
  if (items.length === 0) return <p className="dash-empty">No data available.</p>;
  return (
    <div className="dash-table-wrap">
      <table className="dash-table" id="top-recommended-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Price</th>
            <th>Rating</th>
            <th>Merchant</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const sig = SIGNAL_LABEL_META[p.signalLabel];
            return (
              <tr key={p.id}>
                <td className="dash-product-name">{p.name}</td>
                <td><span className="dash-tag">{p.category}</span></td>
                <td className="dash-price">₹{p.price.toLocaleString('en-IN')}</td>
                <td>
                  <span className="dash-rating">★ {p.rating.toFixed(1)}</span>
                </td>
                <td>
                  <span className="dash-merchant">{p.merchantName}</span>
                  <span className={`dash-tier tier-${p.merchantTrustTier.toLowerCase()}`}>{p.merchantTrustTier}</span>
                </td>
                <td><span className={`dash-signal ${sig.cls}`}>{sig.text}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UpsellList({ items }: { items: UpsellOpportunity[] }) {
  if (items.length === 0) return <p className="dash-empty">No upsell opportunities detected.</p>;
  return (
    <div className="upsell-grid">
      {items.map((u) => (
        <div key={u.id} className="upsell-card">
          <div className="upsell-name">{u.name}</div>
          <div className="upsell-cat">{u.category}</div>
          <div className="upsell-price">₹{u.price.toLocaleString('en-IN')}</div>
          <div className="upsell-vs">vs ₹{u.medianCategoryPrice.toLocaleString('en-IN')} median</div>
          <div className="upsell-reason">{u.upsellReason}</div>
          <div className="upsell-tier">{u.merchantTrustTier}</div>
        </div>
      ))}
    </div>
  );
}

function CrossSellList({ items }: { items: CrossSellPair[] }) {
  if (items.length === 0) return <p className="dash-empty">No cross-sell pairs detected.</p>;
  return (
    <div className="crosssell-list">
      {items.map((pair, i) => (
        <div key={i} className="crosssell-row">
          <div className="crosssell-cats">
            <span className="crosssell-cat">{pair.primaryCategory}</span>
            <span className="crosssell-arrow">↔</span>
            <span className="crosssell-cat">{pair.complementaryCategory}</span>
            <span className="crosssell-score">
              {Math.round(pair.tagOverlapScore * 100)}% overlap
            </span>
          </div>
          <div className="crosssell-examples">
            <span className="crosssell-ex">{pair.examplePrimary.name} (₹{pair.examplePrimary.price.toLocaleString('en-IN')})</span>
            <span className="crosssell-plus">+</span>
            <span className="crosssell-ex">{pair.exampleComplement.name} (₹{pair.exampleComplement.price.toLocaleString('en-IN')})</span>
          </div>
          <div className="crosssell-suggestion">{pair.suggestion}</div>
        </div>
      ))}
    </div>
  );
}

function AbandonedList({ items }: { items: AbandonedCartSignal[] }) {
  if (items.length === 0) {
    return (
      <div className="dash-empty-success">
        <span>✓</span> No stalled sessions detected
      </div>
    );
  }
  return (
    <div className="abandoned-list">
      {items.map((s) => (
        <div key={s.transactionId} className="abandoned-row">
          <div className="abandoned-header">
            <span className="abandoned-product">{s.productName}</span>
            <span className="abandoned-price">₹{s.productPrice.toLocaleString('en-IN')}</span>
            <span className="abandoned-age">{s.ageMinutes}m ago</span>
            <span className="abandoned-state">{s.state}</span>
          </div>
          <div className="abandoned-hint">💡 {s.recoveryHint}</div>
          <div className="abandoned-txn">ID: {s.transactionId.slice(0, 8)}…</div>
        </div>
      ))}
    </div>
  );
}

function CampaignList({ items }: { items: CampaignSuggestion[] }) {
  if (items.length === 0) return <p className="dash-empty">No campaign suggestions available.</p>;
  return (
    <div className="campaign-list">
      {items.map((c) => {
        const meta = CAMPAIGN_ACTION_META[c.suggestedAction];
        return (
          <div key={c.category} className={`campaign-card ${meta.cls}`}>
            <div className="campaign-header">
              <span className="campaign-icon">{meta.icon}</span>
              <span className="campaign-cat">{c.category}</span>
              <span className="campaign-action">{c.suggestedAction.replace('_', ' ')}</span>
            </div>
            <div className="campaign-stats">
              <span>{c.productCount} products</span>
              <span>★ {c.avgRating}</span>
              <span>₹{c.priceRange.min.toLocaleString('en-IN')} – ₹{c.priceRange.max.toLocaleString('en-IN')}</span>
            </div>
            <div className="campaign-suggestion">{c.suggestion}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────

type DashTab = 'top' | 'upsell' | 'crosssell' | 'abandoned' | 'campaigns';

export default function MerchantDashboard() {
  const [report, setReport] = useState<GrowthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashTab>('top');

  useEffect(() => {
    setLoading(true);
    fetch('/api/merchant-intelligence')
      .then(r => r.json())
      .then(data => {
        setReport(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load growth data');
        setLoading(false);
        console.error(err);
      });
  }, []);

  const TABS: { id: DashTab; label: string; icon: string; count?: number }[] = report
    ? [
        { id: 'top', label: 'Top Products', icon: '🏆', count: report.topRecommended.length },
        { id: 'upsell', label: 'Upsell', icon: '⬆️', count: report.upsellOpportunities.length },
        { id: 'crosssell', label: 'Cross-sell', icon: '🔗', count: report.crossSellOpportunities.length },
        { id: 'abandoned', label: 'Abandoned', icon: '⏳', count: report.abandonedCartSignals.length },
        { id: 'campaigns', label: 'Campaigns', icon: '📢', count: report.campaignSuggestions.length },
      ]
    : [];

  return (
    <div className="merchant-dashboard" id="merchant-dashboard">
      <div className="dash-header">
        <div className="dash-title-row">
          <h2 className="dash-title">📊 Merchant Growth Intelligence</h2>
          <div className="dash-synthetic-badge">
            🧪 Synthetic signals · Demo data
          </div>
        </div>
        {report && (
          <p className="dash-data-note">{report.dataNote}</p>
        )}
      </div>

      {loading && (
        <div className="dash-loading">
          <div className="dash-loading-spinner" />
          <span>Loading growth signals…</span>
        </div>
      )}

      {error && (
        <div className="dash-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {report && (
        <>
          {/* Tab nav */}
          <nav className="dash-tabs" aria-label="Dashboard sections">
            {TABS.map(tab => (
              <button
                key={tab.id}
                id={`dash-tab-${tab.id}`}
                className={`dash-tab-btn ${activeTab === tab.id ? 'dash-tab-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="dash-tab-count">{tab.count}</span>
                )}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="dash-content">
            {activeTab === 'top' && (
              <section aria-label="Top recommended products">
                <h3 className="dash-section-title">Top Recommended Products</h3>
                <p className="dash-section-desc">Highest-rated in-stock products by catalog signal.</p>
                <TopRecommendedTable items={report.topRecommended} />
              </section>
            )}

            {activeTab === 'upsell' && (
              <section aria-label="Upsell opportunities">
                <h3 className="dash-section-title">Upsell Opportunities</h3>
                <p className="dash-section-desc">Products priced 20–80% above category average with strong ratings — prime upsell candidates.</p>
                <UpsellList items={report.upsellOpportunities} />
              </section>
            )}

            {activeTab === 'crosssell' && (
              <section aria-label="Cross-sell opportunities">
                <h3 className="dash-section-title">Cross-sell Pairs</h3>
                <p className="dash-section-desc">Category pairs with high tag overlap — buyers of one frequently benefit from the other.</p>
                <CrossSellList items={report.crossSellOpportunities} />
              </section>
            )}

            {activeTab === 'abandoned' && (
              <section aria-label="Abandoned cart signals">
                <h3 className="dash-section-title">Stalled Sessions</h3>
                <p className="dash-section-desc">Transactions in non-terminal states older than 5 minutes. These may represent abandoned carts.</p>
                <AbandonedList items={report.abandonedCartSignals} />
              </section>
            )}

            {activeTab === 'campaigns' && (
              <section aria-label="Campaign suggestions">
                <h3 className="dash-section-title">Campaign Suggestions</h3>
                <p className="dash-section-desc">Structural catalog signals that suggest possible merchant actions.</p>
                <CampaignList items={report.campaignSuggestions} />
              </section>
            )}
          </div>

          <div className="dash-footer">
            Generated {new Date(report.generatedAt).toLocaleTimeString()} ·{' '}
            No actual conversion or revenue data used.
          </div>
        </>
      )}
    </div>
  );
}
