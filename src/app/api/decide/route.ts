import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/decide — Rank products and select a recommendation
 * Phase 2 will add LLM-powered decision making. For now, returns a stub.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      message: 'Decision agent will be implemented in Phase 2',
      stub: true,
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
