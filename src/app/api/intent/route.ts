import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { createTransaction, transitionTransaction } from '@/services/transaction';
import { createAuditEvent } from '@/audit/logger';
import { parseIntent } from '@/agents/discovery';
import { LLMValidationError, LLMConnectionError } from '@/services/llm';

/**
 * POST /api/intent — Parse a shopping intent from natural language
 * Uses the Discovery Agent (LLM-powered) to extract structured intent.
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

    const { query, idempotencyKey } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: query (non-empty string)' },
        { status: 400 },
      );
    }

    const db = await getDb();

    // Create transaction and move to DISCOVERY state
    const txn = createTransaction(db, { intentRaw: query.trim(), idempotencyKey });

    createAuditEvent(db, {
      transactionId: txn.id,
      event: 'INTENT_RECEIVED',
      result: 'INFO',
      reason: `Shopping intent received: "${query.trim().substring(0, 100)}"`,
      metadata: { rawQuery: query.trim() },
    });

    const discoveryTxn = transitionTransaction(db, txn.id, 'DISCOVERY');

    createAuditEvent(db, {
      transactionId: txn.id,
      event: 'DISCOVERY_STARTED',
      result: 'INFO',
      reason: 'Discovery Agent parsing natural language intent',
    });

    // Parse intent using LLM
    const intent = await parseIntent(query.trim());

    createAuditEvent(db, {
      transactionId: txn.id,
      event: 'DISCOVERY_COMPLETE',
      result: 'SUCCESS',
      reason: `Intent parsed: category="${intent.category}", maxPrice=${intent.maximumPrice ?? 'none'}`,
      metadata: { intent },
    });

    return NextResponse.json({
      success: true,
      transactionId: txn.id,
      intent,
      ambiguityQuestions: intent.ambiguityQuestions,
    });
  } catch (error) {
    if (error instanceof LLMValidationError) {
      return NextResponse.json(
        {
          error: 'Failed to parse shopping intent',
          details: 'The AI could not extract structured information from your query. Please try rephrasing.',
          type: 'LLM_VALIDATION_ERROR',
        },
        { status: 422 },
      );
    }

    if (error instanceof LLMConnectionError) {
      return NextResponse.json(
        {
          error: 'AI service unavailable',
          details: error.message,
          type: 'LLM_CONNECTION_ERROR',
        },
        { status: 503 },
      );
    }

    console.error('Intent parsing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
