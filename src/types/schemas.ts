// ============================================================
// Shared Schemas — Agentic Commerce OS
// Zod schemas + TypeScript types for all core models
// ============================================================

import { z } from 'zod';

// ── Merchant Trust Tiers ─────────────────────────────────────
export const MerchantTrustTier = z.enum([
  'PLATINUM',
  'GOLD',
  'SILVER',
  'BRONZE',
  'UNRATED',
]);
export type MerchantTrustTier = z.infer<typeof MerchantTrustTier>;

// ── Merchant ─────────────────────────────────────────────────
export const MerchantSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  trustTier: MerchantTrustTier,
  description: z.string().optional(),
  policies: z.array(z.string()).default([]),
  deliveryRegions: z.array(z.string()).default([]),
  paymentCapabilities: z.array(z.string()).default([]),
  businessRules: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});
export type Merchant = z.infer<typeof MerchantSchema>;

// ── Product ──────────────────────────────────────────────────
export const ProductSchema = z.object({
  id: z.string(),
  merchantId: z.string(),
  name: z.string().min(1),
  description: z.string(),
  category: z.string(),
  price: z.number().positive(),
  currency: z.string().default('INR'),
  stock: z.number().int().min(0),
  rating: z.number().min(0).max(5),
  deliveryDays: z.number().int().min(1),
  merchantTrustTier: MerchantTrustTier,
  attributes: z.record(z.string(), z.string()),
  tags: z.array(z.string()),
  imageUrl: z.string().optional(),
  availability: z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'PREORDER']).default('IN_STOCK'),
  offerEligibility: z.array(z.string()).default([]),
  createdAt: z.string(),
});
export type Product = z.infer<typeof ProductSchema>;

// ── User ─────────────────────────────────────────────────────
export const UserSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  budget: z.number().positive(),
  currency: z.string().default('INR'),
  createdAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

// ── Shopping Intent ──────────────────────────────────────────
export const ShoppingIntentConstraints = z.object({
  maxDeliveryDays: z.number().int().positive().optional(),
  minRating: z.number().min(0).max(5).optional(),
  features: z.array(z.string()).optional(),
  brand: z.string().optional(),
});

export const ShoppingIntentSchema = z.object({
  id: z.string(),
  rawQuery: z.string().min(1),
  category: z.string(),
  maxBudget: z.number().positive(),
  currency: z.string().default('INR'),
  constraints: ShoppingIntentConstraints,
  createdAt: z.string(),
});
export type ShoppingIntent = z.infer<typeof ShoppingIntentSchema>;

// ── Cart ─────────────────────────────────────────────────────
export const CartItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  price: z.number().positive(),
  quantity: z.number().int().positive().default(1),
  merchantId: z.string(),
  merchantTrustTier: MerchantTrustTier,
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  items: z.array(CartItemSchema),
  totalAmount: z.number().min(0),
  currency: z.string().default('INR'),
  createdAt: z.string(),
});
export type Cart = z.infer<typeof CartSchema>;

// ── Policy ───────────────────────────────────────────────────
export const PolicyCheckResult = z.enum(['PASS', 'FAIL']);

export const PolicyCheckSchema = z.object({
  name: z.string(),
  result: PolicyCheckResult,
  reason: z.string(),
  details: z.object({
    actual: z.union([z.number(), z.string()]),
    limit: z.union([z.number(), z.string()]),
  }),
});
export type PolicyCheck = z.infer<typeof PolicyCheckSchema>;

export const PolicyResultSchema = z.object({
  overall: PolicyCheckResult,
  requiresApproval: z.boolean(),
  approvalReason: z.string().optional(),
  checks: z.array(PolicyCheckSchema),
});
export type PolicyResult = z.infer<typeof PolicyResultSchema>;

export const PolicyConfigSchema = z.object({
  userBudget: z.number().positive(),
  agentSpendingLimit: z.number().positive(),
  approvalThreshold: z.number().positive(),
  allowedMerchantTiers: z.array(MerchantTrustTier),
  configCurrency: z.string().default('INR'),
});
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

export const PolicyEvaluationInputSchema = z.object({
  cartTotal: z.number().min(0),
  cartCurrency: z.string().min(1),
  merchantTrustTier: MerchantTrustTier,
  userBudget: z.number().positive(),
  agentSpendingLimit: z.number().positive(),
  approvalThreshold: z.number().positive(),
  allowedMerchantTiers: z.array(MerchantTrustTier).min(1),
  configCurrency: z.string().min(1).default('INR'),
  // Phase 10C: optional per-customer controls
  trustedMerchantsOnly: z.boolean().optional(),
  requireApprovalFirstPurchase: z.boolean().optional(),
  monthlySpent: z.number().min(0).optional(),
  monthlyPurchaseLimit: z.number().positive().optional(),
});

