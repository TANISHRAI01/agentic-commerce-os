// GET /api/customer/transactions/[id]
// Protected by middleware. Returns a single transaction with audit trail.
// Ownership-verified — customer can only see their own transactions.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getTransactionForUser } from '@/services/transaction';
import { getAuditTrail } from '@/audit/logger';
import { getAuthUser, unauthorized } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();
    const userId = auth.userId;

    const db = await getDb();
    const transaction = getTransactionForUser(db, params.id, userId);

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    const auditEvents = getAuditTrail(db, params.id);

    return NextResponse.json({ transaction, auditEvents });
  } catch (err) {
    console.error('[/api/customer/transactions/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
