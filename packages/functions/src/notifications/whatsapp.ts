import twilio from "twilio";
import { defineSecret } from "firebase-functions/params";

// All Twilio config lives in Secret Manager (set via
// `firebase functions:secrets:set`) and is listed in the function's `secrets`
// option so it's injected at runtime.
export const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
export const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
// The WhatsApp-enabled sender number in E.164 form, e.g. +14155238886. Managed
// as a secret too so all three are configured the same way.
export const TWILIO_WHATSAPP_FROM = defineSecret("TWILIO_WHATSAPP_FROM");

/**
 * Send a freeform WhatsApp message via Twilio. `to` is an E.164 number; the
 * `whatsapp:` channel prefix is added here so callers pass plain numbers.
 */
export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const client = twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());
  await client.messages.create({
    from: `whatsapp:${TWILIO_WHATSAPP_FROM.value()}`,
    to: `whatsapp:${to}`,
    body,
  });
}
