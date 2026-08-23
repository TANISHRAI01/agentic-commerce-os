// ============================================================
// Discovery Agent Tests — Intent parsing + schema validation
// Uses direct schema validation (no live LLM calls)
// ============================================================

import { describe, it, expect } from 'vitest';
import { ParsedIntentSchema, intentToSearchParams, type ParsedIntent } from '@/types/intent';

// ── Schema Validation Tests ──────────────────────────────────

describe('ParsedIntentSchema', () => {
  it('should validate a complete intent', () => {
    const intent = {
      category: 'headphones',
      maximumPrice: 8000,
      minimumPrice: 1000,
      deliveryDeadline: 3,
      requiredAttributes: ['noise-cancelling', 'wireless'],
      preferredAttributes: ['comfortable'],
      exclusions: ['wired'],
      quantity: 1,
      minimumRating: 4.0,
      brand: 'Sony',
      ambiguityQuestions: [],
    };

    const result = ParsedIntentSchema.safeParse(intent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('headphones');
      expect(result.data.maximumPrice).toBe(8000);
      expect(result.data.requiredAttributes).toEqual(['noise-cancelling', 'wireless']);
    }
  });

  it('should validate a minimal intent (only required fields)', () => {
    const intent = {
      category: 'laptops',
    };

    const result = ParsedIntentSchema.safeParse(intent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('laptops');
      expect(result.data.requiredAttributes).toEqual([]);
      expect(result.data.preferredAttributes).toEqual([]);
      expect(result.data.exclusions).toEqual([]);
      expect(result.data.quantity).toBe(1);
      expect(result.data.ambiguityQuestions).toEqual([]);
    }
  });

  it('should reject intent without category', () => {
    const intent = {
      maximumPrice: 5000,
    };

    const result = ParsedIntentSchema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it('should reject intent with empty category', () => {
    const intent = {
      category: '',
    };

    const result = ParsedIntentSchema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it('should reject negative price', () => {
    const intent = {
      category: 'books',
      maximumPrice: -100,
    };

    const result = ParsedIntentSchema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it('should reject invalid rating', () => {
    const intent = {
      category: 'fitness',
      minimumRating: 6.0,
    };

    const result = ParsedIntentSchema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it('should reject zero quantity', () => {
    const intent = {
      category: 'accessories',
      quantity: 0,
    };

    const result = ParsedIntentSchema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it('should accept intent with ambiguity questions', () => {
    const intent = {
      category: 'general',
      ambiguityQuestions: [
        'What type of product are you looking for?',
        'Do you have a budget in mind?',
      ],
    };

    const result = ParsedIntentSchema.safeParse(intent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ambiguityQuestions).toHaveLength(2);
    }
  });

  it('should handle malformed LLM output gracefully', () => {
    // Simulate LLM returning wrong types
    const malformed = {
      category: 123, // should be string
      maximumPrice: 'not a number',
      requiredAttributes: 'not-an-array',
    };

    const result = ParsedIntentSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it('should handle completely empty object', () => {
    const result = ParsedIntentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should handle null input', () => {
    const result = ParsedIntentSchema.safeParse(null);
    expect(result.success).toBe(false);
  });
});

// ── Intent → Search Params Mapping Tests ─────────────────────

describe('intentToSearchParams', () => {
  it('should map a full intent to search params', () => {
    const intent: ParsedIntent = {
      category: 'headphones',
      maximumPrice: 8000,
      minimumPrice: 1000,
      deliveryDeadline: 3,
      requiredAttributes: ['noise-cancelling'],
      preferredAttributes: ['comfortable'],
      exclusions: ['wired'],
      quantity: 1,
      minimumRating: 4.0,
      brand: 'Sony',
      ambiguityQuestions: [],
    };

    const params = intentToSearchParams(intent);
    expect(params.category).toBe('headphones');
    expect(params.maxPrice).toBe(8000);
    expect(params.minPrice).toBe(1000);
    expect(params.maxDeliveryDays).toBe(3);
    expect(params.minRating).toBe(4.0);
    expect(params.query).toBe('Sony');
    expect(params.tags).toEqual(['noise-cancelling']);
    expect(params.inStock).toBe(true);
    expect(params.limit).toBe(20);
  });

  it('should omit undefined fields for minimal intent', () => {
    const intent: ParsedIntent = {
      category: 'books',
      requiredAttributes: [],
      preferredAttributes: [],
      exclusions: [],
      quantity: 1,
      ambiguityQuestions: [],
    };

    const params = intentToSearchParams(intent);
    expect(params.category).toBe('books');
    expect(params.maxPrice).toBeUndefined();
    expect(params.minPrice).toBeUndefined();
    expect(params.maxDeliveryDays).toBeUndefined();
    expect(params.minRating).toBeUndefined();
    expect(params.query).toBeUndefined();
    expect(params.tags).toBeUndefined();
  });

  it('should set category to undefined for "general"', () => {
    const intent: ParsedIntent = {
      category: 'general',
      requiredAttributes: [],
      preferredAttributes: [],
      exclusions: [],
      quantity: 1,
      ambiguityQuestions: [],
    };

    const params = intentToSearchParams(intent);
    expect(params.category).toBeUndefined();
  });
});
