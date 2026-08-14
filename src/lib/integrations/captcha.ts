import { env, integrations } from "@/lib/env";

/**
 * CAPTCHA integration (reCAPTCHA v3 or hCaptcha).
 *
 * Live mode: verifies the client token server-side with the provider.
 * Mock mode: auto-passes so local entry flows work without CAPTCHA setup.
 */

export type CaptchaResult = { ok: boolean; mocked: boolean; detail?: string };

export async function verifyCaptcha(
  token: string | null | undefined
): Promise<CaptchaResult> {
  if (!integrations.captcha.live) {
    return { ok: true, mocked: true, detail: "Mock: CAPTCHA auto-passed." };
  }
  if (!token) {
    return { ok: false, mocked: false, detail: "Missing CAPTCHA token." };
  }

  try {
    if (integrations.captcha.provider === "hcaptcha") {
      const res = await fetch("https://api.hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: env.HCAPTCHA_SECRET_KEY,
          response: token,
        }),
        cache: "no-store",
      });
      const json = (await res.json()) as { success?: boolean };
      return { ok: Boolean(json.success), mocked: false };
    }

    // Default: Google reCAPTCHA v3
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.RECAPTCHA_SECRET_KEY,
        response: token,
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as { success?: boolean; score?: number };
    // v3 returns a score in [0,1]; require a modest threshold.
    const ok = Boolean(json.success) && (json.score ?? 1) >= 0.5;
    return { ok, mocked: false, detail: `score=${json.score ?? "n/a"}` };
  } catch (e) {
    console.warn("[captcha] verification error:", e);
    return { ok: false, mocked: false, detail: "Verification error." };
  }
}
