import { NextRequest, NextResponse } from 'next/server';

/**
 * Private single-user dashboard guard.
 * Every page and API route is protected, including write/delete endpoints.
 * The local Mac runner does not call these routes and remains unchanged.
 */
export async function middleware(request: NextRequest) {
  const username = process.env.MPM_AUTH_USER;
  const password = process.env.MPM_AUTH_PASSWORD;

  // Fail closed if Vercel was deployed before the secrets were configured.
  if (!username || !password) {
    return new NextResponse('Accesso non configurato.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  const auth = request.headers.get('authorization') ?? '';
  const match = /^Basic\s+([A-Za-z0-9+/]+={0,2})$/i.exec(auth);
  let suppliedUsername = '';
  let suppliedPassword = '';

  if (match) {
    try {
      const decoded = atob(match[1]);
      const separator = decoded.indexOf(':');
      if (separator >= 0) {
        suppliedUsername = decoded.slice(0, separator);
        suppliedPassword = decoded.slice(separator + 1);
      }
    } catch {
      // Malformed Basic token: return the normal authorization challenge.
    }
  }

  // SHA-256 comparison makes comparison timing independent of password length.
  const encoder = new TextEncoder();
  const expected = encoder.encode(`${username}:${password}`);
  const supplied = encoder.encode(`${suppliedUsername}:${suppliedPassword}`);
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', expected),
    crypto.subtle.digest('SHA-256', supplied)
  ]);
  const left = new Uint8Array(expectedHash);
  const right = new Uint8Array(suppliedHash);
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];

  if (!match || difference !== 0) {
    return new NextResponse('Autenticazione richiesta.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Music Price Monitor", charset="UTF-8"',
        'Cache-Control': 'no-store'
      }
    });
  }

  return NextResponse.next();
}

export const config = {
  // No exclusion for /api: ALL HTTP endpoints are protected.
  // Next.js static assets can remain public; they contain no Supabase data.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
