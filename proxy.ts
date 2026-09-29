import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/anmeldung', '/api/register', '/api/club-teams', '/api/clubs', '/_next', '/favicon.ico'];

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (process.env.APP_MODE !== 'public') {
    // Lokale App: Sync-Endpunkte gibt es nur auf der gehosteten Instanz
    return path.startsWith('/api/sync/') ? new NextResponse(null, { status: 404 }) : NextResponse.next();
  }
  if (path.startsWith('/api/sync/')) {
    const token = process.env.SYNC_TOKEN;
    const ok = !!token && req.headers.get('authorization') === `Bearer ${token}`;
    return ok ? NextResponse.next() : new NextResponse(null, { status: 401 });
  }
  if (path === '/' || PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return NextResponse.next();
  }
  return new NextResponse(null, { status: 404 });
}
