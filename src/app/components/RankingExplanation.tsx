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
    <div className="mb-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <p className="font-body-main text-body-main text-on-surface flex-1 leading-relaxed">
          {summary}
        </p>
        <div className="flex flex-col items-center shrink-0">
          <div className="relative w-12 h-12 flex items-center justify-center mb-1">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#6366f1"
                strokeWidth="3"
                strokeDasharray={`${confidenceScore}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute font-tabular-data text-[11px] font-bold text-on-surface">{confidenceScore}%</span>
          </div>
          <span className="font-label-micro text-label-micro text-on-surface-variant uppercase tracking-widest text-[9px]">Match</span>
        </div>
      </div>

      <div className="bg-surface-container-lowest/30 rounded p-4 border border-outline-variant/10">
        <h4 className="font-label-micro text-label-micro text-on-surface-variant uppercase mb-3">Why this product?</h4>
        
        <div className="flex flex-wrap gap-2 mb-3">
          {reasons.map((reason, i) => (
            <div
              key={i}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${
                reason.satisfied 
                  ? 'bg-[#4ade80]/10 border-[#4ade80]/30 text-[#4ade80]' 
                  : 'bg-error/10 border-error/30 text-error'
              }`}
              title={reason.explanation}
            >
              <span className="material-symbols-outlined text-[12px]">{reason.satisfied ? 'check' : 'close'}</span>
              <span className="font-body-main">{reason.factor}</span>
            </div>
          ))}
        </div>
        
        <div className="space-y-2">
          {reasons.map((reason, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className={`mt-0.5 text-[10px] ${reason.satisfied ? 'text-[#4ade80]' : 'text-error'}`}>●</span>
              <span className="font-body-main text-on-surface-variant">{reason.explanation}</span>
            </div>
          ))}
        </div>
      </div>

      {alternatives.length > 0 && (
        <div className="mt-2">
          <button
            className="flex items-center gap-1 font-label-micro text-label-micro text-on-surface-variant uppercase hover:text-primary transition-colors"
            onClick={() => setShowAlternatives(!showAlternatives)}
          >
            <span className={`material-symbols-outlined text-[16px] transition-transform ${showAlternatives ? 'rotate-180' : ''}`}>
              arrow_drop_down
            </span>
            {alternatives.length} alternative{alternatives.length > 1 ? 's' : ''} considered
          </button>

          {showAlternatives && (
            <div className="mt-2 space-y-2">
              {alternatives.map((alt, i) => (
                <div key={i} className="bg-surface-container-lowest/30 p-3 rounded border border-outline-variant/10">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-headline-sm text-[13px] text-on-surface">
                      {alt.product?.name ?? alt.productId}
                    </span>
                    <span className="font-tabular-data text-[12px] text-on-surface-variant border border-outline-variant/20 rounded px-1">{alt.score}%</span>
                  </div>
                  {alt.product && (
                    <div className="font-tabular-data text-[12px] text-on-surface mb-1">₹{alt.product.price.toLocaleString('en-IN')}</div>
                  )}
                  <span className="font-body-main text-[11px] text-on-surface-variant">{alt.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
