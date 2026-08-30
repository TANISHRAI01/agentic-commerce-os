// ============================================================
// Auth Service — Phase 10A
// Handles signup, login, JWT session management.
// Pure functions — no LLM involvement. Deterministic only.
// ============================================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '@/db/connection';
import type {
  SignupRequest,
  AuthUser,
  SessionPayload,
  CustomerProfile,
  MerchantProfile,
  AuthErrorCode,
} from '@/types/auth';

// ── Auth Error ────────────────────────────────────────────────
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ── Constants ─────────────────────────────────────────────────
const SALT_ROUNDS = 10;
const SESSION_COOKIE_NAME = 'session_token';
const JWT_EXPIRY = '24h';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

// ── Signup ────────────────────────────────────────────────────
export async function signupUser(data: SignupRequest): Promise<AuthUser> {
  const db = await getDb();

  // Check for existing email
  const existing = db.exec(
    `SELECT id FROM auth_users WHERE email = ?`,
    [data.email],
  );
  if (existing[0]?.values?.length) {
    throw new AuthError('EMAIL_TAKEN', `An account with ${data.email} already exists`);
  }

  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const now = new Date().toISOString();

  // Insert into auth_users
  db.run(
    `INSERT INTO auth_users (id, email, password_hash, role, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, data.email, passwordHash, data.role, data.name, now, now],
  );

  // Insert role-specific profile
  if (data.role === 'CUSTOMER') {
    db.run(
      `INSERT INTO customer_profiles
         (user_id, monthly_income, monthly_purchase_limit, agent_spending_limit,
          approval_threshold, trusted_merchants_only, require_approval_first_purchase)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        data.monthlyIncome ?? null,
        data.monthlyPurchaseLimit ?? 50000,
        data.agentSpendingLimit ?? 5000,
        data.approvalThreshold ?? 3000,
        data.trustedMerchantsOnly ? 1 : 0,
        data.requireApprovalFirstPurchase ? 1 : 0,
      ],
    );
  } else {
    db.run(
      `INSERT INTO merchant_profiles (user_id, shop_name, shop_description, category, trust_tier)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        data.shopName,
        data.shopDescription ?? null,
        data.category ?? null,
        'UNRATED',
      ],
    );
  }

  saveDb();

  return {
    id: userId,
    email: data.email,
    role: data.role,
    name: data.name,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Login ─────────────────────────────────────────────────────
export async function loginUser(
  email: string,
  password: string,
): Promise<AuthUser> {
  const db = await getDb();

  const result = db.exec(
    `SELECT id, email, password_hash, role, name, created_at, updated_at
     FROM auth_users WHERE email = ?`,
    [email],
  );

  if (!result[0]?.values?.length) {
    // Use same error to prevent user enumeration
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const [id, dbEmail, passwordHash, role, name, createdAt, updatedAt] =
    result[0].values[0] as string[];

  const passwordMatch = await bcrypt.compare(password, passwordHash);
  if (!passwordMatch) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  return {
    id,
    email: dbEmail,
    role: role as 'CUSTOMER' | 'MERCHANT',
    name,
    createdAt,
    updatedAt,
  };
}

// ── JWT Session ───────────────────────────────────────────────
export function createSessionToken(user: AuthUser): string {
  const payload: Omit<SessionPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRY });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return decoded as SessionPayload;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE_NAME };

// ── Get User Profile ──────────────────────────────────────────
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const db = await getDb();

  const result = db.exec(
    `SELECT id, email, role, name, created_at, updated_at
     FROM auth_users WHERE id = ?`,
    [userId],
  );

  if (!result[0]?.values?.length) return null;

  const [id, email, role, name, createdAt, updatedAt] =
    result[0].values[0] as string[];

  return { id, email, role: role as 'CUSTOMER' | 'MERCHANT', name, createdAt, updatedAt };
}

export async function getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
  const db = await getDb();

  const result = db.exec(
    `SELECT user_id, monthly_income, monthly_purchase_limit, agent_spending_limit,
            approval_threshold, trusted_merchants_only, require_approval_first_purchase
     FROM customer_profiles WHERE user_id = ?`,
    [userId],
  );

  if (!result[0]?.values?.length) return null;

  const [uid, monthlyIncome, monthlyPurchaseLimit, agentSpendingLimit, approvalThreshold,
         trustedMerchantsOnly, requireApprovalFirstPurchase] =
    result[0].values[0] as (string | number | null)[];

  return {
    userId: uid as string,
    monthlyIncome: monthlyIncome != null ? Number(monthlyIncome) : undefined,
    monthlyPurchaseLimit: Number(monthlyPurchaseLimit),
    agentSpendingLimit: Number(agentSpendingLimit),
    approvalThreshold: Number(approvalThreshold),
    trustedMerchantsOnly: Boolean(trustedMerchantsOnly),
    requireApprovalFirstPurchase: Boolean(requireApprovalFirstPurchase),
  };
}

export async function getMerchantProfile(userId: string): Promise<MerchantProfile | null> {
  const db = await getDb();

  const result = db.exec(
    `SELECT user_id, shop_name, shop_description, category, trust_tier
     FROM merchant_profiles WHERE user_id = ?`,
    [userId],
  );

  if (!result[0]?.values?.length) return null;

  const [uid, shopName, shopDescription, category, trustTier] =
    result[0].values[0] as (string | null)[];

  return {
    userId: uid as string,
    shopName: shopName as string,
    shopDescription: shopDescription ?? undefined,
    category: category ?? undefined,
    trustTier: (trustTier as MerchantProfile['trustTier']) ?? 'UNRATED',
  };
}
