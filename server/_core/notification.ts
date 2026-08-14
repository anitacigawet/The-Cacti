import { ENV } from "./env.js";

export type NotificationPayload = {
  title: string;
  content: string;
};

const RESEND_URL = "https://api.resend.com/emails";

/**
 * Send an alert/notification email to the owner.
 *
 * Uses Resend (https://resend.com) when `RESEND_API_KEY` and
 * `RESEND_FROM_EMAIL` are configured AND `OWNER_EMAIL` is set. Otherwise logs
 * to the console — useful for local dev and as a fallback.
 *
 * Returns `true` if the message was actually sent, `false` if it was logged
 * locally (or the send failed).
 */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  const apiKey = ENV.resendApiKey;
  const fromAddr = ENV.resendFromEmail;
  const toAddr = ENV.ownerEmail;

  if (!apiKey || !fromAddr || !toAddr) {
    console.log(`[Notification] ${payload.title}: ${payload.content}`);
    return false;
  }

  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [toAddr],
        subject: payload.title,
        text: payload.content,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(
        `[Notification] Resend send failed (${response.status}): ${errText}`
      );
      console.log(`[Notification] ${payload.title}: ${payload.content}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(
      `[Notification] Resend threw: ${err instanceof Error ? err.message : String(err)}`
    );
    console.log(`[Notification] ${payload.title}: ${payload.content}`);
    return false;
  }
}
