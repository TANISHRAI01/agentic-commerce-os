// ============================================================
// Decision Agent Tests — Ranking validation + hallucination detection
// Uses direct schema validation (no live LLM calls)
// ============================================================

import { describe, it, expect } from 'vitest';
import { RankingResultSchema, type RankingResult } from '@/types/ranking';
import type { Product } from '@/types/schemas';

// ── Test Data ────────────────────────────────────────────────

const MOCK_CANDIDATES: Product[] = [
  {
    id: 'prod-004',
    merchantId: 'merch-002',
    name: 'JBL Tune 760NC',
    description: 'ANC wireless headphones with JBL Pure Bass Sound',
    category: 'headphones',
    price: 4499,
    currency: 'INR',
    stock: 45,
    rating: 4.3,
    deliveryDays: 3,
    merchantTrustTier: 'GOLD',
    attributes: { type: 'over-ear', connectivity: 'bluetooth', anc: 'true', brand: 'JBL' },
    tags: ['noise-cancelling', 'wireless', 'bass', 'bluetooth', 'over-ear'],
    createdAt: '2024-01-01',
  },
  {
    id: 'prod-009',
    merchantId: 'merch-003',
    name: 'Realme Buds Wireless 3',
    description: 'Neckband earphones with ANC',
    category: 'headphones',
    price: 1499,
    currency: 'INR',
    stock: 150,
    rating: 4.0,
    deliveryDays: 4,
    merchantTrustTier: 'SILVER',
    attributes: { type: 'neckband', connectivity: 'bluetooth', anc: 'true', brand: 'Realme' },
    tags: ['neckband', 'wireless', 'anc', 'budget', 'bass'],
    createdAt: '2024-01-01',
  },
  {
    id: 'prod-003',
    merchantId: 'merch-002',
    name: 'boAt Rockerz 550',
    description: 'Over-ear wireless headphones',
    category: 'headphones',
    price: 1799,
    currency: 'INR',
    stock: 100,
    rating: 4.1,
    deliveryDays: 3,
    merchantTrustTier: 'GOLD',
    attributes: { type: 'over-ear', connectivity: 'bluetooth', anc: 'false', brand: 'boAt' },
    tags: ['wireless', 'bass', 'budget', 'bluetooth', 'over-ear'],
    createdAt: '2024-01-01',
  },
];

// ── Schema Validation Tests ──────────────────────────────────

