import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db/connection';
import { verifySessionToken } from '@/services/auth';
import { getOrCreateCatalogMerchant } from '@/services/merchant-catalog';

/**
 * GET /api/merchant/stats
 *
 * Returns aggregate merchant stats scoped to the logged-in merchant's catalog.
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
    
    // Get the actual merchant catalog ID
    let merchantCatalogId: string;
    try {
      merchantCatalogId = getOrCreateCatalogMerchant(db, session.userId);
    } catch (e) {
      return NextResponse.json({ error: 'Merchant profile not found' }, { status: 404 });
    }

    // Total products in THIS merchant's catalog
    const productResult = db.exec(
      `SELECT COUNT(*) as cnt FROM products WHERE merchant_id = ? AND stock > 0`,
      [merchantCatalogId]
    );
    const totalProducts = Number(productResult[0]?.values?.[0]?.[0] ?? 0);

    // Total orders (transactions for products owned by THIS merchant)
    const orderResult = db.exec(`
      SELECT COUNT(t.id) as cnt 
      FROM transactions t
      JOIN products p ON t.selected_product_id = p.id
      WHERE p.merchant_id = ?
    `, [merchantCatalogId]);
    const totalOrders = Number(orderResult[0]?.values?.[0]?.[0] ?? 0);

    // Completed orders
    const completedResult = db.exec(`
      SELECT COUNT(t.id) as cnt 
      FROM transactions t
      JOIN products p ON t.selected_product_id = p.id
      WHERE p.merchant_id = ? AND t.state = 'COMPLETED'
    `, [merchantCatalogId]);
    const completedOrders = Number(completedResult[0]?.values?.[0]?.[0] ?? 0);

    // Pending approvals
    const pendingResult = db.exec(`
      SELECT COUNT(t.id) as cnt 
      FROM transactions t
      JOIN products p ON t.selected_product_id = p.id
      WHERE p.merchant_id = ? AND t.state = 'APPROVAL_REQUIRED'
    `, [merchantCatalogId]);
    const pendingApprovals = Number(pendingResult[0]?.values?.[0]?.[0] ?? 0);

    // Total revenue (sum of completed negotiated or selected price)
    const revenueResult = db.exec(`
      SELECT COALESCE(SUM(COALESCE(t.negotiated_price, t.selected_product_price)), 0) as total
      FROM transactions t
      JOIN products p ON t.selected_product_id = p.id
      WHERE p.merchant_id = ? AND t.state = 'COMPLETED' AND t.selected_product_price IS NOT NULL
    `, [merchantCatalogId]);
    const totalRevenue = Number(revenueResult[0]?.values?.[0]?.[0] ?? 0);

    // Top product by transaction count
    const topProductResult = db.exec(`
      SELECT t.selected_product_name, COUNT(t.id) as cnt
      FROM transactions t
      JOIN products p ON t.selected_product_id = p.id
      WHERE p.merchant_id = ? AND t.selected_product_name IS NOT NULL
      GROUP BY t.selected_product_name
      ORDER BY cnt DESC
      LIMIT 1
    `, [merchantCatalogId]);
    
    const topProduct = topProductResult[0]?.values?.[0]
      ? {
          name: String(topProductResult[0].values[0][0]),
          orderCount: Number(topProductResult[0].values[0][1]),
        }
      : null;

    // We no longer report "Total merchants in catalog" as it's not relevant to a single merchant's stats
    // We'll return 1 for now to prevent breaking UI expectations, or just the merchant's trust tier.
    const totalMerchants = 1; 

    // Average product rating for THIS merchant
    const avgRatingResult = db.exec(
      `SELECT ROUND(AVG(rating), 2) as avg FROM products WHERE merchant_id = ? AND stock > 0`,
      [merchantCatalogId]
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
      dataNote: 'Data is now scoped exclusively to your merchant catalog.',
    });
  } catch (error) {
    console.error('[merchant/stats] error:', error);
    return NextResponse.json({ error: 'Failed to load merchant stats' }, { status: 500 });
  }
}
