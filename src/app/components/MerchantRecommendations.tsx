'use client';

import React, { useState } from 'react';
import RecommendationCard from './RecommendationCard';

interface RecommendationItem {
  productId: string;
  productName: string;
  price: number;
  type: 'CROSS_SELL' | 'UPSELL' | 'BUNDLE' | 'CONTEXTUAL_OFFER';
  reason: string;
  isOptional: true;
}

interface MerchantRecommendations {
  crossSells: RecommendationItem[];
  upsells: RecommendationItem[];
  bundles: RecommendationItem[];
  contextualOffer: RecommendationItem | null;
  summary: string;
}

interface MerchantRecommendationsProps {
  recommendations: MerchantRecommendations;
}

export default function MerchantRecommendations({ recommendations }: MerchantRecommendationsProps) {
  const [expanded, setExpanded] = useState(true);

  const allItems: RecommendationItem[] = [
    ...recommendations.crossSells,
    ...recommendations.upsells,
    ...recommendations.bundles,
    ...(recommendations.contextualOffer ? [recommendations.contextualOffer] : []),
  ];

  if (allItems.length === 0) return null;

  return (
    <div className="merchant-recs-section">
      <button
        id="merchant-recs-toggle"
        className="merchant-recs-header"
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
      >
        <div className="merchant-recs-title">
          <span className="merchant-recs-icon">🛍️</span>
          <span>You Might Also Like</span>
          <span className="merchant-recs-count">{allItems.length}</span>
        </div>
        <div className="merchant-recs-meta">
          <span className="merchant-recs-optional-notice">All optional · Not auto-charged</span>
          <span className="merchant-recs-chevron">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="merchant-recs-body">
          {recommendations.summary && (
            <p className="merchant-recs-summary">{recommendations.summary}</p>
          )}

          {recommendations.crossSells.length > 0 && (
            <div className="rec-group">
              <div className="rec-group-label">🔗 Frequently Bought Together</div>
              <div className="rec-group-cards">
                {recommendations.crossSells.map((item) => (
                  <RecommendationCard key={item.productId} item={item} />
                ))}
              </div>
            </div>
          )}

          {recommendations.upsells.length > 0 && (
            <div className="rec-group">
              <div className="rec-group-label">⬆️ Upgrade Options</div>
              <div className="rec-group-cards">
                {recommendations.upsells.map((item) => (
                  <RecommendationCard key={item.productId} item={item} />
                ))}
              </div>
            </div>
          )}

          {recommendations.bundles.length > 0 && (
            <div className="rec-group">
              <div className="rec-group-label">📦 Bundle Suggestions</div>
              <div className="rec-group-cards">
                {recommendations.bundles.map((item) => (
                  <RecommendationCard key={item.productId} item={item} />
                ))}
              </div>
            </div>
          )}

          {recommendations.contextualOffer && (
            <div className="rec-group">
              <div className="rec-group-label">✨ Just for You</div>
              <div className="rec-group-cards">
                <RecommendationCard item={recommendations.contextualOffer} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
