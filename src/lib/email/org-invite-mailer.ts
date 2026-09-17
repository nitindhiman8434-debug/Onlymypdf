import { escapeHtml, safeHttpUrl } from "@/lib/security/html";
import { logDevNote } from "@/lib/server/safe-log";

interface SendInviteResult {
  delivered: boolean;
  mode: "email" | "dev";
}

export async function sendOrganizationInviteEmail(input: {
  to: string;
  organizationName: string;
  acceptUrl: string;
  inviterEmail?: string;
}): Promise<SendInviteResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "OnlyMyPDF <onboarding@resend.dev>";
  const orgName = escapeHtml(input.organizationName);
  const inviter = input.inviterEmail ? escapeHtml(input.inviterEmail) : "";
  const acceptUrl = safeHttpUrl(input.acceptUrl);
  const acceptHref = escapeHtml(acceptUrl);

  const html = `
    <p>You have been invited to join <strong>${orgName}</strong> on OnlyMyPDF.</p>
    ${inviter ? `<p>Invited by: ${inviter}</p>` : ""}
    <p><a href="${acceptHref}" style="display:inline-block;padding:12px 20px;background:#DC2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Accept invitation</a></p>
    <p style="font-size:12px;color:#666;">Or copy this link: ${acceptHref}</p>
    <p style="font-size:12px;color:#666;">This invite expires in 7 days.</p>
  `;

  if (apiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [input.to],
        subject: `Join ${input.organizationName} on OnlyMyPDF`,
        html,
      }),
    });

    if (!response.ok) {
      throw new Error("Could not send invite email.");
    }

    return { delivered: true, mode: "email" };
  }

  if (process.env.NODE_ENV === "development") {
    logDevNote("org-invite", { mode: "dev" });
    return { delivered: false, mode: "dev" };
  }

  throw new Error(
    "Email service is not configured. Add RESEND_API_KEY to send team invites."
  );
}
