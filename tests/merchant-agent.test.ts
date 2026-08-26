// ============================================================
// Merchant Agent Tests — Phase 8
// Tests hallucination guardrails, schema validation, and
// optional recommendation enforcement
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateMerchantRecommendations,
  HallucinatedRecommendationError,
} from '../src/agents/merchant';
import type { Product, Merchant } from '../src/types/schemas';
import type { ParsedIntent } from '../src/types/intent';

// ── Mock LLM service ─────────────────────────────────────────
vi.mock('../src/services/llm', () => ({
  generateStructuredOutput: vi.fn(),
}));

import { generateStructuredOutput } from '../src/services/llm';
const mockLLM = vi.mocked(generateStructuredOutput);

// ── Test fixtures ─────────────────────────────────────────────

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-001',
  merchantId: 'merch-001',
  name: 'Running Shoes X1',
  description: 'Lightweight running shoes',
  category: 'footwear',
  price: 4499,
  currency: 'INR',
  stock: 10,
  rating: 4.5,
  deliveryDays: 3,
  merchantTrustTier: 'GOLD',
  attributes: { color: 'black', size: '9' },
  tags: ['running', 'sports'],
  availability: 'IN_STOCK',
  offerEligibility: [],
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makeMerchant = (id = 'merch-001'): Merchant => ({
  id,
  name: 'SportZone',
  trustTier: 'GOLD',
  description: 'Sports gear',
  policies: ['free-returns'],
  deliveryRegions: ['PAN_INDIA'],
  paymentCapabilities: ['UPI', 'CARD'],
  businessRules: {},
  createdAt: new Date().toISOString(),
});

const makeIntent = (): ParsedIntent => ({
  category: 'footwear',
  maximumPrice: 5000,
  minimumPrice: undefined,
  deliveryDeadline: 5,
  requiredAttributes: [],
  preferredAttributes: [],
  exclusions: [],
  minimumRating: 4.0,
  brand: undefined,
  quantity: 1,
  ambiguityQuestions: [],
});

const selectedProduct = makeProduct();
const crossSellProduct = makeProduct({
  id: 'prod-002',
  name: 'Sports Socks Pack',
  category: 'accessories',
  price: 299,
});
const upsellProduct = makeProduct({
  id: 'prod-003',
  name: 'Premium Running Shoes X2',
  price: 6499,
});

const allCandidates = [selectedProduct, crossSellProduct, upsellProduct];
const merchants = {
  'merch-001': makeMerchant(),
};
const intent = makeIntent();

// ── Valid recommendation response ─────────────────────────────

const validRecommendationsResponse = {
  crossSells: [
    {
      productId: 'prod-002',
      productName: 'Sports Socks Pack',
      price: 299,
      type: 'CROSS_SELL' as const,
      reason: 'Customers buying running shoes frequently add socks',
      isOptional: true as const,
    },
  ],
  upsells: [
    {
      productId: 'prod-003',
      productName: 'Premium Running Shoes X2',
      price: 6499,
      type: 'UPSELL' as const,
      reason: 'Better cushioning and durability for serious runners',
      isOptional: true as const,
    },
  ],
  bundles: [],
  contextualOffer: null,
  summary: 'Consider adding socks to complete your running kit, or upgrade to the premium model.',
};

// ── Tests ─────────────────────────────────────────────────────

