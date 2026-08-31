// ============================================================
// API Auth Helper — resolves authenticated userId in route handlers
//
// Dual-mode auth:
//   1. Fast path: x-user-id header set by middleware (Edge)
//   2. Fallback: read + verify session_token cookie directly (Node)
//
// This makes API routes resilient to Edge middleware JWT failures.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/services/auth';

export interface AuthResult {
  userId: string;
  role: string;
  email: string;
}

/**
 * Resolve the authenticated user from a request.
 * Returns null if unauthenticated.
 */
export function getAuthUser(req: NextRequest): AuthResult | null {
  // Fast path: middleware already verified and injected headers
  const userId = req.headers.get('x-user-id');
  const role   = req.headers.get('x-user-role');
  const email  = req.headers.get('x-user-email');

  if (userId && role && email) {
    return { userId, role, email };
  }

  // Fallback: verify the session cookie directly (Node.js runtime)
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  return {
    userId: session.userId,
    role: session.role,
    email: session.email,
  };
}

/**
 * Returns a 401 response for unauthorized requests.
 */
export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message, code: 'UNAUTHORIZED' }, { status: 401 });
}

/**
 * Returns a 403 response for forbidden requests.
 */
export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message, code: 'FORBIDDEN' }, { status: 403 });
}
