// PATCH /api/customer/profile
// Protected by middleware. Updates customer spending limits in customer_profiles.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, saveDb } from '@/db/connection';

const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  agentSpendingLimit: z.number().positive().optional(),
  approvalThreshold: z.number().positive().optional(),
  monthlyPurchaseLimit: z.number().positive().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const { name, agentSpendingLimit, approvalThreshold, monthlyPurchaseLimit } = parsed.data;
    const db = await getDb();

    // Update name in auth_users if provided
    if (name) {
      db.run(
        `UPDATE auth_users SET name = ?, updated_at = ? WHERE id = ?`,
        [name, new Date().toISOString(), userId],
      );
    }

    // Update customer_profiles if any limit provided
    if (agentSpendingLimit !== undefined || approvalThreshold !== undefined || monthlyPurchaseLimit !== undefined) {
      const setClauses: string[] = [];
      const values: (number | string)[] = [];

      if (agentSpendingLimit !== undefined) { setClauses.push('agent_spending_limit = ?'); values.push(agentSpendingLimit); }
      if (approvalThreshold !== undefined) { setClauses.push('approval_threshold = ?'); values.push(approvalThreshold); }
      if (monthlyPurchaseLimit !== undefined) { setClauses.push('monthly_purchase_limit = ?'); values.push(monthlyPurchaseLimit); }

      values.push(userId);
      db.run(`UPDATE customer_profiles SET ${setClauses.join(', ')} WHERE user_id = ?`, values);
    }

    saveDb();

    // Return updated profile
    const userResult = db.exec(`SELECT id, email, name, role, created_at, updated_at FROM auth_users WHERE id = ?`, [userId]);
    const profileResult = db.exec(
      `SELECT user_id, monthly_income, monthly_purchase_limit, agent_spending_limit, approval_threshold FROM customer_profiles WHERE user_id = ?`,
      [userId],
    );

    const [id, email, updatedName, role, createdAt, updatedAt] = (userResult[0]?.values?.[0] ?? []) as string[];
    const [, monthlyIncome, monthlyPurchaseLimitDb, agentSpendingLimitDb, approvalThresholdDb] =
      (profileResult[0]?.values?.[0] ?? []) as (string | number | null)[];

    return NextResponse.json({
      user: { id, email, name: updatedName, role, createdAt, updatedAt },
      profile: {
        userId,
        monthlyIncome: monthlyIncome ?? undefined,
        monthlyPurchaseLimit: Number(monthlyPurchaseLimitDb),
        agentSpendingLimit: Number(agentSpendingLimitDb),
        approvalThreshold: Number(approvalThresholdDb),
      },
    });
  } catch (err) {
    console.error('[/api/customer/profile] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