describe('Merchant Agent — generateMerchantRecommendations', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns validated recommendations when LLM responds correctly', async () => {
    mockLLM.mockResolvedValueOnce(validRecommendationsResponse);

    const result = await generateMerchantRecommendations(
      selectedProduct,
      allCandidates,
      merchants,
      intent,
    );

    expect(result.crossSells).toHaveLength(1);
    expect(result.crossSells[0].productId).toBe('prod-002');
    expect(result.crossSells[0].isOptional).toBe(true);
    expect(result.upsells).toHaveLength(1);
    expect(result.upsells[0].productId).toBe('prod-003');
    expect(result.bundles).toHaveLength(0);
    expect(result.contextualOffer).toBeNull();
  });

  it('ensures isOptional is always true on all returned items', async () => {
    mockLLM.mockResolvedValueOnce(validRecommendationsResponse);

    const result = await generateMerchantRecommendations(
      selectedProduct,
      allCandidates,
      merchants,
      intent,
    );

    const allItems = [
      ...result.crossSells,
      ...result.upsells,
      ...result.bundles,
      ...(result.contextualOffer ? [result.contextualOffer] : []),
    ];

    for (const item of allItems) {
      expect(item.isOptional).toBe(true);
    }
  });

  it('throws HallucinatedRecommendationError when cross-sell ID is not in candidate list', async () => {
    const hallucinated = {
      ...validRecommendationsResponse,
      crossSells: [
        {
          productId: 'hallucinated-product-999',
          productName: 'Ghost Product',
          price: 999,
          type: 'CROSS_SELL' as const,
          reason: 'This product does not exist',
          isOptional: true as const,
        },
      ],
    };
    mockLLM.mockResolvedValueOnce(hallucinated);

    await expect(
      generateMerchantRecommendations(selectedProduct, allCandidates, merchants, intent)
    ).rejects.toThrow(HallucinatedRecommendationError);
  });

  it('throws HallucinatedRecommendationError when upsell ID is fabricated', async () => {
    const hallucinated = {
      ...validRecommendationsResponse,
      crossSells: [],
      upsells: [
        {
          productId: 'fabricated-upsell-abc',
          productName: 'Made Up Product',
          price: 9999,
          type: 'UPSELL' as const,
          reason: 'Fictitious product',
          isOptional: true as const,
        },
      ],
    };
    mockLLM.mockResolvedValueOnce(hallucinated);

    await expect(
      generateMerchantRecommendations(selectedProduct, allCandidates, merchants, intent)
    ).rejects.toThrow(HallucinatedRecommendationError);
  });

  it('throws HallucinatedRecommendationError when contextualOffer ID is hallucinated', async () => {
    const hallucinated = {
      ...validRecommendationsResponse,
      crossSells: [],
      upsells: [],
      contextualOffer: {
        productId: 'ghost-offer-xyz',
        productName: 'Ghost Offer',
        price: 199,
        type: 'CONTEXTUAL_OFFER' as const,
        reason: 'Does not exist',
        isOptional: true as const,
      },
    };
    mockLLM.mockResolvedValueOnce(hallucinated);

    await expect(
      generateMerchantRecommendations(selectedProduct, allCandidates, merchants, intent)
    ).rejects.toThrow(HallucinatedRecommendationError);
  });

  it('returns empty recommendations when no other candidates exist', async () => {
    // Only the selected product in the list — no others to recommend
    const result = await generateMerchantRecommendations(
      selectedProduct,
      [selectedProduct], // only one product
      merchants,
      intent,
    );

    expect(result.crossSells).toHaveLength(0);
    expect(result.upsells).toHaveLength(0);
    expect(result.bundles).toHaveLength(0);
    expect(result.contextualOffer).toBeNull();
    // LLM should not have been called
    expect(mockLLM).not.toHaveBeenCalled();
  });

  it('filters out the selected product if LLM accidentally returns it as a recommendation', async () => {
    const withSelectedAsRec = {
      ...validRecommendationsResponse,
      crossSells: [
        {
          productId: selectedProduct.id, // selected product ID — should be filtered
          productName: selectedProduct.name,
          price: selectedProduct.price,
          type: 'CROSS_SELL' as const,
          reason: 'Same product',
          isOptional: true as const,
        },
      ],
      upsells: [],
    };
    mockLLM.mockResolvedValueOnce(withSelectedAsRec);

    const result = await generateMerchantRecommendations(
      selectedProduct,
      allCandidates,
      merchants,
      intent,
    );

    // The selected product should have been filtered from cross-sells
    expect(result.crossSells.every(item => item.productId !== selectedProduct.id)).toBe(true);
  });

  it('returns empty recommendations when LLM returns all-empty response', async () => {
    const emptyResponse = {
      crossSells: [],
      upsells: [],
      bundles: [],
      contextualOffer: null,
      summary: 'No additional recommendations at this time.',
    };
    mockLLM.mockResolvedValueOnce(emptyResponse);

    const result = await generateMerchantRecommendations(
      selectedProduct,
      allCandidates,
      merchants,
      intent,
    );

    expect(result.crossSells).toHaveLength(0);
    expect(result.upsells).toHaveLength(0);
    expect(result.bundles).toHaveLength(0);
    expect(result.contextualOffer).toBeNull();
  });

  it('includes the summary from the LLM response', async () => {
    mockLLM.mockResolvedValueOnce(validRecommendationsResponse);

    const result = await generateMerchantRecommendations(
      selectedProduct,
      allCandidates,
      merchants,
      intent,
    );

    expect(result.summary).toBeTruthy();
    expect(typeof result.summary).toBe('string');
  });

  it('error message in HallucinatedRecommendationError includes the invalid ID', async () => {
    const hallucinated = {
      ...validRecommendationsResponse,
      crossSells: [
        {
          productId: 'bad-id-123',
          productName: 'Bad Product',
          price: 100,
          type: 'CROSS_SELL' as const,
          reason: 'Does not exist',
          isOptional: true as const,
        },
      ],
    };
    mockLLM.mockResolvedValueOnce(hallucinated);

    try {
      await generateMerchantRecommendations(selectedProduct, allCandidates, merchants, intent);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HallucinatedRecommendationError);
      expect((e as HallucinatedRecommendationError).invalidId).toBe('bad-id-123');
      expect((e as HallucinatedRecommendationError).validIds).toContain('prod-002');
    }
  });
});
