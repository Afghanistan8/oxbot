import nodemailer from "nodemailer";

import { brand } from "@/lib/brand";
import { env, integrations } from "@/lib/env";

/**
 * Email integration.
 *
 * Live mode: sends via SMTP (nodemailer) when EMAIL_SERVER_HOST is configured.
 * Mock mode: prints the message (including any magic-link URL) to the server
 * console so local auth + notifications work with zero SMTP setup.
 */

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

let transporter: nodemailer.Transporter | null = null;

// Dev convenience: the most recent mock magic-link per recipient, so the
// sign-in form can offer a direct "open link" button instead of requiring
// access to the server's console output. Mock mode only — never populated
// (or read) when real SMTP is configured.
const lastMockMagicLinks = new Map<string, string>();

export function getLastMockMagicLink(to: string): string | null {
  return lastMockMagicLinks.get(to.trim().toLowerCase()) ?? null;
}

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_SERVER_HOST,
      port: Number(env.EMAIL_SERVER_PORT) || 587,
      secure: Number(env.EMAIL_SERVER_PORT) === 465,
      auth:
        env.EMAIL_SERVER_USER || env.EMAIL_SERVER_PASSWORD
          ? {
              user: env.EMAIL_SERVER_USER,
              pass: env.EMAIL_SERVER_PASSWORD,
            }
          : undefined,
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<void> {
  if (!integrations.email.live) {
    // Mock: log a clear, greppable block to the console.
    console.log(
      [
        "",
        "╭─────────────────────────────────────────────────────────────╮",
        `│  📧  [${brand.name} mock email]  (no SMTP configured)`,
        `│  To:      ${to}`,
        `│  Subject: ${subject}`,
        "│  ---",
        ...(text ?? stripHtml(html))
          .split("\n")
          .map((line) => `│  ${line}`),
        "╰─────────────────────────────────────────────────────────────╯",
        "",
      ].join("\n")
    );
    return;
  }

  await getTransporter().sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text: text ?? stripHtml(html),
  });
}

/**
 * Magic-link email used by the Auth.js Email provider. In mock mode the URL is
 * printed prominently so you can copy it into the browser.
 */
export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  const subject = `Sign in to ${brand.name}`;
  const html = magicLinkTemplate(url);

  if (!integrations.email.live) {
    lastMockMagicLinks.set(to.trim().toLowerCase(), url);
    console.log(
      [
        "",
        "🔗 ────────────────────────────────────────────────────────────",
        `   ${brand.name} sign-in link for ${to}:`,
        "",
        `   ${url}`,
        "",
        "   (Mock email mode — paste this URL into your browser to sign in.)",
        "────────────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
    return;
  }

  await sendEmail({ to, subject, html });
}

function magicLinkTemplate(url: string): string {
  return `
  <div style="background:#080807;padding:40px 0;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#131210;border:1px solid #2A2722;border-radius:20px;padding:36px;color:#fff;">
      <h1 style="margin:0 0 8px;font-size:22px;background:linear-gradient(135deg,#fff,#F3D77A);-webkit-background-clip:text;background-clip:text;color:transparent;">${brand.name}</h1>
      <p style="color:#B7AD92;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Click the button below to securely sign in. This link expires soon and can only be used once.
      </p>
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#D8A72A,#BA8B1F);color:#090506;text-decoration:none;padding:12px 28px;border-radius:12px;font-weight:600;font-size:14px;">
        Sign in to ${brand.name}
      </a>
      <p style="color:#7A7264;font-size:12px;margin:24px 0 0;line-height:1.6;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </div>`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