describe('RankingResultSchema', () => {
  it('should validate a complete ranking result', () => {
    const ranking = {
      selectedProductId: 'prod-004',
      confidenceScore: 92,
      reasons: [
        { factor: 'Within budget', explanation: 'Price ₹4,499 is within the ₹8,000 budget', satisfied: true },
        { factor: 'Noise cancelling', explanation: 'Has active noise cancellation as required', satisfied: true },
        { factor: 'Fast delivery', explanation: 'Delivers in 3 days, within deadline', satisfied: true },
      ],
      alternatives: [
        { productId: 'prod-009', reason: 'Lower rating and neckband form factor', score: 75 },
        { productId: 'prod-003', reason: 'Does not have ANC as required', score: 60 },
      ],
      summary: 'JBL Tune 760NC offers the best balance of noise cancellation, sound quality, and value within your budget.',
    };

    const result = RankingResultSchema.safeParse(ranking);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selectedProductId).toBe('prod-004');
      expect(result.data.reasons).toHaveLength(3);
      expect(result.data.alternatives).toHaveLength(2);
    }
  });

  it('should validate a minimal ranking result (no alternatives)', () => {
    const ranking = {
      selectedProductId: 'prod-004',
      confidenceScore: 85,
      reasons: [
        { factor: 'Best match', explanation: 'Closest to requirements', satisfied: true },
      ],
      summary: 'JBL Tune 760NC is the best match.',
    };

    const result = RankingResultSchema.safeParse(ranking);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alternatives).toEqual([]);
    }
  });

  it('should reject ranking without selectedProductId', () => {
    const ranking = {
      confidenceScore: 85,
      reasons: [{ factor: 'test', explanation: 'test', satisfied: true }],
      summary: 'test',
    };

    const result = RankingResultSchema.safeParse(ranking);
    expect(result.success).toBe(false);
  });

  it('should reject ranking without reasons', () => {
    const ranking = {
      selectedProductId: 'prod-004',
      confidenceScore: 85,
      reasons: [],
      summary: 'test',
    };

    const result = RankingResultSchema.safeParse(ranking);
    expect(result.success).toBe(false);
  });

  it('should reject ranking with out-of-range confidence score', () => {
    const ranking = {
      selectedProductId: 'prod-004',
      confidenceScore: 150,
      reasons: [{ factor: 'test', explanation: 'test', satisfied: true }],
      summary: 'test',
    };

    const result = RankingResultSchema.safeParse(ranking);
    expect(result.success).toBe(false);
  });

  it('should reject alternative with out-of-range score', () => {
    const ranking = {
      selectedProductId: 'prod-004',
      confidenceScore: 85,
      reasons: [{ factor: 'test', explanation: 'test', satisfied: true }],
      alternatives: [
        { productId: 'prod-003', reason: 'test', score: -5 },
      ],
      summary: 'test',
    };

    const result = RankingResultSchema.safeParse(ranking);
    expect(result.success).toBe(false);
  });

  it('should reject empty selectedProductId', () => {
    const ranking = {
      selectedProductId: '',
      confidenceScore: 85,
      reasons: [{ factor: 'test', explanation: 'test', satisfied: true }],
      summary: 'test',
    };

    const result = RankingResultSchema.safeParse(ranking);
    expect(result.success).toBe(false);
  });

  it('should reject empty summary', () => {
    const ranking = {
      selectedProductId: 'prod-004',
      confidenceScore: 85,
      reasons: [{ factor: 'test', explanation: 'test', satisfied: true }],
      summary: '',
    };

    const result = RankingResultSchema.safeParse(ranking);
    expect(result.success).toBe(false);
  });
});

// ── Hallucination Detection Tests ────────────────────────────

describe('Hallucination prevention', () => {
  const validIds = MOCK_CANDIDATES.map(p => p.id);

  it('should detect hallucinated selectedProductId', () => {
    const ranking: RankingResult = {
      selectedProductId: 'prod-FAKE-999',
      confidenceScore: 95,
      reasons: [{ factor: 'test', explanation: 'test', satisfied: true }],
      alternatives: [],
      summary: 'test',
    };

    expect(validIds.includes(ranking.selectedProductId)).toBe(false);
  });

  it('should detect hallucinated alternative product IDs', () => {
    const ranking: RankingResult = {
      selectedProductId: 'prod-004',
      confidenceScore: 90,
      reasons: [{ factor: 'test', explanation: 'test', satisfied: true }],
      alternatives: [
        { productId: 'prod-HALLUCINATED', reason: 'cheaper', score: 70 },
      ],
      summary: 'test',
    };

    const hallucinated = ranking.alternatives.filter(a => !validIds.includes(a.productId));
    expect(hallucinated).toHaveLength(1);
    expect(hallucinated[0].productId).toBe('prod-HALLUCINATED');
  });

  it('should accept all valid product IDs', () => {
    const ranking: RankingResult = {
      selectedProductId: 'prod-004',
      confidenceScore: 92,
      reasons: [{ factor: 'test', explanation: 'test', satisfied: true }],
      alternatives: [
        { productId: 'prod-009', reason: 'lower rating', score: 75 },
        { productId: 'prod-003', reason: 'no ANC', score: 60 },
      ],
      summary: 'test',
    };

    expect(validIds.includes(ranking.selectedProductId)).toBe(true);
    const allAlternativesValid = ranking.alternatives.every(a => validIds.includes(a.productId));
    expect(allAlternativesValid).toBe(true);
  });
});
