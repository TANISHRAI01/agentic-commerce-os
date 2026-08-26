import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { getProductById } from '@/services/catalog';

export async function GET(
  req: NextRequest,
  { params }: { params: { merchantId: string; productId: string } }
) {
  try {
    const db = await getDb();
    const product = getProductById(db, params.productId);
    
    if (!product || product.merchantId !== params.merchantId) {
      return NextResponse.json(
        { success: false, error: 'Product not found for this merchant' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      inventory: {
        stock: product.stock,
        availability: product.availability,
      },
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}
