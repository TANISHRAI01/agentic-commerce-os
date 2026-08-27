'use client';

import React, { useState } from 'react';
import type { NegotiationResult } from '@/types/negotiation';

interface NegotiationPanelProps {
  negotiationResult: NegotiationResult;
  productName: string;
}

export default function NegotiationPanel({ negotiationResult, productName }: NegotiationPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const { outcome, originalPrice, negotiatedPrice, savingsAmount, savingsPercent, rounds, summary } = negotiationResult;

  const outcomeConfig = {
    DEAL: { icon: '🤝', label: 'Deal Reached', className: 'neg-outcome-deal' },
    NO_DEAL: { icon: '❌', label: 'No Deal', className: 'neg-outcome-nodeal' },
    SKIPPED: { icon: '⏭️', label: 'No Discount Available', className: 'neg-outcome-skipped' },
  }[outcome];

  return (
    <div className="negotiation-panel">
      <div className="negotiation-header" onClick={() => setExpanded(!expanded)}>
        <div className="negotiation-header-left">
          <span className="negotiation-icon">💬</span>
          <div>
            <div className="negotiation-title">Agent Negotiation</div>
            <div className="negotiation-subtitle">Buyer AI ↔ Merchant AI</div>
          </div>
        </div>
        <div className="negotiation-header-right">
          {outcome === 'DEAL' && savingsAmount > 0 && (
            <span className="neg-savings-badge">
              Saved ₹{savingsAmount.toLocaleString('en-IN')} ({savingsPercent}%)
            </span>
          )}
          <span className={`neg-outcome-badge ${outcomeConfig.className}`}>
            {outcomeConfig.icon} {outcomeConfig.label}
          </span>
          <span className="neg-toggle">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="negotiation-body">
          {/* Negotiation rounds as a conversation */}
          {rounds.length === 0 && outcome === 'SKIPPED' && (
            <div className="neg-skip-msg">
              <span>⏭️</span>
              <span>{summary}</span>
            </div>
          )}

          {rounds.map((round) => (
            <div key={round.round} className="neg-round">
              <div className="neg-round-label">Round {round.round}</div>

              {/* Buyer message */}
              <div className="neg-bubble neg-bubble-buyer">
                <div className="neg-bubble-header">
                  <span className="neg-avatar">🛒</span>
                  <span className="neg-agent-name">Buyer Agent</span>
                  <span className="neg-price-tag">Max ₹{round.buyerPrice.toLocaleString('en-IN')}</span>
                </div>
                <div className="neg-bubble-msg">{round.buyerMessage}</div>
              </div>

              {/* Merchant message */}
              <div className="neg-bubble neg-bubble-merchant">
                <div className="neg-bubble-header">
                  <span className="neg-avatar">🏪</span>
                  <span className="neg-agent-name">Merchant Agent</span>
                  <span className={`neg-price-tag ${round.dealReached ? 'neg-price-deal' : ''}`}>
                    ₹{round.merchantPrice.toLocaleString('en-IN')}
                    {round.dealReached && ' ✓'}
                  </span>
                </div>
                <div className="neg-bubble-msg">{round.merchantMessage}</div>
              </div>
            </div>
          ))}

          {/* Final price summary */}
          <div className="neg-summary">
            <div className="neg-summary-row">
              <span>Listed Price</span>
              <span className={outcome === 'DEAL' && savingsAmount > 0 ? 'neg-price-struck' : ''}>
                ₹{originalPrice.toLocaleString('en-IN')}
              </span>
            </div>
            {outcome === 'DEAL' && savingsAmount > 0 && (
              <div className="neg-summary-row neg-summary-final">
                <span>🤝 Negotiated Price</span>
                <span className="neg-price-final">₹{negotiatedPrice.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="neg-summary-note">
              {outcome === 'DEAL' && savingsAmount > 0
                ? `You saved ₹${savingsAmount.toLocaleString('en-IN')} on ${productName}`
                : summary}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
