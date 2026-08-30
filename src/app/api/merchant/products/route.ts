import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db/connection';
import { verifySessionToken } from '@/services/auth';
import {
  getOrCreateCatalogMerchant,
  getMerchantCatalogId,
  getProductsByMerchantCatalogId,
  countProductsByMerchantCatalogId,
  createMerchantProduct,
  MerchantCatalogError,
} from '@/services/merchant-catalog';
import { ProductCreateSchema } from '@/types/schemas';

async function getSession(req?: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  return token ? verifySessionToken(token) : null;
}

/**
 * GET /api/merchant/products?page=1&limit=20
 * Returns the authenticated merchant's own products.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'MERCHANT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));
    const offset = (page - 1) * limit;

    const db = await getDb();
    const merchantCatalogId = getMerchantCatalogId(db, session.userId);

    // No catalog linked yet → return empty list (not an error)
    if (!merchantCatalogId) {
      return NextResponse.json({
        products: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        merchantCatalogId: null,
      });
    }

    const products = getProductsByMerchantCatalogId(db, merchantCatalogId, limit, offset);
    const total = countProductsByMerchantCatalogId(db, merchantCatalogId);

    return NextResponse.json({
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      merchantCatalogId,
    });
  } catch (error) {
    console.error('[merchant/products GET]', error);
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}

/**
 * POST /api/merchant/products
 * Create a new product under the authenticated merchant's catalog.
 * Auto-creates the catalog merchant entry if it doesn't exist yet.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'MERCHANT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate input
    const parsed = ProductCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const db = await getDb();
    const product = createMerchantProduct(db, session.userId, parsed.data);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof MerchantCatalogError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
    }
    console.error('[merchant/products POST]', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
