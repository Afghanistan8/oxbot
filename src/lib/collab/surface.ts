import "server-only";

import { headers } from "next/headers";

import { absoluteUrl } from "@/lib/utils";
import {
  COLLAB_HOST_HEADER,
  COLLAB_PREFIX,
  SURFACE_HEADER,
  joinCollabPath,
} from "@/lib/collab/host";

/**
 * Server-side surface resolution for pages and chrome.
 *
 * `base` is the prefix Collab links need on the current request: "" on the
 * dedicated Collab host (middleware rewrites), "/collab" everywhere else.
 */
export type CollabSurface = {
  isCollab: boolean;
  onCollabHost: boolean;
  base: string;
};

export async function getCollabSurface(): Promise<CollabSurface> {
  const h = await headers();
  const onCollabHost = h.get(COLLAB_HOST_HEADER) === "1";
  return {
    isCollab: h.get(SURFACE_HEADER) === "collab",
    onCollabHost,
    base: onCollabHost ? "" : COLLAB_PREFIX,
  };
}

/** Build a Collab link for the current request (`/listings` or `/collab/listings`). */
export async function collabHref(path = "/"): Promise<string> {
  const { base } = await getCollabSurface();
  return joinCollabPath(base, path);
}

/**
 * A link to a shared oxbot route (dashboard, sign-in, profile, giveaway page).
 * On the Collab host it goes to the main host absolutely, so the user lands
 * where their session cookie lives even without a shared cookie domain.
 */
export async function mainSiteHref(path: string): Promise<string> {
  const { onCollabHost } = await getCollabSurface();
  return onCollabHost ? absoluteUrl(path) : path;
}

/**
 * Where oxbot's own chrome should send people for Collab: the dedicated host
 * when `COLLAB_HOST` is configured, else the `/collab` path fallback.
 */
export function collabEntryUrl(path = "/"): string {
  const host = process.env.COLLAB_HOST?.trim();
  if (!host) return joinCollabPath(COLLAB_PREFIX, path);
  const protocol = /localhost|127\.0\.0\.1/.test(host) ? "http" : "https";
  return `${protocol}://${host}${path === "/" ? "" : path}`;
}

/** Absolute, shareable Collab URL (copy-link buttons, webhooks, emails). */
export function collabShareUrl(path = "/"): string {
  return absoluteUrl(collabEntryUrl(path));
}
