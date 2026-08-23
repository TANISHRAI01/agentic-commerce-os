'use client';

import React, { useState } from 'react';

interface RankingReason {
  factor: string;
  explanation: string;
  satisfied: boolean;
}

interface Alternative {
  productId: string;
  reason: string;
  score: number;
  product?: {
    id: string;
    name: string;
    price: number;
    rating: number;
    deliveryDays: number;
  } | null;
}

interface RankingExplanationProps {
  summary: string;
  confidenceScore: number;
  reasons: RankingReason[];
  alternatives: Alternative[];
}

export default function RankingExplanation({
  summary,
  confidenceScore,
  reasons,
  alternatives,
}: RankingExplanationProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);

  return (
    <div className="ranking-explanation">
      <div className="ranking-header">
        <div className="ranking-summary">
          <span className="ranking-icon">🎯</span>
          <p className="ranking-summary-text">{summary}</p>
        </div>
        <div className="confidence-badge">
          <div className="confidence-ring">
            <svg viewBox="0 0 36 36" className="confidence-svg">
              <path
                className="confidence-bg"
                d="M18 2.0845
                   a 15.9155 15.9155 0 0 1 0 31.831
                   a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="3"
              />
              <path
                className="confidence-fill"
                d="M18 2.0845
                   a 15.9155 15.9155 0 0 1 0 31.831
                   a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="url(#confidenceGradient)"
                strokeWidth="3"
                strokeDasharray={`${confidenceScore}, 100`}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="confidenceGradient">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>
            </svg>
            <span className="confidence-value">{confidenceScore}%</span>
          </div>
          <span className="confidence-label">Match</span>
        </div>
      </div>

      <div className="ranking-reasons">
        <h4 className="ranking-section-title">Why this product?</h4>
        <div className="reason-chips">
          {reasons.map((reason, i) => (
            <div
              key={i}
              className={`reason-chip ${reason.satisfied ? 'reason-satisfied' : 'reason-unsatisfied'}`}
              title={reason.explanation}
            >
              <span className="reason-icon">{reason.satisfied ? '✓' : '✗'}</span>
              <span className="reason-factor">{reason.factor}</span>
            </div>
          ))}
        </div>
        <div className="reason-details">
          {reasons.map((reason, i) => (
            <div key={i} className="reason-detail-row">
              <span className={`reason-dot ${reason.satisfied ? 'dot-satisfied' : 'dot-unsatisfied'}`}>●</span>
              <span className="reason-detail-text">{reason.explanation}</span>
            </div>
          ))}
        </div>
      </div>

      {alternatives.length > 0 && (
        <div className="ranking-alternatives">
          <button
            className="alternatives-toggle"
            onClick={() => setShowAlternatives(!showAlternatives)}
          >
            <span>{showAlternatives ? '▾' : '▸'} {alternatives.length} alternative{alternatives.length > 1 ? 's' : ''} considered</span>
          </button>

          {showAlternatives && (
            <div className="alternatives-list">
              {alternatives.map((alt, i) => (
                <div key={i} className="alternative-item">
                  <div className="alt-item-header">
                    <span className="alt-item-name">
                      {alt.product?.name ?? alt.productId}
                    </span>
                    <span className="alt-item-score">{alt.score}%</span>
                  </div>
                  {alt.product && (
                    <span className="alt-item-price">₹{alt.product.price.toLocaleString('en-IN')}</span>
                  )}
                  <span className="alt-item-reason">{alt.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
