'use client';

import React from 'react';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    currency?: string;
    rating: number;
    deliveryDays: number;
    merchantTrustTier: string;
    category: string;
    tags: string[];
    attributes: Record<string, string>;
    stock: number;
  };
  isRecommended?: boolean;
  alternativeReason?: string;
  alternativeScore?: number;
}

export default function ProductCard({
  product,
  isRecommended = false,
  alternativeReason,
  alternativeScore,
}: ProductCardProps) {

  // Map category to a material symbol icon
  const getCategoryIcon = (category: string) => {
    const lower = category.toLowerCase();
    if (lower.includes('audio') || lower.includes('headphone')) return 'headphones';
    if (lower.includes('electronics') || lower.includes('laptop') || lower.includes('monitor')) return 'monitor';
    if (lower.includes('book')) return 'menu_book';
    if (lower.includes('fitness') || lower.includes('health')) return 'favorite';
    if (lower.includes('kitchen') || lower.includes('home')) return 'kitchen';
    return 'inventory_2';
  };

  const getTrustBadgeStyle = (tier: string) => {
    const t = tier.toLowerCase();
    if (t === 'platinum') return 'bg-surface-variant text-[#e5e4e2] border-[#e5e4e2]/30';
    if (t === 'gold') return 'bg-surface-variant text-[#ffd700] border-[#ffd700]/30';
    if (t === 'silver') return 'bg-surface-variant text-[#c0c0c0] border-[#c0c0c0]/30';
    if (t === 'bronze') return 'bg-surface-variant text-[#cd7f32] border-[#cd7f32]/30';
    return 'bg-surface-variant text-on-surface-variant border-outline-variant/30';
  };

  return (
    <div className={`bg-surface-container-lowest/50 rounded-lg p-4 flex gap-5 border border-outline-variant/20 hover:bg-surface-container-lowest/80 transition-colors cursor-pointer group ${!isRecommended ? 'opacity-85' : ''}`}>
      <div className="w-24 h-24 rounded-md bg-surface-container-high border border-outline-variant/10 flex-shrink-0 relative overflow-hidden flex items-center justify-center">
        <span className="material-symbols-outlined text-outline-variant text-3xl">{getCategoryIcon(product.category)}</span>
      </div>
      
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors truncate">{product.name}</h3>
          <span className={`font-label-micro text-label-micro uppercase px-2 py-1 rounded border ${getTrustBadgeStyle(product.merchantTrustTier)} flex-shrink-0`}>
            {product.merchantTrustTier}
          </span>
        </div>
        
        <p className="font-body-main text-body-main text-on-surface-variant text-sm mb-2 line-clamp-1">{product.description}</p>
        
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1 font-tabular-data text-tabular-data text-xs text-on-surface-variant">
            <span className="text-secondary">★</span> {product.rating.toFixed(1)}
          </div>
          <div className="flex items-center gap-1 font-body-main text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[14px]">local_shipping</span> 
            {product.deliveryDays === 1 ? 'Tomorrow' : `${product.deliveryDays} days`}
          </div>
          <div className={`font-body-main text-xs ${product.stock > 10 ? 'text-[#4ade80]' : 'text-warning'}`}>
            {product.stock > 10 ? 'In Stock' : `Only ${product.stock} left`}
          </div>
        </div>

        <div className="flex items-baseline gap-2 mt-auto flex-wrap">
          <span className="font-tabular-data text-tabular-data text-lg text-on-surface">₹{product.price.toLocaleString('en-IN')}</span>
          {alternativeReason && (
            <span className="font-label-micro text-label-micro text-warning ml-auto uppercase bg-warning/10 px-2 py-1 rounded border border-warning/20 text-[10px]">
              {alternativeScore}% Match
            </span>
          )}
        </div>
        
        {alternativeReason && (
          <p className="font-body-main text-xs text-on-surface-variant mt-2 bg-surface-variant/30 p-2 rounded line-clamp-2">
            <span className="text-warning mr-1">↳</span>{alternativeReason}
          </p>
        )}
      </div>
    </div>
  );
}
