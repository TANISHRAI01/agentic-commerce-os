// ============================================================
// Negotiation Agent Tests — Phase 9
// Tests bounded negotiation, server-side price clamping,
// SKIPPED outcome, state machine, and audit correctness.
// LLM calls are mocked — no API key needed.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runNegotiation } from '../src/agents/negotiation';
import { isValidTransition } from '../src/engine/state-machine';
import { NegotiationResultSchema } from '../src/types/negotiation';
import type { Product, Merchant } from '../src/types/schemas';
import type { ParsedIntent } from '../src/types/intent';

// ── Mock LLM service ─────────────────────────────────────────
vi.mock('../src/services/llm', () => ({
  generateStructuredOutput: vi.fn(),
}));

import { generateStructuredOutput } from '../src/services/llm';
const mockLLM = vi.mocked(generateStructuredOutput);

// ── Test fixtures ─────────────────────────────────────────────

const makeProduct = (price = 8499, overrides: Partial<Product> = {}): Product => ({
  id: 'prod-001',
  merchantId: 'merch-001',
  name: 'Premium Headphones X1',
  description: 'Noise-cancelling headphones',
  category: 'electronics',
  price,
  currency: 'INR',
  stock: 5,
  rating: 4.6,
  deliveryDays: 2,
  merchantTrustTier: 'GOLD',
  attributes: { connectivity: 'Bluetooth', noiseCancellation: 'Yes' },
  tags: ['audio', 'headphones'],
  availability: 'IN_STOCK',
  offerEligibility: [],
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makeMerchant = (maxDiscountPercent = 10, overrides: Partial<Merchant> = {}): Merchant => ({
  id: 'merch-001',
  name: 'AudioWorld',
  trustTier: 'GOLD',
  description: 'Electronics retailer',
  policies: ['free-returns'],
  deliveryRegions: ['PAN_INDIA'],
  paymentCapabilities: ['UPI', 'CARD'],
  businessRules: { maxDiscountPercent },
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makeIntent = (maxBudget = 8000): ParsedIntent => ({
  category: 'electronics',
  maximumPrice: maxBudget,
  minimumPrice: undefined,
  deliveryDeadline: 3,
  requiredAttributes: ['Noise Cancellation'],
  preferredAttributes: [],
  exclusions: [],
  quantity: 1,
  ambiguityQuestions: [],
});

// ── Tests ─────────────────────────────────────────────────────

describe('runNegotiation — SKIPPED outcome', () => {
  it('returns SKIPPED immediately when merchant has no discount policy', async () => {
    const product = makeProduct(7999);
    const merchant = makeMerchant(0); // no discount
    const intent = makeIntent(8000);

    const result = await runNegotiation(product, merchant, intent);

    expect(result.outcome).toBe('SKIPPED');
    expect(result.negotiatedPrice).toBe(product.price);
    expect(result.savingsAmount).toBe(0);
    expect(result.rounds).toHaveLength(0);
    expect(mockLLM).not.toHaveBeenCalled();
  });

  it('returns SKIPPED when businessRules is empty', async () => {
    const product = makeProduct(5000);
    const merchant = makeMerchant(0, { businessRules: {} });
    const intent = makeIntent(6000);

    const result = await runNegotiation(product, merchant, intent);

    expect(result.outcome).toBe('SKIPPED');
    expect(result.negotiatedPrice).toBe(5000);
  });
});

describe('runNegotiation — DEAL in Round 1', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reaches deal in Round 1 when merchant price is within buyer budget', async () => {
    const product = makeProduct(8499);
    const merchant = makeMerchant(10); // up to 849.9 discount
    const intent = makeIntent(8000);

    // Round 1: Buyer offers max budget, Merchant responds at 7999 (within budget)
    mockLLM
      .mockResolvedValueOnce({ // BuyerOffer
        productId: 'prod-001',
        maxBudget: 8000,
        currency: 'INR',
        maxDeliveryDays: 3,
        keyRequirements: ['Noise Cancellation'],
        message: 'I am looking for headphones within ₹8,000.',
      })
      .mockResolvedValueOnce({ // MerchantOffer
        productId: 'prod-001',
        offeredPrice: 7999,
        originalPrice: 8499,
        deliveryDays: 2,
        offerJustification: 'Special offer for you.',
        canDiscount: true,
        maxDiscountAmount: 849,
        message: 'We can offer these at ₹7,999 — our best price.',
      });

    const result = await runNegotiation(product, merchant, intent);

    expect(result.outcome).toBe('DEAL');
    expect(result.negotiatedPrice).toBe(7999);
    expect(result.savingsAmount).toBe(500); // 8499 - 7999
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0].dealReached).toBe(true);
  });
});

