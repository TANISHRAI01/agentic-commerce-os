'use client';

import React from 'react';

export default function LoadingState() {
  return (
    <div className="flex flex-col gap-4 w-full mt-8">
      <div className="flex items-center gap-2 mb-1 opacity-60 pl-2">
        <span className="material-symbols-outlined text-[16px] text-primary ai-pulse">smart_toy</span>
        <span className="font-tabular-data text-tabular-data text-primary">SYS_PROCESSING</span>
      </div>
      
      <div className="glass-panel rounded-xl p-5 border-l-2 border-l-primary relative overflow-hidden bg-surface-container-lowest/50">
        <div className="flex items-start gap-4 mb-4 opacity-50">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="btn-spinner border-primary"></span>
          </div>
          <div>
            <div className="font-headline-sm text-on-surface text-sm">Understanding Request</div>
            <div className="font-body-main text-on-surface-variant text-xs">Parsing intent and checking policies...</div>
          </div>
        </div>

        <div className="flex items-start gap-4 mb-4 opacity-30">
          <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">search</span>
          </div>
          <div>
            <div className="font-headline-sm text-on-surface text-sm">Searching Catalog</div>
            <div className="font-body-main text-on-surface-variant text-xs">Finding matching products...</div>
          </div>
        </div>

        <div className="flex items-start gap-4 opacity-20">
          <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">sort</span>
          </div>
          <div>
            <div className="font-headline-sm text-on-surface text-sm">Ranking Products</div>
            <div className="font-body-main text-on-surface-variant text-xs">Selecting the best match...</div>
          </div>
        </div>
      </div>
    </div>
  );
}
