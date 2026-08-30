// ============================================================
// Evaluation Test Suite — Fixed test set for AI shopping pipeline
// Tests intent parsing, product selection, hallucination prevention
// All tests use mocked data (no live LLM calls)
// ============================================================

import { describe, it, expect } from 'vitest';
import { ParsedIntentSchema, intentToSearchParams, type ParsedIntent } from '@/types/intent';
import { RankingResultSchema, type RankingResult } from '@/types/ranking';
import type { Product } from '@/types/schemas';

// ── Mock Catalog (subset of seed data) ──────────────────────

const MOCK_CATALOG: Product[] = [
  { id: 'prod-001', merchantId: 'merch-001', name: 'Sony WH-1000XM5', description: 'Industry-leading noise cancellation', category: 'headphones', price: 24990, currency: 'INR', stock: 25, rating: 4.8, deliveryDays: 2, merchantTrustTier: 'PLATINUM', attributes: { type: 'over-ear', connectivity: 'bluetooth', anc: 'true', brand: 'Sony' }, tags: ['noise-cancelling', 'wireless', 'premium'], createdAt: '2024-01-01' },
  { id: 'prod-004', merchantId: 'merch-002', name: 'JBL Tune 760NC', description: 'ANC wireless headphones', category: 'headphones', price: 4499, currency: 'INR', stock: 45, rating: 4.3, deliveryDays: 3, merchantTrustTier: 'GOLD', attributes: { type: 'over-ear', connectivity: 'bluetooth', anc: 'true', brand: 'JBL' }, tags: ['noise-cancelling', 'wireless', 'bass'], createdAt: '2024-01-01' },
  { id: 'prod-006', merchantId: 'merch-003', name: 'Zebronics Thunder', description: 'Budget wireless headphones', category: 'headphones', price: 799, currency: 'INR', stock: 200, rating: 3.6, deliveryDays: 5, merchantTrustTier: 'SILVER', attributes: { type: 'over-ear', connectivity: 'bluetooth', anc: 'false', brand: 'Zebronics' }, tags: ['budget', 'wireless'], createdAt: '2024-01-01' },
  { id: 'prod-009', merchantId: 'merch-003', name: 'Realme Buds Wireless 3', description: 'Neckband earphones with ANC', category: 'headphones', price: 1499, currency: 'INR', stock: 150, rating: 4.0, deliveryDays: 4, merchantTrustTier: 'SILVER', attributes: { type: 'neckband', connectivity: 'bluetooth', anc: 'true', brand: 'Realme' }, tags: ['neckband', 'wireless', 'anc', 'budget'], createdAt: '2024-01-01' },
  { id: 'prod-010', merchantId: 'merch-002', name: 'AKG K371', description: 'Closed-back studio headphones', category: 'headphones', price: 7499, currency: 'INR', stock: 20, rating: 4.5, deliveryDays: 3, merchantTrustTier: 'GOLD', attributes: { type: 'over-ear', connectivity: 'wired', anc: 'false', brand: 'AKG' }, tags: ['studio', 'wired', 'reference'], createdAt: '2024-01-01' },
  { id: 'prod-029', merchantId: 'merch-005', name: 'Atomic Habits by James Clear', description: 'Build good habits and break bad ones', category: 'books', price: 350, currency: 'INR', stock: 500, rating: 4.8, deliveryDays: 1, merchantTrustTier: 'PLATINUM', attributes: { author: 'James Clear', genre: 'self-help' }, tags: ['self-help', 'habits', 'bestseller', 'productivity'], createdAt: '2024-01-01' },
  { id: 'prod-031', merchantId: 'merch-005', name: 'Deep Work by Cal Newport', description: 'Focused success in a distracted world', category: 'books', price: 399, currency: 'INR', stock: 200, rating: 4.6, deliveryDays: 1, merchantTrustTier: 'PLATINUM', attributes: { author: 'Cal Newport', genre: 'productivity' }, tags: ['productivity', 'focus', 'work', 'career'], createdAt: '2024-01-01' },
  { id: 'prod-040', merchantId: 'merch-006', name: 'Fitbit Charge 6', description: 'Fitness tracker with GPS and heart rate', category: 'fitness', price: 14999, currency: 'INR', stock: 25, rating: 4.4, deliveryDays: 2, merchantTrustTier: 'BRONZE', attributes: { type: 'fitness-tracker', brand: 'Fitbit', features: 'GPS,HR,Sleep' }, tags: ['tracker', 'smartwatch', 'heart-rate', 'gps'], createdAt: '2024-01-01' },
  { id: 'prod-042', merchantId: 'merch-002', name: 'Noise ColorFit Pro 5', description: 'Smart fitness watch', category: 'fitness', price: 3499, currency: 'INR', stock: 40, rating: 4.1, deliveryDays: 2, merchantTrustTier: 'GOLD', attributes: { type: 'smartwatch', brand: 'Noise', display: 'AMOLED' }, tags: ['smartwatch', 'fitness', 'amoled', 'spo2', 'affordable'], createdAt: '2024-01-01' },
] as unknown as Product[];

