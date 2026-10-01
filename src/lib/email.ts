import "server-only";
import { headers } from "next/headers";

// Transactional email via Resend's HTTP API (plain fetch — no SDK dependency).
//
// Env:
//   RESEND_API_KEY  — required to actually send.
//   EMAIL_FROM      — optional; defaults to the Panelist sending address.
//   APP_URL         — the public origin used in emailed links (e.g.
//                     https://panelist.renownedcomic.com).
//
// Without RESEND_API_KEY nothing is sent: the message (including any sign-in
// code) is written to the server log instead. That keeps local dev working and
// means a deploy that lands before the key is set can't lock anyone out — the
// code is readable in the Railway logs.

const DEFAULT_FROM = "Panelist <howdy@panelist.renownedcomic.com>";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY is not set — not sending. Would have sent to ${message.to}:\n` +
        `Subject: ${message.subject}\n${message.text}`,
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend responded ${res.status}: ${detail}`);
  }
}

/**
 * The public origin for links in emails. Uses APP_URL when set. Outside
 * production it falls back to the request's own host for convenience; in
 * production it never trusts the Host header (a forged Host would put an
 * attacker's domain in the sign-in link), so it returns null and callers send a
 * code-only email instead.
 */
export async function appUrl(): Promise<string | null> {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || "http";
  return `${proto}://${host}`;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A minimal, client-safe email body: heading, paragraphs, optional button. */
export function renderEmail({
  heading,
  paragraphs,
  code,
  button,
  footer,
}: {
  heading: string;
  paragraphs: string[];
  code?: string;
  button?: { label: string; url: string };
  footer: string;
}): { html: string; text: string } {
  const p = (t: string) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#333">${escapeHtml(t)}</p>`;

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#fff;border-radius:14px;padding:28px">
<tr><td>
<p style="margin:0 0 18px;font-size:13px;font-weight:600;letter-spacing:.02em;color:#007aff">PANELIST</p>
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#000">${escapeHtml(heading)}</h1>
${paragraphs.map(p).join("\n")}
${code ? `<p style="margin:6px 0 18px;font-size:32px;font-weight:700;letter-spacing:.18em;color:#000;font-family:ui-monospace,Menlo,monospace">${escapeHtml(code)}</p>` : ""}
${button ? `<p style="margin:8px 0 20px"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#007aff;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px">${escapeHtml(button.label)}</a></p>` : ""}
<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#8e8e93">${escapeHtml(footer)}</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    heading,
    "",
    ...paragraphs,
    ...(code ? ["", code] : []),
    ...(button ? ["", `${button.label}: ${button.url}`] : []),
    "",
    footer,
  ].join("\n");

  return { html, text };
}
