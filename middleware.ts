// ============================================================
// Next.js Middleware — Phase 10A Route Protection
// Runs at the edge before every request.
//
// PROTECTED:
//   /customer/*        → requires CUSTOMER role
//   /merchant/*        → requires MERCHANT role
//   /api/customer/*    → requires CUSTOMER role (API)
//   /api/merchant/*    → requires MERCHANT role (API)
//
// UNPROTECTED (Phase 1–9 routes — unchanged):
//   /                  → existing shopping chat
//   /api/shop          → Phase 2 unified shop endpoint
//   /api/checkout      → Phase 4 payment
//   /api/payment/*     → Phase 4–5 payment/recovery
//   /api/negotiate     → Phase 9 negotiation
//   /api/merchants/*   → Phase 7 merchant layer
//   /api/audit         → Phase 1 audit
//   /api/policy        → Phase 3 policy
//   /api/approve       → Phase 3 approval
//   /api/auth/*        → Auth endpoints themselves
//   /auth/*            → Auth UI pages
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE_NAME = 'session_token';

// Routes that require authentication and their required role
const PROTECTED_ROUTES: { pattern: RegExp; role: 'CUSTOMER' | 'MERCHANT' }[] = [
  { pattern: /^\/customer(\/.*)?$/, role: 'CUSTOMER' },
  { pattern: /^\/merchant(\/.*)?$/, role: 'MERCHANT' },
  { pattern: /^\/api\/customer(\/.*)?$/, role: 'CUSTOMER' },
  { pattern: /^\/api\/merchant(\/.*)?$/, role: 'MERCHANT' },
];

function getJwtSecretBytes(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? 'fallback-dev-secret-change-in-production';
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Find if this route is protected
  const protectedRoute = PROTECTED_ROUTES.find(({ pattern }) => pattern.test(pathname));
  if (!protectedRoute) {
    // Not a protected route — let it through
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isApiRequest = pathname.startsWith('/api/');

  if (!token) {
    if (isApiRequest) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }
    // Browser request — redirect to login with role hint
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('role', protectedRoute.role);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // jose works in the Edge runtime (unlike jsonwebtoken which is Node-only)
    const { payload } = await jwtVerify(token, getJwtSecretBytes());
    const userRole = payload.role as string;

    if (userRole !== protectedRoute.role) {
      // Wrong role
      if (isApiRequest) {
        return NextResponse.json(
          {
            error: `Access denied. This route requires ${protectedRoute.role} role.`,
            code: 'FORBIDDEN',
          },
          { status: 403 },
        );
      }
      // Browser: redirect to their own dashboard
      const ownDashboard = userRole === 'CUSTOMER' ? '/customer' : '/merchant';
      return NextResponse.redirect(new URL(ownDashboard, req.url));
    }

    // Authorized — attach user info to headers for downstream use
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', payload.userId as string);
    requestHeaders.set('x-user-role', userRole);
    requestHeaders.set('x-user-email', payload.email as string);

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // Token invalid or expired
    if (isApiRequest) {
      return NextResponse.json(
        { error: 'Invalid or expired session', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('role', protectedRoute.role);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  // Only run middleware on routes that could be protected.
  // Explicitly excludes all Phase 1-9 routes and auth routes.
  matcher: ['/customer/:path*', '/merchant/:path*', '/api/customer/:path*', '/api/merchant/:path*'],
};
