// ============================================================
// Tests — Schema Validation
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  ProductSchema,
  MerchantSchema,
  ShoppingIntentSchema,
  CartSchema,
  PolicyResultSchema,
  TransactionSchema,
  AuditEventSchema,
  PolicyConfigSchema,
  UserSchema,
} from '@/types/schemas';

describe('Schema Validation', () => {
  describe('ProductSchema', () => {
    const validProduct = {
      id: 'prod-001',
      merchantId: 'merch-001',
      name: 'Test Headphones',
      description: 'Great headphones',
      category: 'headphones',
      price: 4999,
      currency: 'INR',
      stock: 10,
      rating: 4.5,
      deliveryDays: 3,
      merchantTrustTier: 'GOLD' as const,
      attributes: { type: 'over-ear', anc: 'true' },
      tags: ['wireless', 'noise-cancelling'],
      createdAt: '2025-01-01T00:00:00Z',
    };

    it('should validate a correct product', () => {
      expect(() => ProductSchema.parse(validProduct)).not.toThrow();
    });

    it('should reject negative price', () => {
      expect(() => ProductSchema.parse({ ...validProduct, price: -100 })).toThrow();
    });

    it('should reject empty name', () => {
      expect(() => ProductSchema.parse({ ...validProduct, name: '' })).toThrow();
    });

    it('should reject rating > 5', () => {
      expect(() => ProductSchema.parse({ ...validProduct, rating: 6 })).toThrow();
    });

    it('should reject rating < 0', () => {
      expect(() => ProductSchema.parse({ ...validProduct, rating: -1 })).toThrow();
    });

    it('should reject negative stock', () => {
      expect(() => ProductSchema.parse({ ...validProduct, stock: -5 })).toThrow();
    });

    it('should reject invalid trust tier', () => {
      expect(() => ProductSchema.parse({ ...validProduct, merchantTrustTier: 'DIAMOND' })).toThrow();
    });

    it('should accept all valid trust tiers', () => {
      for (const tier of ['PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'UNRATED']) {
        expect(() => ProductSchema.parse({ ...validProduct, merchantTrustTier: tier })).not.toThrow();
      }
    });
  });

  describe('MerchantSchema', () => {
    it('should validate a correct merchant', () => {
      expect(() => MerchantSchema.parse({
        id: 'merch-001',
        name: 'Test Store',
        trustTier: 'GOLD',
        createdAt: '2025-01-01T00:00:00Z',
      })).not.toThrow();
    });

    it('should reject empty name', () => {
      expect(() => MerchantSchema.parse({
        id: 'merch-001',
        name: '',
        trustTier: 'GOLD',
        createdAt: '2025-01-01T00:00:00Z',
      })).toThrow();
    });
  });

  describe('UserSchema', () => {
    it('should validate a correct user', () => {
      expect(() => UserSchema.parse({
        id: 'user-001',
        name: 'Test User',
        budget: 10000,
        currency: 'INR',
        createdAt: '2025-01-01T00:00:00Z',
      })).not.toThrow();
    });

    it('should reject zero budget', () => {
      expect(() => UserSchema.parse({
        id: 'user-001',
        name: 'Test',
        budget: 0,
        createdAt: '2025-01-01T00:00:00Z',
      })).toThrow();
    });
  });

  describe('ShoppingIntentSchema', () => {
    it('should validate a correct shopping intent', () => {
      expect(() => ShoppingIntentSchema.parse({
        id: 'intent-001',
        rawQuery: 'Find me noise-cancelling headphones under 8000',
        category: 'headphones',
        maxBudget: 8000,
        currency: 'INR',
        constraints: {
          maxDeliveryDays: 3,
          features: ['noise-cancelling'],
        },
        createdAt: '2025-01-01T00:00:00Z',
      })).not.toThrow();
    });

    it('should reject empty rawQuery', () => {
      expect(() => ShoppingIntentSchema.parse({
        id: 'intent-001',
        rawQuery: '',
        category: 'headphones',
        maxBudget: 8000,
        constraints: {},
        createdAt: '2025-01-01T00:00:00Z',
      })).toThrow();
    });
  });

  describe('PolicyResultSchema', () => {
    it('should validate a passing policy result', () => {
      expect(() => PolicyResultSchema.parse({
        overall: 'PASS',
        requiresApproval: true,
        approvalReason: 'Cart above ₹3,000',
        checks: [
          { name: 'BUDGET_CHECK', result: 'PASS', reason: 'Within budget', details: { actual: 3799, limit: 8000 } },
          { name: 'AGENT_LIMIT', result: 'PASS', reason: 'Within agent limit', details: { actual: 3799, limit: 5000 } },
        ],
      })).not.toThrow();
    });

    it('should validate a failing policy result', () => {
      expect(() => PolicyResultSchema.parse({
        overall: 'FAIL',
        requiresApproval: false,
        checks: [
          { name: 'AGENT_LIMIT', result: 'FAIL', reason: 'Exceeds agent limit', details: { actual: 5800, limit: 5000 } },
        ],
      })).not.toThrow();
    });
  });

  describe('PolicyConfigSchema', () => {
    it('should validate a correct policy config', () => {
      expect(() => PolicyConfigSchema.parse({
        userBudget: 8000,
        agentSpendingLimit: 5000,
        approvalThreshold: 3000,
        allowedMerchantTiers: ['PLATINUM', 'GOLD'],
      })).not.toThrow();
    });
  });

  describe('CartSchema', () => {
    it('should validate a correct cart', () => {
      expect(() => CartSchema.parse({
        id: 'cart-001',
        transactionId: 'txn-001',
        items: [
          { productId: 'prod-001', productName: 'Test', price: 4999, quantity: 1, merchantId: 'merch-001', merchantTrustTier: 'GOLD' },
        ],
        totalAmount: 4999,
        currency: 'INR',
        createdAt: '2025-01-01T00:00:00Z',
      })).not.toThrow();
    });
  });

  describe('TransactionSchema', () => {
    it('should validate a correct transaction', () => {
      expect(() => TransactionSchema.parse({
        id: 'txn-001',
        state: 'CREATED',
        idempotencyKey: 'idem-001',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      })).not.toThrow();
    });

    it('should reject invalid state', () => {
      expect(() => TransactionSchema.parse({
        id: 'txn-001',
        state: 'INVALID_STATE',
        idempotencyKey: 'idem-001',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      })).toThrow();
    });
  });

  describe('AuditEventSchema', () => {
    it('should validate a correct audit event', () => {
      expect(() => AuditEventSchema.parse({
        id: 'evt-001',
        timestamp: '2025-01-01T00:00:00Z',
        transactionId: 'txn-001',
        event: 'INTENT_RECEIVED',
        result: 'SUCCESS',
        reason: 'Shopping intent parsed successfully',
      })).not.toThrow();
    });

    it('should reject invalid event type', () => {
      expect(() => AuditEventSchema.parse({
        id: 'evt-001',
        timestamp: '2025-01-01T00:00:00Z',
        transactionId: 'txn-001',
        event: 'NOT_A_REAL_EVENT',
        result: 'SUCCESS',
        reason: 'test',
      })).toThrow();
    });

    it('should accept metadata', () => {
      expect(() => AuditEventSchema.parse({
        id: 'evt-001',
        timestamp: '2025-01-01T00:00:00Z',
        transactionId: 'txn-001',
        event: 'POLICY_CHECK',
        result: 'INFO',
        reason: 'Policy evaluation started',
        metadata: { cartTotal: 3799, limit: 5000 },
      })).not.toThrow();
    });
  });
});
