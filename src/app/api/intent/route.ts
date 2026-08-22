import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/intent — Parse a shopping intent from natural language
 * Phase 2 will add LLM-powered parsing. For now, returns a stub.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: query' },
        { status: 400 },
      );
    }

    // Stub response — Phase 2 will replace with LLM parsing
    return NextResponse.json({
      success: true,
      message: 'Intent parsing will be implemented in Phase 2',
      stub: true,
      intent: {
        rawQuery: query,
        category: 'unknown',
        maxBudget: 0,
        constraints: {},
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
