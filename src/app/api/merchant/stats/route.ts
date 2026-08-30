import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db/connection';
import { verifySessionToken } from '@/services/auth';

/**
 * GET /api/merchant/stats
 *
 * Returns aggregate merchant stats from the synthetic catalog and transactions.
 * All data is from the SQLite database — no fabricated metrics.
 * Demo note is included in every response.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session || session.role !== 'MERCHANT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();

    // Total products in catalog
    const productResult = db.exec(`SELECT COUNT(*) as cnt FROM products WHERE stock > 0`);
    const totalProducts = Number(productResult[0]?.values?.[0]?.[0] ?? 0);

    // Total orders (all transactions with a selected product)
    const orderResult = db.exec(
      `SELECT COUNT(*) as cnt FROM transactions WHERE selected_product_name IS NOT NULL`,
    );
    const totalOrders = Number(orderResult[0]?.values?.[0]?.[0] ?? 0);

    // Completed orders
    const completedResult = db.exec(
      `SELECT COUNT(*) as cnt FROM transactions WHERE state = 'COMPLETED'`,
    );
    const completedOrders = Number(completedResult[0]?.values?.[0]?.[0] ?? 0);

    // Pending approvals
    const pendingResult = db.exec(
      `SELECT COUNT(*) as cnt FROM transactions WHERE state = 'APPROVAL_REQUIRED'`,
    );
    const pendingApprovals = Number(pendingResult[0]?.values?.[0]?.[0] ?? 0);

    // Total revenue (sum of completed negotiated or selected price)
    const revenueResult = db.exec(`
      SELECT COALESCE(SUM(COALESCE(negotiated_price, selected_product_price)), 0) as total
      FROM transactions
      WHERE state = 'COMPLETED' AND selected_product_price IS NOT NULL
    `);
    const totalRevenue = Number(revenueResult[0]?.values?.[0]?.[0] ?? 0);

    // Top product by transaction count
    const topProductResult = db.exec(`
      SELECT selected_product_name, COUNT(*) as cnt
      FROM transactions
      WHERE selected_product_name IS NOT NULL
      GROUP BY selected_product_name
      ORDER BY cnt DESC
      LIMIT 1
    `);
    const topProduct = topProductResult[0]?.values?.[0]
      ? {
          name: String(topProductResult[0].values[0][0]),
          orderCount: Number(topProductResult[0].values[0][1]),
        }
      : null;

    // Total merchants in catalog
    const merchantResult = db.exec(`SELECT COUNT(*) as cnt FROM merchants`);
    const totalMerchants = Number(merchantResult[0]?.values?.[0]?.[0] ?? 0);

    // Average product rating
    const avgRatingResult = db.exec(
      `SELECT ROUND(AVG(rating), 2) as avg FROM products WHERE stock > 0`,
    );
    const avgRating = Number(avgRatingResult[0]?.values?.[0]?.[0] ?? 0);

    return NextResponse.json({
      totalProducts,
      totalOrders,
      completedOrders,
      pendingApprovals,
      totalRevenue,
      totalMerchants,
      avgRating,
      topProduct,
      dataNote: 'All data is from the synthetic catalog and demo transactions. No real revenue.',
    });
  } catch (error) {
    console.error('[merchant/stats] error:', error);
    return NextResponse.json({ error: 'Failed to load merchant stats' }, { status: 500 });
  }
}