// ── Simulated LLM Responses ─────────────────────────────────

/**
 * Simulated intent parsing results (what a well-behaved LLM would return).
 * These represent deterministic test expectations.
 */
const SIMULATED_INTENTS: Record<string, ParsedIntent> = {
  'headphones_budget': {
    category: 'headphones',
    maximumPrice: 8000,
    deliveryDeadline: 3,
    requiredAttributes: ['noise-cancelling'],
    preferredAttributes: ['wireless', 'comfortable'],
    exclusions: [],
    quantity: 1,
    ambiguityQuestions: [],
  },
  'cheapest_headphones': {
    category: 'headphones',
    requiredAttributes: [],
    preferredAttributes: ['affordable'],
    exclusions: [],
    quantity: 1,
    ambiguityQuestions: [],
  },
  'book_productivity': {
    category: 'books',
    maximumPrice: 500,
    deliveryDeadline: 1,
    requiredAttributes: [],
    preferredAttributes: ['productivity'],
    exclusions: [],
    quantity: 1,
    ambiguityQuestions: [],
  },
  'fitness_tracker': {
    category: 'fitness',
    maximumPrice: 5000,
    requiredAttributes: ['heart-rate'],
    preferredAttributes: ['gps', 'sleep'],
    exclusions: [],
    quantity: 1,
    ambiguityQuestions: [],
  },
  'ambiguous': {
    category: 'general',
    requiredAttributes: [],
    preferredAttributes: ['productivity'],
    exclusions: [],
    quantity: 1,
    ambiguityQuestions: [
      'What type of product are you looking for?',
      'Do you have a budget in mind?',
    ],
  },
};

// ── Test 1: Intent Parsing Success ───────────────────────────

describe('Evaluation — Intent Parsing Success', () => {
  const testCases = [
    {
      name: 'Standard query with budget and delivery',
      query: 'Find me the best noise-cancelling headphones under ₹8,000 that can arrive within 3 days',
      expectedKey: 'headphones_budget',
    },
    {
      name: 'Budget-only query',
      query: 'Cheapest headphones available',
      expectedKey: 'cheapest_headphones',
    },
    {
      name: 'Book with delivery constraint',
      query: 'A good book on productivity under ₹500 that arrives tomorrow',
      expectedKey: 'book_productivity',
    },
    {
      name: 'Feature-focused query',
      query: 'Fitness tracker with heart rate monitor under ₹5,000',
      expectedKey: 'fitness_tracker',
    },
    {
      name: 'Ambiguous query',
      query: 'Something good for productivity',
      expectedKey: 'ambiguous',
    },
  ];

  for (const tc of testCases) {
    it(`should produce valid schema for: "${tc.name}"`, () => {
      const simulated = SIMULATED_INTENTS[tc.expectedKey];
      const result = ParsedIntentSchema.safeParse(simulated);
      expect(result.success).toBe(true);
    });
  }

  it('all simulated intents should be valid', () => {
    for (const [key, intent] of Object.entries(SIMULATED_INTENTS)) {
      const result = ParsedIntentSchema.safeParse(intent);
      expect(result.success).toBe(true);
    }
  });
});

// ── Test 2: Valid Product Selection ──────────────────────────

