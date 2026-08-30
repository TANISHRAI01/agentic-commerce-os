// ============================================================
// Auth Types — Phase 10A
// Zod schemas + TypeScript types for authentication & user profiles
// ============================================================

import { z } from 'zod';

// ── User Role ─────────────────────────────────────────────────
export const UserRole = z.enum(['CUSTOMER', 'MERCHANT']);
export type UserRole = z.infer<typeof UserRole>;

// ── Auth User (stored in auth_users table) ───────────────────
export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: UserRole,
  name: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

// ── Customer Profile ─────────────────────────────────────────
export const CustomerProfileSchema = z.object({
  userId: z.string(),
  monthlyIncome: z.number().positive().optional(),
  monthlyPurchaseLimit: z.number().positive().default(50000),
  agentSpendingLimit: z.number().positive().default(5000),
  approvalThreshold: z.number().positive().default(3000),
});
export type CustomerProfile = z.infer<typeof CustomerProfileSchema>;

// ── Merchant Profile ─────────────────────────────────────────
export const MerchantTrustTierAuth = z.enum([
  'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'UNRATED',
]);

export const MerchantProfileSchema = z.object({
  userId: z.string(),
  shopName: z.string().min(1),
  shopDescription: z.string().optional(),
  category: z.string().optional(),
  trustTier: MerchantTrustTierAuth.default('UNRATED'),
});
export type MerchantProfile = z.infer<typeof MerchantProfileSchema>;

// ── Combined User + Profile ──────────────────────────────────
export const CustomerWithProfileSchema = AuthUserSchema.extend({
  profile: CustomerProfileSchema,
});
export type CustomerWithProfile = z.infer<typeof CustomerWithProfileSchema>;

export const MerchantWithProfileSchema = AuthUserSchema.extend({
  profile: MerchantProfileSchema,
});
export type MerchantWithProfile = z.infer<typeof MerchantWithProfileSchema>;

// ── Signup Request ────────────────────────────────────────────
const BaseSignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  role: UserRole,
});

export const CustomerSignupSchema = BaseSignupSchema.extend({
  role: z.literal('CUSTOMER'),
  monthlyIncome: z.number().positive().optional(),
  monthlyPurchaseLimit: z.number().positive().optional(),
  agentSpendingLimit: z.number().positive().optional(),
  approvalThreshold: z.number().positive().optional(),
});

export const MerchantSignupSchema = BaseSignupSchema.extend({
  role: z.literal('MERCHANT'),
  shopName: z.string().min(1, 'Shop name is required'),
  shopDescription: z.string().optional(),
  category: z.string().optional(),
});

export const SignupRequestSchema = z.discriminatedUnion('role', [
  CustomerSignupSchema,
  MerchantSignupSchema,
]);
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

// ── Login Request ─────────────────────────────────────────────
export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// ── Session Payload (stored in JWT) ──────────────────────────
export const SessionPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  role: UserRole,
  name: z.string(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type SessionPayload = z.infer<typeof SessionPayloadSchema>;

// ── Auth Error Codes ──────────────────────────────────────────
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_TAKEN'
  | 'USER_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN';
