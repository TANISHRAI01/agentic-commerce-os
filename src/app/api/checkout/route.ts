import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/checkout — Create a Razorpay order and prepare checkout
 * Phase 4 will implement Razorpay integration.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      message: 'Checkout will be implemented in Phase 4',
      stub: true,
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
