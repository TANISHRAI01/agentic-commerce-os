'use client';

import React, { useState } from 'react';

interface RecommendationItem {
  productId: string;
  productName: string;
  price: number;
  type: 'CROSS_SELL' | 'UPSELL' | 'BUNDLE' | 'CONTEXTUAL_OFFER';
  reason: string;
  isOptional: true;
}

interface RecommendationCardProps {
  item: RecommendationItem;
}

const TYPE_META = {
  CROSS_SELL: {
    label: 'Frequently Bought Together',
    icon: '🔗',
    colorClass: 'rec-type-cross',
    accentClass: 'rec-accent-cross',
  },
  UPSELL: {
    label: 'Upgrade Option',
    icon: '⬆️',
    colorClass: 'rec-type-upsell',
    accentClass: 'rec-accent-upsell',
  },
  BUNDLE: {
    label: 'Bundle Suggestion',
    icon: '📦',
    colorClass: 'rec-type-bundle',
    accentClass: 'rec-accent-bundle',
  },
  CONTEXTUAL_OFFER: {
    label: 'Relevant to You',
    icon: '✨',
    colorClass: 'rec-type-offer',
    accentClass: 'rec-accent-offer',
  },
} as const;

export default function RecommendationCard({ item }: RecommendationCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [accepted, setAccepted] = useState(false);

  if (dismissed) return null;

  const meta = TYPE_META[item.type];

  if (accepted) {
    return (
      <div className="rec-card rec-card-accepted">
        <span className="rec-accepted-icon">✓</span>
        <span className="rec-accepted-text">
          Added <strong>{item.productName}</strong> to your consideration list.
          You&apos;ll need to search for it separately to purchase.
        </span>
      </div>
    );
  }

  return (
    <div className={`rec-card ${meta.accentClass}`}>
      {/* Optional badge */}
      <div className="rec-optional-badge">
        <span className="rec-optional-dot" />
        Optional · Not in your cart
      </div>

      <div className="rec-card-body">
        <div className={`rec-type-badge ${meta.colorClass}`}>
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </div>

        <div className="rec-product-info">
          <div className="rec-product-name">{item.productName}</div>
          <div className="rec-product-price">₹{item.price.toLocaleString('en-IN')}</div>
        </div>

        <div className="rec-reason">{item.reason}</div>

        <div className="rec-actions">
          <button
            id={`rec-accept-${item.productId}`}
            className="rec-btn-accept"
            onClick={() => setAccepted(true)}
            title="Add to consideration list (informational only)"
          >
            Interested
          </button>
          <button
            id={`rec-dismiss-${item.productId}`}
            className="rec-btn-dismiss"
            onClick={() => setDismissed(true)}
            title="Dismiss this recommendation"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
