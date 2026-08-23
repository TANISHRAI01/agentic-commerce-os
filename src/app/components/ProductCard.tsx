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
  const trustBadgeClass = `trust-badge trust-${product.merchantTrustTier.toLowerCase()}`;

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.3;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<span key={i} className="star star-full">★</span>);
      } else if (i === fullStars && hasHalf) {
        stars.push(<span key={i} className="star star-half">★</span>);
      } else {
        stars.push(<span key={i} className="star star-empty">★</span>);
      }
    }
    return stars;
  };

  return (
    <div className={`product-card ${isRecommended ? 'product-card-recommended' : 'product-card-alternative'}`}>
      {isRecommended && (
        <div className="product-recommended-badge">
          <span className="badge-icon">⭐</span> Top Recommendation
        </div>
      )}

      <div className="product-card-header">
        <div className="product-name-row">
          <h3 className="product-name">{product.name}</h3>
          <span className={trustBadgeClass}>{product.merchantTrustTier}</span>
        </div>
        <p className="product-description">{product.description}</p>
      </div>

      <div className="product-card-meta">
        <div className="product-price">
          <span className="price-symbol">₹</span>
          <span className="price-amount">{product.price.toLocaleString('en-IN')}</span>
        </div>

        <div className="product-stats">
          <div className="product-rating">
            <div className="stars-container">{renderStars(product.rating)}</div>
            <span className="rating-number">{product.rating}</span>
          </div>

          <div className="product-delivery">
            <span className="delivery-icon">🚚</span>
            <span>{product.deliveryDays === 1 ? 'Tomorrow' : `${product.deliveryDays} days`}</span>
          </div>

          <div className="product-stock">
            <span className={`stock-indicator ${product.stock > 10 ? 'stock-good' : 'stock-low'}`}>●</span>
            <span>{product.stock > 10 ? 'In Stock' : `Only ${product.stock} left`}</span>
          </div>
        </div>
      </div>

      {product.tags.length > 0 && (
        <div className="product-tags">
          {product.tags.slice(0, 5).map((tag, i) => (
            <span key={i} className="product-tag">{tag}</span>
          ))}
        </div>
      )}

      {alternativeReason && (
        <div className="product-alt-reason">
          <span className="alt-score">{alternativeScore}% match</span>
          <span className="alt-reason-text">{alternativeReason}</span>
        </div>
      )}
    </div>
  );
}
