// ============================================================
// Auth Tests — Phase 10A
// Tests for signup, login, JWT, role enforcement, profiles.
// Uses in-memory test DB (no side effects on real DB).
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock the DB module ────────────────────────────────────────
// Use vi.hoisted so mockDb is available when vi.mock factory runs
const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    exec: vi.fn(),
    run: vi.fn(),
  };
  return { mockDb };
});

vi.mock('@/db/connection', () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
  saveDb: vi.fn(),
}));

// ── Mock bcryptjs ─────────────────────────────────────────────
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
    compare: vi.fn(),
  },
}));

import bcrypt from 'bcryptjs';
import {
  signupUser,
  loginUser,
  createSessionToken,
  verifySessionToken,
  AuthError,
  getCustomerProfile,
  getMerchantProfile,
} from '@/services/auth';

// Set a test JWT_SECRET
process.env.JWT_SECRET = 'test-jwt-secret-for-auth-tests-phase-10a';

// ── Helper: reset mock state ──────────────────────────────────
function resetMocks() {
  mockDb.exec.mockReset();
  mockDb.run.mockReset();
  (bcrypt.compare as ReturnType<typeof vi.fn>).mockReset();
  (bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValue('$2b$10$hashedpassword');
}

// ── Zod Schema Tests ─────────────────────────────────────────
describe('Auth Schemas', () => {
  it('SignupRequestSchema validates CUSTOMER role correctly', async () => {
    const { SignupRequestSchema } = await import('@/types/auth');
    const result = SignupRequestSchema.safeParse({
      role: 'CUSTOMER',
      name: 'Tanish',
      email: 'tanish@test.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('CUSTOMER');
    }
  });

  it('SignupRequestSchema validates MERCHANT role correctly', async () => {
    const { SignupRequestSchema } = await import('@/types/auth');
    const result = SignupRequestSchema.safeParse({
      role: 'MERCHANT',
      name: 'Shop Owner',
      email: 'shop@test.com',
      password: 'password123',
      shopName: 'My Electronics Store',
    });
    expect(result.success).toBe(true);
  });

  it('SignupRequestSchema rejects MERCHANT without shopName', async () => {
    const { SignupRequestSchema } = await import('@/types/auth');
    const result = SignupRequestSchema.safeParse({
      role: 'MERCHANT',
      name: 'Shop Owner',
      email: 'shop@test.com',
      password: 'password123',
      // missing shopName
    });
    expect(result.success).toBe(false);
  });

  it('SignupRequestSchema rejects password shorter than 8 chars', async () => {
    const { SignupRequestSchema } = await import('@/types/auth');
    const result = SignupRequestSchema.safeParse({
      role: 'CUSTOMER',
      name: 'Test',
      email: 'test@test.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('LoginRequestSchema validates valid credentials', async () => {
    const { LoginRequestSchema } = await import('@/types/auth');
    const result = LoginRequestSchema.safeParse({ email: 'user@test.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('LoginRequestSchema rejects invalid email', async () => {
    const { LoginRequestSchema } = await import('@/types/auth');
    const result = LoginRequestSchema.safeParse({ email: 'not-an-email', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('CustomerProfileSchema applies correct defaults', async () => {
    const { CustomerProfileSchema } = await import('@/types/auth');
    const result = CustomerProfileSchema.parse({ userId: 'u1' });
    expect(result.agentSpendingLimit).toBe(5000);
    expect(result.approvalThreshold).toBe(3000);
    expect(result.monthlyPurchaseLimit).toBe(50000);
  });

  it('MerchantProfileSchema defaults to UNRATED trust tier', async () => {
    const { MerchantProfileSchema } = await import('@/types/auth');
    const result = MerchantProfileSchema.parse({ userId: 'u1', shopName: 'Test Shop' });
    expect(result.trustTier).toBe('UNRATED');
  });
});

// ── Signup Tests ─────────────────────────────────────────────
describe('signupUser', () => {
  beforeEach(resetMocks);

  it('creates a CUSTOMER user successfully', async () => {
    // No existing user found
    mockDb.exec.mockReturnValue([]);
    mockDb.run.mockReturnValue(undefined);

    const user = await signupUser({
      role: 'CUSTOMER',
      name: 'Tanish',
      email: 'tanish@test.com',
      password: 'password123',
    });

    expect(user.role).toBe('CUSTOMER');
    expect(user.email).toBe('tanish@test.com');
    expect(user.name).toBe('Tanish');
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('passwordHash');
    // Verify password was hashed
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
  });

  it('creates a MERCHANT user successfully', async () => {
    mockDb.exec.mockReturnValue([]);
    mockDb.run.mockReturnValue(undefined);

    const user = await signupUser({
      role: 'MERCHANT',
      name: 'Shop Owner',
      email: 'shop@test.com',
      password: 'securepass',
      shopName: 'Electronics World',
      category: 'Electronics',
    });

    expect(user.role).toBe('MERCHANT');
    expect(user.email).toBe('shop@test.com');
    // Verify merchant profile INSERT was called (2nd run call)
    expect(mockDb.run).toHaveBeenCalledTimes(2); // auth_users + merchant_profiles
  });

  it('throws EMAIL_TAKEN if email already exists', async () => {
    // Simulate existing user found
    mockDb.exec.mockReturnValue([{ values: [['existing-id']] }]);

    await expect(
      signupUser({
        role: 'CUSTOMER',
        name: 'Dup',
        email: 'existing@test.com',
        password: 'password123',
      }),
    ).rejects.toThrow(AuthError);

    try {
      await signupUser({
        role: 'CUSTOMER',
        name: 'Dup',
        email: 'existing@test.com',
        password: 'password123',
      });
    } catch (e) {
      expect((e as AuthError).code).toBe('EMAIL_TAKEN');
    }
  });

  it('customer profile uses provided spending limits', async () => {
    mockDb.exec.mockReturnValue([]);

    await signupUser({
      role: 'CUSTOMER',
      name: 'Budget Customer',
      email: 'budget@test.com',
      password: 'password123',
      agentSpendingLimit: 2000,
      approvalThreshold: 1500,
    });

    // Second run call is customer_profiles INSERT
    // INSERT order: userId, monthlyIncome, monthlyPurchaseLimit, agentSpendingLimit, approvalThreshold
    const profileRunArgs = mockDb.run.mock.calls[1];
    expect(profileRunArgs[1][3]).toBe(2000); // agentSpendingLimit is at index 3
    expect(profileRunArgs[1][4]).toBe(1500); // approvalThreshold is at index 4

  });

  it('customer profile uses safe defaults when limits not provided', async () => {
    mockDb.exec.mockReturnValue([]);

    await signupUser({
      role: 'CUSTOMER',
      name: 'Default Customer',
      email: 'default@test.com',
      password: 'password123',
    });

    const profileRunArgs = mockDb.run.mock.calls[1];
    expect(profileRunArgs[1][2]).toBe(50000); // monthlyPurchaseLimit default
    expect(profileRunArgs[1][3]).toBe(5000);  // agentSpendingLimit default
    expect(profileRunArgs[1][4]).toBe(3000);  // approvalThreshold default
  });
});

// ── Login Tests ──────────────────────────────────────────────
describe('loginUser', () => {
  beforeEach(resetMocks);

  const MOCK_USER_ROW = ['user-id-123', 'tanish@test.com', '$2b$10$hashedpassword', 'CUSTOMER', 'Tanish', '2026-01-01', '2026-01-01'];

  it('returns user on valid credentials', async () => {
    mockDb.exec.mockReturnValue([{ values: [MOCK_USER_ROW] }]);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const user = await loginUser('tanish@test.com', 'correctpassword');
    expect(user.id).toBe('user-id-123');
    expect(user.email).toBe('tanish@test.com');
    expect(user.role).toBe('CUSTOMER');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('throws INVALID_CREDENTIALS on wrong password', async () => {
    mockDb.exec.mockReturnValue([{ values: [MOCK_USER_ROW] }]);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await expect(loginUser('tanish@test.com', 'wrongpassword')).rejects.toThrow(AuthError);

    try {
      await loginUser('tanish@test.com', 'wrongpassword');
    } catch (e) {
      expect((e as AuthError).code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('throws INVALID_CREDENTIALS on non-existent email (prevents user enumeration)', async () => {
    mockDb.exec.mockReturnValue([]);

    try {
      await loginUser('nobody@test.com', 'anypassword');
    } catch (e) {
      // Must use same error code as wrong password — prevents user enumeration
      expect((e as AuthError).code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('merchant can log in with correct credentials', async () => {
    const merchantRow = ['merch-id-456', 'shop@test.com', '$2b$10$hash', 'MERCHANT', 'Shop Owner', '2026-01-01', '2026-01-01'];
    mockDb.exec.mockReturnValue([{ values: [merchantRow] }]);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const user = await loginUser('shop@test.com', 'password');
    expect(user.role).toBe('MERCHANT');
  });
});

// ── JWT Session Tests ─────────────────────────────────────────
describe('JWT Session', () => {
  const testUser = {
    id: 'user-123',
    email: 'test@test.com',
    role: 'CUSTOMER' as const,
    name: 'Test User',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  it('creates a valid JWT token', () => {
    const token = createSessionToken(testUser);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT format: header.payload.signature
  });

  it('verifies a valid token and returns payload', () => {
    const token = createSessionToken(testUser);
    const payload = verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe('user-123');
    expect(payload?.role).toBe('CUSTOMER');
    expect(payload?.email).toBe('test@test.com');
  });

  it('returns null for a tampered token', () => {
    const token = createSessionToken(testUser);
    const tampered = token.slice(0, -5) + 'XXXXX';
    const payload = verifySessionToken(tampered);
    expect(payload).toBeNull();
  });

  it('returns null for a completely invalid token', () => {
    const payload = verifySessionToken('not.a.jwt');
    expect(payload).toBeNull();
  });

  it('MERCHANT token contains correct role', () => {
    const merchantUser = { ...testUser, id: 'merch-1', role: 'MERCHANT' as const };
    const token = createSessionToken(merchantUser);
    const payload = verifySessionToken(token);
    expect(payload?.role).toBe('MERCHANT');
  });

  it('token does not contain password hash', () => {
    const token = createSessionToken(testUser);
    // Decode payload (middle part of JWT)
    const payloadPart = token.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payloadPart, 'base64url').toString());
    expect(decoded).not.toHaveProperty('password');
    expect(decoded).not.toHaveProperty('passwordHash');
  });
});

// ── Profile Retrieval Tests ───────────────────────────────────
describe('getCustomerProfile', () => {
  beforeEach(resetMocks);

  it('returns customer profile with correct fields', async () => {
    mockDb.exec.mockReturnValue([{
      values: [['user-123', null, 50000, 5000, 3000]],
    }]);

    const profile = await getCustomerProfile('user-123');
    expect(profile?.userId).toBe('user-123');
    expect(profile?.agentSpendingLimit).toBe(5000);
    expect(profile?.approvalThreshold).toBe(3000);
    expect(profile?.monthlyPurchaseLimit).toBe(50000);
    expect(profile?.monthlyIncome).toBeUndefined();
  });

  it('returns null if customer profile not found', async () => {
    mockDb.exec.mockReturnValue([]);
    const profile = await getCustomerProfile('nonexistent');
    expect(profile).toBeNull();
  });
});

describe('getMerchantProfile', () => {
  beforeEach(resetMocks);

  it('returns merchant profile with correct fields', async () => {
    mockDb.exec.mockReturnValue([{
      values: [['merch-456', 'Electronics World', 'Best electronics store', 'Electronics', 'GOLD']],
    }]);

    const profile = await getMerchantProfile('merch-456');
    expect(profile?.shopName).toBe('Electronics World');
    expect(profile?.trustTier).toBe('GOLD');
    expect(profile?.category).toBe('Electronics');
  });

  it('returns null if merchant profile not found', async () => {
    mockDb.exec.mockReturnValue([]);
    const profile = await getMerchantProfile('nonexistent');
    expect(profile).toBeNull();
  });
});
