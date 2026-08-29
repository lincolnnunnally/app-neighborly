import { getSql } from "@/lib/db";
import { uid } from "@/lib/utils";
import { resetEmailConfigured, sendTransactionalEmail } from "@/lib/mail";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}

/**
 * Better Auth calls this only when the email exists. Never throw — a throw
 * would 500 existing users and enumerate accounts against the 200 for missing
 * emails. Record the request on the ops desk so Lincoln can finish a reset
 * even when Resend is missing.
 */
export async function sendNeighborlyResetMail(opts: {
  email: string;
  name?: string;
  url: string;
}): Promise<void> {
  const emailed = await sendTransactionalEmail({
    to: opts.email,
    subject: "Reset your Neighborly password",
    html: `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;border:1px solid #e2e8f0">
<h1 style="font-size:20px;margin:0 0 8px">Reset your Neighborly password</h1>
<p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px">Hi ${esc(opts.name || "neighbor")}, we received a request to reset the password for this Neighborly account. This link expires in one hour.</p>
<a href="${esc(opts.url)}" style="display:inline-block;background:#c2410c;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">Set a new password</a>
<p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:22px 0 0">If you didn't request this, ignore this email — your password will not change. Neighborly is a United Under God community board. Questions: lincoln@unitedundergod.org</p>
</div></body></html>`,
  });

  const title = emailed.sent
    ? `Password reset emailed: ${opts.email}`
    : `Password reset requested (email not sent): ${opts.email}`;
  const body = emailed.sent
    ? `Reset email sent to ${opts.email}.`
    : [
        `Reset requested for ${opts.email}.`,
        `Email send failed: ${emailed.error || "not configured"}.`,
        `Owner fallback — send this one-hour link yourself: ${opts.url}`,
        resetEmailConfigured()
          ? ""
          : "RESEND_API_KEY is not on the Neighborly deployment.",
      ]
        .filter(Boolean)
        .join("\n");

  try {
    const sql = await getSql();
    const id = uid("iss");
    await sql`
      insert into ops_issues (id, title, body, source_app, status, created_by)
      values (
        ${id},
        ${title},
        ${body},
        'neighborly',
        'open',
        'system'
      )
    `;
  } catch (err) {
    console.error("[reset-mail] could not record ops issue", err);
  }

  if (!emailed.sent) {
    console.error("[reset-mail] password reset email not sent", emailed.error);
  }
}
