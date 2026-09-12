/**
 * Collab surface / host helpers.
 *
 * Edge-safe (no Node or server-only imports) because the middleware uses it.
 *
 * OxFoxes Collab is served from the same app two ways:
 *  - on its own host (`collab.oxbotfoxes.xyz`, or `collab.localhost:3000` in
 *    dev), where middleware rewrites `/listings` → `/collab/listings`;
 *  - under the `/collab` path on any host, so it works locally with no DNS.
 */

/** Internal route-group prefix every Collab page lives under. */
export const COLLAB_PREFIX = "/collab";

/** Request header the middleware sets on every Collab request. */
export const SURFACE_HEADER = "x-oxbot-surface";
/** Set (to "1") when the request arrived on the dedicated Collab host. */
export const COLLAB_HOST_HEADER = "x-oxbot-collab-host";

/**
 * Paths that are NOT rewritten on the Collab host: shared app routes (auth,
 * dashboard, profile, the entry flow) and static assets. Everything else maps
 * into the `/collab` route group.
 */
const PASSTHROUGH_PREFIXES = [
  "/api",
  "/_next",
  "/dashboard",
  "/signin",
  "/profile",
  "/giveaways",
  "/uploads",
];

/** Strip port + lowercase a Host header value. */
function hostname(host: string): string {
  return host.toLowerCase().replace(/:\d+$/, "");
}

/**
 * Is this request on the dedicated Collab host? Matches the configured
 * `COLLAB_HOST` exactly, or any `collab.` subdomain (covers preview hosts and
 * `collab.localhost`).
 */
export function isCollabHost(host: string | null | undefined, configured?: string): boolean {
  if (!host) return false;
  const h = hostname(host);
  if (configured && h === hostname(configured)) return true;
  return h.startsWith("collab.");
}

/** Should a path on the Collab host skip the rewrite? */
export function isPassthroughPath(pathname: string): boolean {
  if (PASSTHROUGH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  // Static files at the root (icon.png, og-default.jpg, robots.txt, …).
  return /\.[a-z0-9]+$/i.test(pathname);
}

/** Join a Collab base ("" on the Collab host, "/collab" elsewhere) with a path. */
export function joinCollabPath(base: string, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (!base) return clean;
  return clean === "/" ? base : `${base}${clean}`;
}