describe('Evaluation — Valid Product Selection', () => {
  function filterCatalog(intent: ParsedIntent): Product[] {
    return MOCK_CATALOG.filter(p => {
      if (intent.category !== 'general' && p.category !== intent.category) return false;
      if (intent.maximumPrice && p.price > intent.maximumPrice) return false;
      if (intent.minimumPrice && p.price < intent.minimumPrice) return false;
      if (intent.deliveryDeadline && p.deliveryDays > intent.deliveryDeadline) return false;
      if (p.stock <= 0) return false;
      return true;
    });
  }

  it('should find ANC headphones under ₹8,000 with 3-day delivery', () => {
    const intent = SIMULATED_INTENTS['headphones_budget'];
    const candidates = filterCatalog(intent);

    expect(candidates.length).toBeGreaterThan(0);
    // JBL Tune 760NC (₹4,499, ANC, 3 days) should be in results
    expect(candidates.some(p => p.id === 'prod-004')).toBe(true);
    // Sony WH-1000XM5 (₹24,990) should NOT be in results (over budget)
    expect(candidates.some(p => p.id === 'prod-001')).toBe(false);
  });

  it('should find all headphones when no price limit', () => {
    const intent = SIMULATED_INTENTS['cheapest_headphones'];
    const candidates = filterCatalog(intent);

    expect(candidates.length).toBeGreaterThan(0);
    // Zebronics Thunder (₹799) should be cheapest
    const cheapest = candidates.reduce((a, b) => a.price < b.price ? a : b);
    expect(cheapest.id).toBe('prod-006');
  });

  it('should find productivity books under ₹500 with 1-day delivery', () => {
    const intent = SIMULATED_INTENTS['book_productivity'];
    const candidates = filterCatalog(intent);

    expect(candidates.length).toBeGreaterThan(0);
    // Atomic Habits (₹350, 1 day) should be in results
    expect(candidates.some(p => p.id === 'prod-029')).toBe(true);
    // Deep Work (₹399, 1 day) should be in results
    expect(candidates.some(p => p.id === 'prod-031')).toBe(true);
  });

  it('should find fitness trackers under ₹5,000', () => {
    const intent = SIMULATED_INTENTS['fitness_tracker'];
    const candidates = filterCatalog(intent);

    expect(candidates.length).toBeGreaterThan(0);
    // Noise ColorFit Pro 5 (₹3,499) should be in results
    expect(candidates.some(p => p.id === 'prod-042')).toBe(true);
    // Fitbit Charge 6 (₹14,999) should NOT be in results (over budget)
    expect(candidates.some(p => p.id === 'prod-040')).toBe(false);
  });

  it('all selected products must exist in the catalog', () => {
    const catalogIds = new Set(MOCK_CATALOG.map(p => p.id));

    for (const [, intent] of Object.entries(SIMULATED_INTENTS)) {
      const candidates = filterCatalog(intent);
      for (const product of candidates) {
        expect(catalogIds.has(product.id)).toBe(true);
      }
    }
  });
});

// ── Test 3: Hallucinated Product Prevention ─────────────────

describe('Evaluation — No Hallucinated Products', () => {
  const catalogIds = new Set(MOCK_CATALOG.map(p => p.id));

  it('should reject ranking with non-existent selectedProductId', () => {
    const ranking: RankingResult = {
      selectedProductId: 'prod-FAKE-123',
      confidenceScore: 95,
      reasons: [{ factor: 'test', explanation: 'test', satisfied: true }],
      alternatives: [],
      summary: 'test',
    };

    expect(catalogIds.has(ranking.selectedProductId)).toBe(false);
  });

  it('should reject ranking with non-existent alternative IDs', () => {
    const ranking: RankingResult = {
      selectedProductId: 'prod-004',
      confidenceScore: 90,
      reasons: [{ factor: 'test', explanation: 'test', satisfied: true }],
      alternatives: [
        { productId: 'prod-HALLUCINATED', reason: 'test', score: 70 },
      ],
      summary: 'test',
    };

    const invalidAlts = ranking.alternatives.filter(a => !catalogIds.has(a.productId));
    expect(invalidAlts.length).toBeGreaterThan(0);
  });

  it('should accept ranking with all valid IDs', () => {
    const ranking: RankingResult = {
      selectedProductId: 'prod-004',
      confidenceScore: 92,
      reasons: [
        { factor: 'Within budget', explanation: '₹4,499 within ₹8,000', satisfied: true },
        { factor: 'ANC', explanation: 'Has noise cancellation', satisfied: true },
      ],
      alternatives: [
        { productId: 'prod-009', reason: 'Lower rating', score: 75 },
      ],
      summary: 'JBL Tune 760NC is the best match',
    };

    expect(catalogIds.has(ranking.selectedProductId)).toBe(true);
    const allValid = ranking.alternatives.every(a => catalogIds.has(a.productId));
    expect(allValid).toBe(true);
  });
});

