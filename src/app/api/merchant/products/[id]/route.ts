import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db/connection';
import { verifySessionToken } from '@/services/auth';
import { getProductById } from '@/services/catalog';
import {
  getMerchantCatalogId,
  updateMerchantProduct,
  assertProductOwnership,
  MerchantCatalogError,
} from '@/services/merchant-catalog';
import { ProductUpdateSchema } from '@/types/schemas';

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  return token ? verifySessionToken(token) : null;
}

/**
 * GET /api/merchant/products/[id]
 * Returns a single product. Ownership-checked.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'MERCHANT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDb();
    const product = getProductById(db, id);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Verify ownership
    const merchantCatalogId = getMerchantCatalogId(db, session.userId);
    if (merchantCatalogId && product.merchantId !== merchantCatalogId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('[merchant/products/[id] GET]', error);
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 });
  }
}

/**
 * PUT /api/merchant/products/[id]
 * Update a product. Ownership-checked. Partial update supported.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'MERCHANT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const parsed = ProductUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const db = await getDb();
    const product = updateMerchantProduct(db, session.userId, id, parsed.data);

    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof MerchantCatalogError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 403;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('[merchant/products/[id] PUT]', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}
