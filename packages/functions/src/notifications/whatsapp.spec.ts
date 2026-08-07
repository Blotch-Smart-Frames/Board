import { describe, expect, it, vi, beforeEach } from "vitest";

const clientState = {
  create: vi.fn(async () => ({ sid: "SM123" })),
};

vi.mock("twilio", () => ({
  default: vi.fn(() => ({ messages: { create: clientState.create } })),
}));

vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({
    name,
    value: () => `${name}-value`,
  }),
}));

beforeEach(() => {
  clientState.create.mockClear();
});

describe("sendWhatsApp", () => {
  it("addresses Twilio with the whatsapp: channel prefix and the configured sender", async () => {
    const { sendWhatsApp } = await import("./whatsapp");
    await sendWhatsApp("+15550001111", "hello");
    expect(clientState.create).toHaveBeenCalledWith({
      from: "whatsapp:TWILIO_WHATSAPP_FROM-value",
      to: "whatsapp:+15550001111",
      body: "hello",
    });
  });
});