describe('runNegotiation — server-side price clamping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clamps merchant offer to policy floor even if LLM returns a lower price', async () => {
    const product = makeProduct(8499);
    const merchant = makeMerchant(10); // max 10% discount → floor = 7649.1
    const intent = makeIntent(6000); // very low budget — will trigger round 2

    // LLM returns a price below the policy floor — should be clamped
    mockLLM
      .mockResolvedValueOnce({ // BuyerOffer (Round 1)
        productId: 'prod-001', maxBudget: 6000, currency: 'INR',
        keyRequirements: [], message: 'My budget is ₹6,000.',
      })
      .mockResolvedValueOnce({ // MerchantOffer (Round 1) — LLM hallucinates 50% discount
        productId: 'prod-001', offeredPrice: 4000, originalPrice: 8499,
        deliveryDays: 2, offerJustification: 'Big discount.',
        canDiscount: true, maxDiscountAmount: 4499, message: 'We offer ₹4,000.',
      })
      .mockResolvedValueOnce({ // BuyerCounter (Round 2)
        requestedPrice: 6000, justification: 'Max budget.', message: 'Please do ₹6,000.',
      })
      .mockResolvedValueOnce({ // MerchantFinal (Round 2)
        finalPrice: 7649, accepted: false, message: 'Our floor is ₹7,649.',
      });

    const result = await runNegotiation(product, merchant, intent);

    // Server clamps: min acceptable = 8499 * (1 - 0.10) = 7649.1 → clamped to 7649
    const expectedFloor = Math.ceil(8499 * 0.90);
    expect(result.negotiatedPrice).toBeGreaterThanOrEqual(expectedFloor);
    // And can never be more than original price
    expect(result.negotiatedPrice).toBeLessThanOrEqual(product.price);
  });

  it('negotiated price is never higher than original DB price', async () => {
    const product = makeProduct(5000);
    const merchant = makeMerchant(5);
    const intent = makeIntent(5500); // budget above listed price

    mockLLM
      .mockResolvedValueOnce({
        productId: 'prod-001',
        maxBudget: 5500,
        currency: 'INR',
        keyRequirements: [],
        message: 'Interested at listed price.',
      })
      .mockResolvedValueOnce({
        productId: 'prod-001',
        offeredPrice: 5000,  // Exact listed price — no discount
        originalPrice: 5000,
        deliveryDays: 3,
        offerJustification: 'Listed price.',
        canDiscount: false,
        maxDiscountAmount: 0,
        message: 'Here at listed price.',
      });

    const result = await runNegotiation(product, merchant, intent);

    expect(result.negotiatedPrice).toBeLessThanOrEqual(product.price);
  });
});

describe('runNegotiation — Round 2 negotiation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proceeds to round 2 when round 1 price exceeds buyer budget', async () => {
    const product = makeProduct(8499);
    const merchant = makeMerchant(10);
    const intent = makeIntent(7800); // budget is 7800

    mockLLM
      // Round 1: Buyer offer
      .mockResolvedValueOnce({
        productId: 'prod-001', maxBudget: 7800, currency: 'INR',
        keyRequirements: [], message: 'Need it under ₹7,800.',
      })
      // Round 1: Merchant offer — 8100, above budget
      .mockResolvedValueOnce({
        productId: 'prod-001', offeredPrice: 8100, originalPrice: 8499,
        deliveryDays: 2, offerJustification: 'Best we can do.',
        canDiscount: true, maxDiscountAmount: 849, message: 'Best offer: ₹8,100.',
      })
      // Round 2: Buyer counter
      .mockResolvedValueOnce({
        requestedPrice: 7800, justification: 'This is my maximum.', message: 'Please consider ₹7,800.',
      })
      // Round 2: Merchant final — accepts at 7799
      .mockResolvedValueOnce({
        finalPrice: 7799, accepted: true, message: 'Deal at ₹7,799!',
      });

    const result = await runNegotiation(product, merchant, intent);

    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[0].dealReached).toBe(false);
    expect(result.rounds[1].dealReached).toBe(true);
    expect(result.outcome).toBe('DEAL');
  });
});

describe('runNegotiation — result schema validation', () => {
  it('result always satisfies NegotiationResultSchema', async () => {
    const product = makeProduct(5000);
    const merchant = makeMerchant(0); // SKIPPED path

    const result = await runNegotiation(product, merchant, makeIntent(4000));

    // Should not throw
    expect(() => NegotiationResultSchema.parse(result)).not.toThrow();
  });
});

describe('state machine — NEGOTIATING state', () => {
  it('CART_READY can transition to NEGOTIATING', () => {
    expect(isValidTransition('CART_READY', 'NEGOTIATING')).toBe(true);
  });

  it('NEGOTIATING can transition back to CART_READY', () => {
    expect(isValidTransition('NEGOTIATING', 'CART_READY')).toBe(true);
  });

  it('NEGOTIATING cannot go directly to POLICY_PENDING', () => {
    expect(isValidTransition('NEGOTIATING', 'POLICY_PENDING')).toBe(false);
  });

  it('NEGOTIATING cannot go to PAYMENT_PENDING', () => {
    expect(isValidTransition('NEGOTIATING', 'PAYMENT_PENDING')).toBe(false);
  });
});