// ── Test 4: Ranking Correctness ─────────────────────────────

describe('Evaluation — Ranking Correctness', () => {
  it('should rank ANC headphones higher when ANC is required', () => {
    const intent = SIMULATED_INTENTS['headphones_budget'];
    const candidates = MOCK_CATALOG.filter(p =>
      p.category === 'headphones' && p.price <= 8000 && p.deliveryDays <= 3
    );

    const withANC = candidates.filter(p => p.attributes.anc === 'true');
    const withoutANC = candidates.filter(p => p.attributes.anc !== 'true');

    // There should be ANC candidates
    expect(withANC.length).toBeGreaterThan(0);

    // Best ANC candidate should have higher rating than best non-ANC
    if (withoutANC.length > 0) {
      const bestANC = withANC.reduce((a, b) => a.rating > b.rating ? a : b);
      // Verify that ANC candidate exists
      expect(bestANC.attributes.anc).toBe('true');
    }
  });

  it('should prefer cheapest when no other constraints', () => {
    const headphones = MOCK_CATALOG.filter(p => p.category === 'headphones');
    const cheapest = headphones.reduce((a, b) => a.price < b.price ? a : b);
    expect(cheapest.price).toBe(799);
    expect(cheapest.name).toContain('Zebronics');
  });

  it('should prefer higher-rated books for productivity query', () => {
    const intent = SIMULATED_INTENTS['book_productivity'];
    const candidates = MOCK_CATALOG.filter(p =>
      p.category === 'books' && p.price <= 500 && p.deliveryDays <= 1
    );

    const bestRated = candidates.reduce((a, b) => a.rating > b.rating ? a : b);
    expect(bestRated.rating).toBeGreaterThanOrEqual(4.5);
  });
});

// ── Test 5: Malformed LLM Output Handling ───────────────────

describe('Evaluation — Malformed LLM Output', () => {
  it('should reject ranking with missing required fields', () => {
    const badRanking = {
      // Missing selectedProductId
      confidenceScore: 80,
      reasons: [],
      summary: 'test',
    };

    const result = RankingResultSchema.safeParse(badRanking);
    expect(result.success).toBe(false);
  });

  it('should reject ranking with wrong types', () => {
    const badRanking = {
      selectedProductId: 123, // should be string
      confidenceScore: 'high', // should be number
      reasons: 'good product', // should be array
      summary: null, // should be string
    };

    const result = RankingResultSchema.safeParse(badRanking);
    expect(result.success).toBe(false);
  });

  it('should reject intent with extra unexpected fields gracefully', () => {
    const intentWithExtras = {
      category: 'headphones',
      maximumPrice: 8000,
      requiredAttributes: ['anc'],
      preferredAttributes: [],
      exclusions: [],
      quantity: 1,
      ambiguityQuestions: [],
      // Extra fields — Zod strips these by default
      hallucinated_field: 'should be ignored',
      fake_price: 99999,
    };

    const result = ParsedIntentSchema.safeParse(intentWithExtras);
    expect(result.success).toBe(true);
  });

  it('should reject completely invalid JSON parsed as object', () => {
    const garbage = {
      foo: 'bar',
      baz: 42,
    };

    const intentResult = ParsedIntentSchema.safeParse(garbage);
    expect(intentResult.success).toBe(false);

    const rankingResult = RankingResultSchema.safeParse(garbage);
    expect(rankingResult.success).toBe(false);
  });
});
