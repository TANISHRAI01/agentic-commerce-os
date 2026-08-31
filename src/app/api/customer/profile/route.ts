// GET /api/customer/profile — Returns full customer profile + computed spending
// PATCH /api/customer/profile — Updates name and/or spending limits and policy toggles
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, saveDb } from '@/db/connection';
import { getCustomerPolicyConfig, computeMonthlySpent } from '@/services/customer-policy';
import { getAuthUser, unauthorized } from '@/lib/api-auth';

const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  agentSpendingLimit: z.number().positive().optional(),
  approvalThreshold: z.number().positive().optional(),
  monthlyPurchaseLimit: z.number().positive().optional(),
  monthlyIncome: z.number().positive().optional(),
  // Phase 10C: policy toggles
  trustedMerchantsOnly: z.boolean().optional(),
  requireApprovalFirstPurchase: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();
    const userId = auth.userId;

    const db = await getDb();

    // User info
    const userResult = db.exec(
      `SELECT id, email, name, role, created_at, updated_at FROM auth_users WHERE id = ?`,
      [userId],
    );
    if (!userResult[0]?.values?.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const [id, email, name, role, createdAt, updatedAt] = userResult[0].values[0] as string[];

    // Full policy config (includes computed monthly spend + remaining budget)
    const policyConfig = getCustomerPolicyConfig(db, userId);

    // Raw profile for display
    const profileResult = db.exec(
      `SELECT user_id, monthly_income, monthly_purchase_limit, agent_spending_limit,
              approval_threshold, trusted_merchants_only, require_approval_first_purchase
       FROM customer_profiles WHERE user_id = ?`,
      [userId],
    );

    let profile = null;
    if (profileResult[0]?.values?.length) {
      const [uid, monthlyIncome, monthlyPurchaseLimit, agentSpendingLimit, approvalThreshold,
             trustedOnly, requireApproval] = profileResult[0].values[0] as (string | number | null)[];
      profile = {
        userId: uid,
        monthlyIncome: monthlyIncome != null ? Number(monthlyIncome) : undefined,
        monthlyPurchaseLimit: Number(monthlyPurchaseLimit),
        agentSpendingLimit: Number(agentSpendingLimit),
        approvalThreshold: Number(approvalThreshold),
        trustedMerchantsOnly: Boolean(trustedOnly),
        requireApprovalFirstPurchase: Boolean(requireApproval),
      };
    }

    return NextResponse.json({
      user: { id, email, name, role, createdAt, updatedAt },
      profile,
      spending: {
        monthlySpent: policyConfig.monthlySpent,
        monthlyPurchaseLimit: policyConfig.monthlyPurchaseLimit,
        remainingBudget: policyConfig.remainingBudget,
        agentSpendingLimit: policyConfig.agentSpendingLimit,
        approvalThreshold: policyConfig.approvalThreshold,
        trustedMerchantsOnly: policyConfig.trustedMerchantsOnly,
        requireApprovalFirstPurchase: policyConfig.requireApprovalFirstPurchase,
      },
    });
  } catch (err) {
    console.error('[GET /api/customer/profile] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();
    const userId = auth.userId;

    const body = await req.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const {
      name,
      agentSpendingLimit,
      approvalThreshold,
      monthlyPurchaseLimit,
      monthlyIncome,
      trustedMerchantsOnly,
      requireApprovalFirstPurchase,
    } = parsed.data;

    const db = await getDb();

    // Update name in auth_users if provided
    if (name) {
      db.run(
        `UPDATE auth_users SET name = ?, updated_at = ? WHERE id = ?`,
        [name, new Date().toISOString(), userId],
      );
    }

    // Build dynamic SET clause for customer_profiles
    const setClauses: string[] = [];
    const values: (number | string | null)[] = [];

    if (agentSpendingLimit !== undefined) { setClauses.push('agent_spending_limit = ?'); values.push(agentSpendingLimit); }
    if (approvalThreshold !== undefined) { setClauses.push('approval_threshold = ?'); values.push(approvalThreshold); }
    if (monthlyPurchaseLimit !== undefined) { setClauses.push('monthly_purchase_limit = ?'); values.push(monthlyPurchaseLimit); }
    if (monthlyIncome !== undefined) { setClauses.push('monthly_income = ?'); values.push(monthlyIncome); }
    // Phase 10C: policy toggles (stored as 0/1 integers in SQLite)
    if (trustedMerchantsOnly !== undefined) { setClauses.push('trusted_merchants_only = ?'); values.push(trustedMerchantsOnly ? 1 : 0); }
    if (requireApprovalFirstPurchase !== undefined) { setClauses.push('require_approval_first_purchase = ?'); values.push(requireApprovalFirstPurchase ? 1 : 0); }

    if (setClauses.length > 0) {
      values.push(userId);
      db.run(`UPDATE customer_profiles SET ${setClauses.join(', ')} WHERE user_id = ?`, values);
    }

    saveDb();

    // Return the updated policy config (with fresh monthly spend computation)
    const policyConfig = getCustomerPolicyConfig(db, userId);
    const userResult = db.exec(
      `SELECT id, email, name, role, created_at, updated_at FROM auth_users WHERE id = ?`,
      [userId],
    );
    const [id, email, updatedName, role, createdAt, updatedAt] = (userResult[0]?.values?.[0] ?? []) as string[];

    return NextResponse.json({
      user: { id, email, name: updatedName, role, createdAt, updatedAt },
      profile: {
        userId,
        agentSpendingLimit: policyConfig.agentSpendingLimit,
        approvalThreshold: policyConfig.approvalThreshold,
        monthlyPurchaseLimit: policyConfig.monthlyPurchaseLimit,
        trustedMerchantsOnly: policyConfig.trustedMerchantsOnly,
        requireApprovalFirstPurchase: policyConfig.requireApprovalFirstPurchase,
      },
      spending: {
        monthlySpent: policyConfig.monthlySpent,
        remainingBudget: policyConfig.remainingBudget,
      },
    });
  } catch (err) {
    console.error('[PATCH /api/customer/profile] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
