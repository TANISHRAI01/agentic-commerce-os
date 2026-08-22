import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb } from '@/db/connection';
import { searchProducts, getCategories, getProductCount } from '@/services/catalog';
import { CatalogSearchParams } from '@/types/schemas';

/**
 * POST /api/discover — Search the product catalog
 * Accepts structured search params and returns matching products.
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    // Validate search params
    const parsed = CatalogSearchParams.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const db = await getDb();
    const products = searchProducts(db, parsed.data);

    return NextResponse.json({
      success: true,
      products,
      count: products.length,
      params: parsed.data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/discover — Get catalog metadata (categories, count)
 */
export async function GET() {
  try {
    const db = await getDb();
    const categories = getCategories(db);
    const totalProducts = getProductCount(db);

    return NextResponse.json({
      success: true,
      categories,
      totalProducts,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
