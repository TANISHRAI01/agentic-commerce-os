// GET /api/customer/transactions
// Protected by middleware (CUSTOMER role). Returns paginated transactions for the authenticated user.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getTransactionsByUserId, countTransactionsByUserId } from '@/services/transaction';
import { getAuthUser, unauthorized } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return unauthorized();
    const userId = auth.userId;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const db = await getDb();
    const transactions = getTransactionsByUserId(db, userId, limit, offset);
    const total = countTransactionsByUserId(db, userId);

    return NextResponse.json({
      transactions,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (err) {
    console.error('[/api/customer/transactions] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
