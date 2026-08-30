import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db/connection';
import { verifySessionToken } from '@/services/auth';
import { getOrCreateCatalogMerchant } from '@/services/merchant-catalog';

/**
 * GET /api/merchant/orders?page=1&limit=20
 *
 * Returns paginated list of all transactions that contain a product from
 * the logged-in merchant's catalog.
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

    let merchantCatalogId: string;
    try {
      merchantCatalogId = getOrCreateCatalogMerchant(db, session.userId);
    } catch (e) {
      return NextResponse.json({ error: 'Merchant profile not found' }, { status: 404 });
    }

    // Count
    const countResult = db.exec(
      `SELECT COUNT(t.id) as cnt 
       FROM transactions t
       JOIN products p ON t.selected_product_id = p.id
       WHERE p.merchant_id = ?`,
      [merchantCatalogId]
    );
    const total = Number(countResult[0]?.values?.[0]?.[0] ?? 0);

    // Fetch page
    const stmt = db.prepare(`
      SELECT t.id, t.state, t.intent_raw,
             t.selected_product_name, t.selected_product_price,
             t.negotiated_price, t.razorpay_payment_id,
             t.approval_status, t.failure_reason,
             t.created_at, t.updated_at
      FROM transactions t
      JOIN products p ON t.selected_product_id = p.id
      WHERE p.merchant_id = ?
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `);
    stmt.bind([merchantCatalogId, limit, offset]);

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

    const rows: OrderRow[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as OrderRow;
      rows.push(row);
    }
    stmt.free();

    const orders = rows.map((r) => ({
      id: r.id,
      state: r.state,
      intentRaw: r.intent_raw ?? undefined,
      productName: r.selected_product_name,
      productPrice: r.selected_product_price ?? 0,
      finalPrice: r.negotiated_price ?? r.selected_product_price ?? 0,
      wasNegotiated: r.negotiated_price != null && r.negotiated_price !== r.selected_product_price,
      paymentId: r.razorpay_payment_id ?? undefined,
      approvalStatus: r.approval_status ?? undefined,
      failureReason: r.failure_reason ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      dataNote: 'Orders shown belong exclusively to your merchant catalog.',
    });
  } catch (error) {
    console.error('[merchant/orders] error:', error);
    return NextResponse.json({ error: 'Failed to load merchant orders' }, { status: 500 });
  }
}
