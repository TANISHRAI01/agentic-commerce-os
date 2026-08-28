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
  TOP_PICK: { cls: 'text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/10', text: '🏆 Top Pick' },
  HIGH_RATED: { cls: 'text-secondary border-secondary/30 bg-secondary/10', text: '⭐ High Rated' },
  POPULAR: { cls: 'text-primary border-primary/30 bg-primary/10', text: '📈 Popular' },
};

const CAMPAIGN_ACTION_META = {
  HIGHLIGHT: { cls: 'text-primary bg-primary/10 border-primary/20', icon: '💡' },
  BUNDLE_OFFER: { cls: 'text-secondary bg-secondary/10 border-secondary/20', icon: '📦' },
  PRICE_DROP: { cls: 'text-warning bg-warning/10 border-warning/20', icon: '🏷️' },
  CROSS_PROMOTE: { cls: 'text-tertiary bg-tertiary/10 border-tertiary/20', icon: '🔗' },
};

function TopRecommendedTable({ items }: { items: TopRecommendedProduct[] }) {
  if (items.length === 0) return <p className="p-4 text-on-surface-variant font-tabular-data">No data available.</p>;
  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-left border-collapse whitespace-nowrap">
        <thead>
          <tr className="border-b border-outline-variant/20 bg-surface/50">
            <th className="py-3 px-4 font-label-micro text-label-micro text-on-surface-variant uppercase tracking-widest font-normal">Product</th>
            <th className="py-3 px-4 font-label-micro text-label-micro text-on-surface-variant uppercase tracking-widest font-normal">Category</th>
            <th className="py-3 px-4 font-label-micro text-label-micro text-on-surface-variant uppercase tracking-widest font-normal">Price</th>
            <th className="py-3 px-4 font-label-micro text-label-micro text-on-surface-variant uppercase tracking-widest font-normal">Rating</th>
            <th className="py-3 px-4 font-label-micro text-label-micro text-on-surface-variant uppercase tracking-widest font-normal">Merchant</th>
            <th className="py-3 px-4 font-label-micro text-label-micro text-on-surface-variant uppercase tracking-widest font-normal">Signal</th>
          </tr>
        </thead>
        <tbody className="font-tabular-data text-tabular-data text-on-surface">
          {items.map((p) => {
            const sig = SIGNAL_LABEL_META[p.signalLabel];
            return (
              <tr key={p.id} className="border-b border-outline-variant/10 hover:bg-white/5 transition-colors">
                <td className="py-3 px-4">{p.name}</td>
                <td className="py-3 px-4"><span className="px-2 py-1 rounded-full text-[10px] uppercase border border-outline-variant/30 bg-surface-variant/30">{p.category}</span></td>
                <td className="py-3 px-4 tabular-nums">₹{p.price.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 tabular-nums text-secondary">★ {p.rating.toFixed(1)}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-col">
                    <span>{p.merchantName}</span>
                    <span className="text-[10px] text-on-surface-variant uppercase">{p.merchantTrustTier}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] uppercase border ${sig.cls}`}>{sig.text}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UpsellList({ items }: { items: UpsellOpportunity[] }) {
  if (items.length === 0) return <p className="p-4 text-on-surface-variant">No upsell opportunities detected.</p>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {items.map((u) => (
        <div key={u.id} className="glass-panel p-4 rounded-xl border border-outline-variant/20 hover:border-outline-variant/50 transition-colors">
          <div className="font-headline-sm text-on-surface mb-1 truncate">{u.name}</div>
          <div className="font-label-micro uppercase text-on-surface-variant mb-3">{u.category}</div>
          <div className="flex items-end gap-2 mb-2">
            <span className="font-tabular-data text-lg text-primary">₹{u.price.toLocaleString('en-IN')}</span>
            <span className="font-tabular-data text-xs text-on-surface-variant mb-1 line-through">₹{u.medianCategoryPrice.toLocaleString('en-IN')}</span>
          </div>
          <div className="font-body-main text-sm text-on-surface-variant bg-surface-variant/30 p-2 rounded">{u.upsellReason}</div>
        </div>
      ))}
    </div>
  );
}

function CrossSellList({ items }: { items: CrossSellPair[] }) {
  if (items.length === 0) return <p className="p-4 text-on-surface-variant">No cross-sell pairs detected.</p>;
  return (
    <div className="flex flex-col gap-2 p-4">
      {items.map((pair, i) => (
        <div key={i} className="glass-panel p-4 rounded-xl border border-outline-variant/20 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-label-micro uppercase bg-surface-variant/50 px-2 py-1 rounded border border-outline-variant/30">{pair.primaryCategory}</span>
              <span className="material-symbols-outlined text-outline-variant text-[16px]">sync_alt</span>
              <span className="font-label-micro uppercase bg-surface-variant/50 px-2 py-1 rounded border border-outline-variant/30">{pair.complementaryCategory}</span>
              <span className="font-tabular-data text-[12px] text-tertiary ml-2">{Math.round(pair.tagOverlapScore * 100)}% Match</span>
            </div>
            <div className="font-body-main text-sm text-on-surface-variant">{pair.suggestion}</div>
          </div>
          <div className="bg-surface-variant/30 p-2 rounded text-xs font-tabular-data text-on-surface whitespace-nowrap">
            {pair.examplePrimary.name} + {pair.exampleComplement.name}
          </div>
        </div>
      ))}
    </div>
  );
}

function AbandonedList({ items }: { items: AbandonedCartSignal[] }) {
  if (items.length === 0) {
    return <div className="p-4 text-[#4ade80] flex items-center gap-2"><span className="material-symbols-outlined">check_circle</span> No stalled sessions detected</div>;
  }
  return (
    <div className="flex flex-col gap-2 p-4">
      {items.map((s) => (
        <div key={s.transactionId} className="glass-panel p-4 rounded-xl border border-warning/30 bg-warning/5">
          <div className="flex justify-between items-start mb-2">
            <span className="font-headline-sm text-on-surface">{s.productName}</span>
            <span className="font-tabular-data text-primary">₹{s.productPrice.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center gap-4 mb-3 font-tabular-data text-xs text-on-surface-variant">
            <span className="bg-surface-variant/50 px-2 py-1 rounded uppercase">{s.state}</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">schedule</span> {s.ageMinutes}m ago</span>
          </div>
          <div className="font-body-main text-sm text-warning bg-warning/10 p-2 rounded inline-block">💡 {s.recoveryHint}</div>
        </div>
      ))}
    </div>
  );
}

function CampaignList({ items }: { items: CampaignSuggestion[] }) {
  if (items.length === 0) return <p className="p-4 text-on-surface-variant">No campaign suggestions available.</p>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {items.map((c) => {
        const meta = CAMPAIGN_ACTION_META[c.suggestedAction];
        return (
          <div key={c.category} className={`glass-panel p-4 rounded-xl border ${meta.cls.split(' ')[2]} ${meta.cls.split(' ')[1]}`}>
            <div className="flex items-center gap-2 mb-3">
              <span>{meta.icon}</span>
              <span className="font-label-micro uppercase tracking-widest flex-1">{c.category}</span>
              <span className={`font-label-micro uppercase px-2 py-1 rounded border ${meta.cls}`}>{c.suggestedAction.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between font-tabular-data text-xs text-on-surface-variant mb-3">
              <span>{c.productCount} items</span>
              <span>★ {c.avgRating.toFixed(1)}</span>
              <span>₹{c.priceRange.min} - ₹{c.priceRange.max}</span>
            </div>
            <div className="font-body-main text-sm text-on-surface">{c.suggestion}</div>
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

  const TABS: { id: DashTab; label: string; count?: number }[] = report
    ? [
        { id: 'top', label: 'Top Products', count: report.topRecommended.length },
        { id: 'upsell', label: 'Upsell', count: report.upsellOpportunities.length },
        { id: 'crosssell', label: 'Cross-sell', count: report.crossSellOpportunities.length },
        { id: 'abandoned', label: 'Abandoned', count: report.abandonedCartSignals.length },
        { id: 'campaigns', label: 'Campaigns', count: report.campaignSuggestions.length },
      ]
    : [];

  return (
    <div className="w-full">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-stack_md mb-stack_lg w-full">
        <div className="flex gap-stack_md overflow-x-auto pb-2 w-full md:w-auto custom-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full font-tabular-data text-tabular-data whitespace-nowrap transition-colors border ${activeTab === tab.id ? 'bg-primary-container text-on-primary-container border-primary-container' : 'bg-surface-container text-on-surface border-outline-variant/20 hover:bg-surface-variant'}`}
            >
              {tab.label} {tab.count !== undefined && `(${tab.count})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-stack_md shrink-0">
          <div className="glass-panel flex items-center rounded-full px-1 py-1">
            <button className="px-3 py-1.5 text-on-surface font-label-micro text-label-micro uppercase tracking-widest rounded-full bg-surface-variant/50">30D</button>
            <button className="px-3 py-1.5 text-on-surface-variant font-label-micro text-label-micro uppercase tracking-widest rounded-full hover:bg-surface-variant/30">90D</button>
            <button className="px-3 py-1.5 text-on-surface-variant font-label-micro text-label-micro uppercase tracking-widest rounded-full hover:bg-surface-variant/30">YTD</button>
          </div>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack_lg">
        <div className="glass-panel rounded-xl p-stack_md flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start">
            <span className="font-label-micro text-label-micro text-on-surface-variant uppercase tracking-widest">Gross Volume</span>
            <span className="material-symbols-outlined text-outline">payments</span>
          </div>
          <div className="flex items-end gap-stack_sm">
            <span className="font-headline-md text-headline-md text-on-surface tabular-nums">₹4.2M</span>
            <div className="flex items-center text-[#93c5fd] bg-[#93c5fd]/10 px-2 py-0.5 rounded border border-[#93c5fd]/20 mb-1">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span className="font-tabular-data text-tabular-data text-[12px] ml-1">12.4%</span>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-xl p-stack_md flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start">
            <span className="font-label-micro text-label-micro text-on-surface-variant uppercase tracking-widest">Conversion Rate</span>
            <span className="material-symbols-outlined text-outline">troubleshoot</span>
          </div>
          <div className="flex items-end gap-stack_sm">
            <span className="font-headline-md text-headline-md text-on-surface tabular-nums">12.8%</span>
            <div className="flex items-center text-[#86efac] bg-[#86efac]/10 px-2 py-0.5 rounded border border-[#86efac]/20 mb-1">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span className="font-tabular-data text-tabular-data text-[12px] ml-1">2.1%</span>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-xl p-stack_md flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start">
            <span className="font-label-micro text-label-micro text-on-surface-variant uppercase tracking-widest">At-Risk Revenue</span>
            <span className="material-symbols-outlined text-outline">warning</span>
          </div>
          <div className="flex items-end gap-stack_sm">
            <span className="font-headline-md text-headline-md text-on-surface tabular-nums">₹142K</span>
            <div className="flex items-center text-[#fca5a5] bg-[#fca5a5]/10 px-2 py-0.5 rounded border border-[#fca5a5]/20 mb-1">
              <span className="material-symbols-outlined text-[14px]">trending_down</span>
              <span className="font-tabular-data text-tabular-data text-[12px] ml-1">-4.2%</span>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3 p-4 text-on-surface-variant">
          <span className="btn-spinner border-primary"></span>
          <span>Loading growth signals…</span>
        </div>
      )}

      {error && (
        <div className="glass-panel rounded-xl p-4 text-error border-error/30 flex items-center gap-2">
          <span className="material-symbols-outlined">error</span> {error}
        </div>
      )}

      {report && (
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="p-stack_md border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low/50">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {TABS.find(t => t.id === activeTab)?.label}
            </h2>
            <div className="font-label-micro text-label-micro text-on-surface-variant uppercase border border-outline-variant/30 rounded-full px-2 py-1">
              🧪 Synthetic Data
            </div>
          </div>

          <div className="w-full">
            {activeTab === 'top' && <TopRecommendedTable items={report.topRecommended} />}
            {activeTab === 'upsell' && <UpsellList items={report.upsellOpportunities} />}
            {activeTab === 'crosssell' && <CrossSellList items={report.crossSellOpportunities} />}
            {activeTab === 'abandoned' && <AbandonedList items={report.abandonedCartSignals} />}
            {activeTab === 'campaigns' && <CampaignList items={report.campaignSuggestions} />}
          </div>
        </div>
      )}
    </div>
  );
}
