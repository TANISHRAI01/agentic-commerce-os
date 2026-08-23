'use client';

import React from 'react';

export default function LoadingState() {
  return (
    <div className="loading-state">
      <div className="loading-steps">
        <div className="loading-step loading-step-active">
          <div className="loading-step-icon">
            <div className="loading-spinner" />
          </div>
          <div className="loading-step-content">
            <span className="loading-step-title">Understanding your request</span>
            <span className="loading-step-subtitle">Parsing intent with AI…</span>
          </div>
        </div>

        <div className="loading-step loading-step-pending">
          <div className="loading-step-icon">
            <div className="loading-dot" />
          </div>
          <div className="loading-step-content">
            <span className="loading-step-title">Searching catalog</span>
            <span className="loading-step-subtitle">Finding matching products…</span>
          </div>
        </div>

        <div className="loading-step loading-step-pending">
          <div className="loading-step-icon">
            <div className="loading-dot" />
          </div>
          <div className="loading-step-content">
            <span className="loading-step-title">Ranking products</span>
            <span className="loading-step-subtitle">Selecting the best match…</span>
          </div>
        </div>
      </div>

      <div className="loading-shimmer-cards">
        <div className="shimmer-card">
          <div className="shimmer-line shimmer-line-long" />
          <div className="shimmer-line shimmer-line-medium" />
          <div className="shimmer-line shimmer-line-short" />
        </div>
      </div>
    </div>
  );
}