export type PolicyEvaluationInput = z.infer<typeof PolicyEvaluationInputSchema>;

// ── Transaction States ───────────────────────────────────────
export const TransactionState = z.enum([
  'CREATED',
  'DISCOVERY',
  'DECISION',
  'CART_READY',
  'NEGOTIATING',        // Phase 9 — bounded agent negotiation in progress
  'POLICY_PENDING',
  'POLICY_FAIL',
  'APPROVAL_REQUIRED',
  'APPROVED',
  'AUTO_APPROVED',
  'PAYMENT_PENDING',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'PAYMENT_UNKNOWN',
  'VERIFIED',
  'COMPLETED',
  'CANCELLED',
  'BLOCKED',
]);
export type TransactionState = z.infer<typeof TransactionState>;

export const ApprovalStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

export const TransactionSchema = z.object({
  id: z.string(),
  state: TransactionState,
  intentId: z.string().optional(),
  intentRaw: z.string().optional(),
  selectedProductId: z.string().optional(),
  selectedProductName: z.string().optional(),
  selectedProductPrice: z.number().optional(),
  negotiatedPrice: z.number().optional(),        // Phase 9: server-clamped negotiated price
  negotiationRounds: z.number().int().optional(), // Phase 9: number of rounds completed
  negotiationLog: z.string().optional(),          // Phase 9: JSON array of NegotiationRound[]
  policyResult: PolicyResultSchema.optional(),
  approvalStatus: ApprovalStatus.optional(),
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  idempotencyKey: z.string(),
  failureReason: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

// ── Payment ──────────────────────────────────────────────────
export const PaymentStatus = z.enum([
  'CREATED',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'UNKNOWN',
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PaymentSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string().optional(),
  razorpaySignature: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default('INR'),
  status: PaymentStatus,
  idempotencyKey: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Payment = z.infer<typeof PaymentSchema>;

// ── Audit Events ─────────────────────────────────────────────
export const AuditEventType = z.enum([
  'INTENT_RECEIVED',
  'DISCOVERY_STARTED',
  'DISCOVERY_COMPLETE',
  'DECISION_STARTED',
  'DECISION_COMPLETE',
  'CART_CREATED',
  'POLICY_CHECK',
  'POLICY_RESULT',
  'POLICY_EVALUATED',
  'APPROVAL_REQUESTED',
  'APPROVAL_RECEIVED',
  'APPROVAL_GRANTED',
  'APPROVAL_REJECTED',
  'ORDER_CREATED',
  'PAYMENT_INITIATED',
  'PAYMENT_STATUS_POLLED',
  'PAYMENT_VERIFIED',
  'PAYMENT_FAILED',
  'PAYMENT_TIMEOUT',
  'RECOVERY_ATTEMPTED',
  'PAYMENT_RECONCILED',
  'RETRY_BLOCKED',
  'DUPLICATE_PREVENTED',
  'TRANSACTION_COMPLETE',
  'TRANSACTION_FAILED',
  'MERCHANT_AGENT_STARTED',
  'MERCHANT_AGENT_COMPLETE',
  'NEGOTIATION_STARTED',    // Phase 9
  'NEGOTIATION_ROUND',      // Phase 9: one round of buyer↔merchant exchange
  'NEGOTIATION_COMPLETE',   // Phase 9: deal reached or no deal
  'NEGOTIATION_SKIPPED',    // Phase 9: merchant has no discount capability
  'STATE_TRANSITION',
]);
export type AuditEventType = z.infer<typeof AuditEventType>;

export const AuditEventResult = z.enum(['SUCCESS', 'FAILURE', 'INFO', 'WARNING']);

export const AuditEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  transactionId: z.string(),
  event: AuditEventType,
  result: AuditEventResult,
  reason: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ── Catalog Search ───────────────────────────────────────────
export const CatalogSearchParams = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().positive().optional(),
  maxDeliveryDays: z.number().int().positive().optional(),
  minRating: z.number().min(0).max(5).optional(),
  merchantId: z.string().optional(),
  merchantTrustTiers: z.array(MerchantTrustTier).optional(),
  inStock: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().min(0).default(0),
});
export type CatalogSearchParams = z.infer<typeof CatalogSearchParams>;
