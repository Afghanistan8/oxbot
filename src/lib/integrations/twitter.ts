import { env, integrations } from "@/lib/env";

/**
 * X (Twitter) integration.
 *
 * Live mode: uses the X API v2 with an app bearer token for follow/like/repost
 * verification. Mock mode: returns success so local entry flows are testable.
 *
 * NOTE: X API access tiers vary; these helpers are written defensively and will
 * fall back to a permissive result (with a logged warning) if the API denies a
 * particular endpoint on your tier, so a misconfigured tier never hard-blocks
 * entries in development.
 */

export type TwitterCheckResult = {
  ok: boolean;
  mocked: boolean;
  detail?: string;
};

const API = "https://api.x.com/2";

function mock(detail: string): TwitterCheckResult {
  return { ok: true, mocked: true, detail };
}

async function apiGet(path: string): Promise<Response> {
  return fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}` },
    // Never cache verification checks.
    cache: "no-store",
  });
}

/** Resolve a username (without @) to a user id. Returns null on failure. */
export async function getTwitterUserId(username: string): Promise<string | null> {
  if (!integrations.twitter.apiLive) return null;
  try {
    const res = await apiGet(`/users/by/username/${encodeURIComponent(username)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id?: string } };
    return json.data?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Verify that `sourceUserId` follows the account `targetUsername`.
 */
export async function verifyFollows(
  sourceUserId: string | null | undefined,
  targetUsername: string
): Promise<TwitterCheckResult> {
  if (!integrations.twitter.apiLive) {
    return mock(`Mock: assumed follow of @${targetUsername}`);
  }
  if (!sourceUserId) {
    return { ok: false, mocked: false, detail: "No connected X account." };
  }
  try {
    const targetId = await getTwitterUserId(targetUsername);
    if (!targetId) {
      console.warn(`[twitter] could not resolve @${targetUsername}; allowing.`);
      return { ok: true, mocked: true, detail: "Target unresolved; allowed." };
    }
    // Page through the user's following list looking for the target.
    let token: string | undefined;
    for (let page = 0; page < 10; page++) {
      const q = new URLSearchParams({ max_results: "1000" });
      if (token) q.set("pagination_token", token);
      const res = await apiGet(`/users/${sourceUserId}/following?${q.toString()}`);
      if (res.status === 403) {
        console.warn("[twitter] following endpoint not permitted on this tier; allowing.");
        return { ok: true, mocked: true, detail: "API tier limited; allowed." };
      }
      if (!res.ok) {
        // Rate limit (429) or a transient X API error mid-check. This is
        // inconclusive — NOT proof the user doesn't follow — so we must not
        // hard-fail a possibly-legitimate entrant over our own infra hiccup.
        console.warn(`[twitter] follow check got ${res.status}; allowing (inconclusive).`);
        return { ok: true, mocked: true, detail: "Check unavailable; allowed." };
      }
      const json = (await res.json()) as {
        data?: { id: string }[];
        meta?: { next_token?: string };
      };
      if (json.data?.some((u) => u.id === targetId)) {
        return { ok: true, mocked: false, detail: `Follows @${targetUsername}` };
      }
      token = json.meta?.next_token;
      if (!token) break;
    }
    return { ok: false, mocked: false, detail: `Not following @${targetUsername}` };
  } catch (e) {
    console.warn("[twitter] verifyFollows error; allowing:", e);
    return { ok: true, mocked: true, detail: "Check errored; allowed." };
  }
}

/** Verify that a user liked a specific tweet. */
export async function verifyLiked(
  sourceUserId: string | null | undefined,
  tweetId: string
): Promise<TwitterCheckResult> {
  if (!integrations.twitter.apiLive) {
    return mock(`Mock: assumed like of tweet ${tweetId}`);
  }
  if (!sourceUserId) {
    return { ok: false, mocked: false, detail: "No connected X account." };
  }
  try {
    let token: string | undefined;
    for (let page = 0; page < 5; page++) {
      const q = new URLSearchParams({ max_results: "100" });
      if (token) q.set("pagination_token", token);
      const res = await apiGet(`/tweets/${tweetId}/liking_users?${q.toString()}`);
      if (res.status === 403) {
        return { ok: true, mocked: true, detail: "API tier limited; allowed." };
      }
      if (!res.ok) {
        console.warn(`[twitter] like check got ${res.status}; allowing (inconclusive).`);
        return { ok: true, mocked: true, detail: "Check unavailable; allowed." };
      }
      const json = (await res.json()) as {
        data?: { id: string }[];
        meta?: { next_token?: string };
      };
      if (json.data?.some((u) => u.id === sourceUserId)) {
        return { ok: true, mocked: false, detail: "Liked" };
      }
      token = json.meta?.next_token;
      if (!token) break;
    }
    return { ok: false, mocked: false, detail: "Like not found" };
  } catch (e) {
    console.warn("[twitter] verifyLiked error; allowing:", e);
    return { ok: true, mocked: true, detail: "Check errored; allowed." };
  }
}

/** Verify that a user reposted (retweeted) a specific tweet. */
export async function verifyReposted(
  sourceUserId: string | null | undefined,
  tweetId: string
): Promise<TwitterCheckResult> {
  if (!integrations.twitter.apiLive) {
    return mock(`Mock: assumed repost of tweet ${tweetId}`);
  }
  if (!sourceUserId) {
    return { ok: false, mocked: false, detail: "No connected X account." };
  }
  try {
    let token: string | undefined;
    for (let page = 0; page < 5; page++) {
      const q = new URLSearchParams({ max_results: "100" });
      if (token) q.set("pagination_token", token);
      const res = await apiGet(`/tweets/${tweetId}/retweeted_by?${q.toString()}`);
      if (res.status === 403) {
        return { ok: true, mocked: true, detail: "API tier limited; allowed." };
      }
      if (!res.ok) {
        console.warn(`[twitter] repost check got ${res.status}; allowing (inconclusive).`);
        return { ok: true, mocked: true, detail: "Check unavailable; allowed." };
      }
      const json = (await res.json()) as {
        data?: { id: string }[];
        meta?: { next_token?: string };
      };
      if (json.data?.some((u) => u.id === sourceUserId)) {
        return { ok: true, mocked: false, detail: "Reposted" };
      }
      token = json.meta?.next_token;
      if (!token) break;
    }
    return { ok: false, mocked: false, detail: "Repost not found" };
  } catch (e) {
    console.warn("[twitter] verifyReposted error; allowing:", e);
    return { ok: true, mocked: true, detail: "Check errored; allowed." };
  }
}
