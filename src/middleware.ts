import { NextResponse, type NextRequest } from "next/server";

import {
  COLLAB_HOST_HEADER,
  COLLAB_PREFIX,
  SURFACE_HEADER,
  isCollabHost,
  isPassthroughPath,
} from "@/lib/collab/host";

/**
 * Multi-host routing for oxbot + OxFoxes Collab (one app, one DB, one session).
 *
 *  - `oxbotfoxes.xyz` / `www.` → the oxbot app, untouched.
 *  - `collab.oxbotfoxes.xyz`   → `/x` is rewritten to the `/collab/x` route
 *    group. Shared routes (auth, dashboard, profile, entry flow, assets) pass
 *    through. A stray `/collab/x` on the Collab host redirects to `/x` so each
 *    page has one canonical URL.
 *  - Any host, path `/collab/*` → served directly (local dev without DNS).
 *
 * Every Collab request carries `x-oxbot-surface: collab` so server components
 * can pick brand chrome + link bases without re-parsing the host.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const onCollabHost = isCollabHost(req.headers.get("host"), process.env.COLLAB_HOST);
  const onCollabPath = pathname === COLLAB_PREFIX || pathname.startsWith(`${COLLAB_PREFIX}/`);

  if (onCollabHost) {
    if (onCollabPath) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.slice(COLLAB_PREFIX.length) || "/";
      return NextResponse.redirect(url, 308);
    }

    const headers = new Headers(req.headers);
    headers.set(SURFACE_HEADER, "collab");
    headers.set(COLLAB_HOST_HEADER, "1");

    if (isPassthroughPath(pathname)) {
      return NextResponse.next({ request: { headers } });
    }

    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? COLLAB_PREFIX : `${COLLAB_PREFIX}${pathname}`;
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // Never trust surface headers sent by the client — only middleware sets them.
  const headers = new Headers(req.headers);
  headers.delete(COLLAB_HOST_HEADER);
  if (onCollabPath) {
    headers.set(SURFACE_HEADER, "collab");
  } else {
    headers.delete(SURFACE_HEADER);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Skip Next internals and image optimization; everything else is inspected.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
