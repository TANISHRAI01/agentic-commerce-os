import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db/connection';
import { verifySessionToken } from '@/services/auth';

/**
 * GET /api/merchant/orders?page=1&limit=20
 *
 * Returns paginated list of all transactions that have a selected product.
 * In demo mode, this shows platform-wide activity — clearly labeled.
 * Merchant authentication is required.
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session || session.role !== 'MERCHANT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));
    const offset = (page - 1) * limit;

    const db = await getDb();

    // Count
    const countResult = db.exec(
      `SELECT COUNT(*) as cnt FROM transactions WHERE selected_product_name IS NOT NULL`,
    );
    const total = Number(countResult[0]?.values?.[0]?.[0] ?? 0);

    // Fetch page
    const stmt = db.prepare(`
      SELECT id, state, intent_raw,
             selected_product_name, selected_product_price,
             negotiated_price, razorpay_payment_id,
             approval_status, failure_reason,
             created_at, updated_at
      FROM transactions
      WHERE selected_product_name IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    stmt.bind([limit, offset]);

    interface OrderRow {
      id: string;
      state: string;
      intent_raw: string | null;
      selected_product_name: string;
      selected_product_price: number | null;
      negotiated_price: number | null;
      razorpay_payment_id: string | null;
      approval_status: string | null;
      failure_reason: string | null;
      created_at: string;
      updated_at: string;
    }

    const orders = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as OrderRow;
      orders.push({
        id: row.id,
        state: row.state,
        intentRaw: row.intent_raw ?? undefined,
        productName: row.selected_product_name,
        productPrice: row.selected_product_price ?? 0,
        finalPrice: row.negotiated_price ?? row.selected_product_price ?? 0,
        wasNegotiated: row.negotiated_price != null && row.negotiated_price !== row.selected_product_price,
        razorpayPaymentId: row.razorpay_payment_id ?? undefined,
        approvalStatus: row.approval_status ?? undefined,
        failureReason: row.failure_reason ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
    stmt.free();

    return NextResponse.json({
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      dataNote: 'Showing all platform orders (demo mode — not filtered to a single merchant catalog).',
    });
  } catch (error) {
    console.error('[merchant/orders] error:', error);
    return NextResponse.json({ error: 'Failed to load merchant orders' }, { status: 500 });
  }
}
