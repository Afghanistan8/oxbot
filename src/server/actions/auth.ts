"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/lib/auth";
import { integrations } from "@/lib/env";
import { getLastMockMagicLink } from "@/lib/integrations/email";

/**
 * Server actions for auth. Email sign-in uses the Nodemailer (magic-link)
 * provider; OAuth actions kick off the provider redirect.
 */

export type SignInState = {
  error?: string;
  sent?: boolean;
  email?: string;
  /** Mock-mode only: the freshly issued magic link, so the UI can offer a
   *  direct "continue" button instead of requiring server console access. */
  devMagicLink?: string;
};

export async function emailSignInAction(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Please enter a valid email address.", email };
  }

  try {
    // redirect:false so we can render our own "check your email" state.
    await signIn("nodemailer", { email, redirectTo: callbackUrl, redirect: false });
    const devMagicLink = integrations.email.live ? undefined : getLastMockMagicLink(email) ?? undefined;
    return { sent: true, email, devMagicLink };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Could not send sign-in link. Please try again.", email };
    }
    // Non-auth errors (e.g. redirect) must bubble up.
    throw err;
  }
}

export async function oauthSignInAction(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");
  if (provider !== "twitter" && provider !== "discord") return;
  await signIn(provider, { redirectTo: callbackUrl });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
