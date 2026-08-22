import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/payment/status — Poll payment status
 * Phase 4 will implement Razorpay status polling.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    return NextResponse.json(
      { error: 'Missing required param: orderId' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Payment status polling will be implemented in Phase 4',
    stub: true,
    orderId,
  });
}
