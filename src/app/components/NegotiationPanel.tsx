'use client';

import React, { useState } from 'react';
import type { NegotiationResult } from '@/types/negotiation';

interface NegotiationPanelProps {
  negotiationResult: NegotiationResult;
  productName: string;
}

export default function NegotiationPanel({ negotiationResult, productName }: NegotiationPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const { outcome, originalPrice, negotiatedPrice, savingsAmount, savingsPercent, rounds, summary } = negotiationResult;

  const outcomeConfig = {
    DEAL: { icon: 'handshake', label: 'Deal Reached', color: 'text-[#4ade80]' },
    NO_DEAL: { icon: 'close', label: 'No Deal', color: 'text-error' },
    SKIPPED: { icon: 'skip_next', label: 'No Discount', color: 'text-on-surface-variant' },
  }[outcome];

  return (
    <div className="glass-panel rounded-xl overflow-hidden border-l-2 border-l-secondary-fixed-dim">
      <button 
        className="w-full p-4 flex items-center justify-between text-left hover:bg-surface-variant/20 transition-colors" 
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`material-symbols-outlined ${outcomeConfig.color}`}>{outcomeConfig.icon}</span>
          <div>
            <span className="font-body-main text-body-main text-on-surface block">
              {outcome === 'DEAL' ? `Negotiation successful. Saved ₹${savingsAmount.toLocaleString('en-IN')}` : 
               outcome === 'NO_DEAL' ? 'Negotiation failed.' : 'Negotiation skipped.'}
            </span>
            <span className="font-label-micro text-label-micro text-on-surface-variant uppercase mt-1 block">
              {rounds.length} {rounds.length === 1 ? 'round' : 'rounds'} • {outcomeConfig.label}
            </span>
          </div>
        </div>
        <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {expanded && (
        <div className="p-4 border-t border-outline-variant/10 bg-surface-container-lowest/30">
          <div className="space-y-4">
            {rounds.length === 0 && outcome === 'SKIPPED' && (
              <div className="flex gap-4">
                <div className="font-tabular-data text-tabular-data text-on-surface-variant text-xs mt-1 w-16">Info</div>
                <div className="flex-1">
                  <p className="font-body-main text-body-main text-sm text-on-surface">{summary}</p>
                </div>
              </div>
            )}

            {rounds.map((round) => (
              <div key={round.round} className="flex gap-4">
                <div className="font-tabular-data text-tabular-data text-on-surface-variant text-xs mt-1 w-16 shrink-0">Round {round.round}</div>
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="font-body-main text-body-main text-sm text-on-surface">
                      <span className="text-secondary mr-2">🤖 Buyer:</span>
                      {round.buyerMessage} <span className="text-on-surface-variant ml-1">(Offered ₹{round.buyerPrice.toLocaleString('en-IN')})</span>
                    </p>
                  </div>
                  <div>
                    <p className={`font-body-main text-body-main text-sm ${round.dealReached ? 'text-[#4ade80]' : 'text-error'}`}>
                      <span className="mr-2">🏪 Merchant:</span>
                      {round.merchantMessage} <span className="opacity-80 ml-1">(Countered ₹{round.merchantPrice.toLocaleString('en-IN')})</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-4 border-t border-outline-variant/10 pt-4 mt-2">
              <div className="font-tabular-data text-tabular-data text-on-surface-variant text-xs mt-1 w-16 shrink-0">Result</div>
              <div className="flex-1">
                {outcome === 'DEAL' ? (
                  <p className="font-body-main text-body-main text-sm text-[#4ade80]">
                    Final price settled at ₹{negotiatedPrice.toLocaleString('en-IN')}. Listed price was ₹{originalPrice.toLocaleString('en-IN')}.
                  </p>
                ) : (
                  <p className="font-body-main text-body-main text-sm text-on-surface-variant">
                    {summary}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
