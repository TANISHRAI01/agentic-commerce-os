import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db/connection';
import { verifySessionToken } from '@/services/auth';
import { getOrCreateCatalogMerchant } from '@/services/merchant-catalog';
import { getAuditTrail } from '@/audit/logger';

/**
 * GET /api/merchant/orders/[id]
 *
 * Returns a specific order (transaction) and its audit trail, ONLY if
 * the transaction is for a product owned by the logged-in merchant.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session || session.role !== 'MERCHANT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    
    let merchantCatalogId: string;
    try {
      merchantCatalogId = getOrCreateCatalogMerchant(db, session.userId);
    } catch (e) {
      return NextResponse.json({ error: 'Merchant profile not found' }, { status: 404 });
    }

    // Verify ownership and fetch transaction
    const stmt = db.prepare(`
      SELECT t.*, p.merchant_id
      FROM transactions t
      JOIN products p ON t.selected_product_id = p.id
      WHERE t.id = ? AND p.merchant_id = ?
    `);
    stmt.bind([params.id, merchantCatalogId]);

    const row = stmt.getAsObject();
    stmt.free();

    if (!row || !row.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Map to Transaction schema (stripping user_id for customer privacy)
    const transaction = {
      id: row.id as string,
      state: row.state as string,
      intentId: (row.intent_id as string) || undefined,
      intentRaw: (row.intent_raw as string) || undefined,
      selectedProductId: (row.selected_product_id as string) || undefined,
      selectedProductName: (row.selected_product_name as string) || undefined,
      selectedProductPrice: (row.selected_product_price as number) || undefined,
      negotiatedPrice: (row.negotiated_price as number) || undefined,
      negotiationRounds: (row.negotiation_rounds as number) || undefined,
      negotiationLog: (row.negotiation_log as string) || undefined,
      policyResult: row.policy_result ? JSON.parse(row.policy_result as string) : undefined,
      approvalStatus: (row.approval_status as string) || undefined,
      razorpayOrderId: (row.razorpay_order_id as string) || undefined,
      razorpayPaymentId: (row.razorpay_payment_id as string) || undefined,
      idempotencyKey: row.idempotency_key as string,
      failureReason: (row.failure_reason as string) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };

    // Get audit trail
    const auditEvents = getAuditTrail(db, params.id);

    return NextResponse.json({ transaction, auditEvents });

  } catch (error) {
    console.error('[merchant/orders/id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
