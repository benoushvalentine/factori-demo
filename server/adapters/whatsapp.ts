import { demoContacts, demoHistory } from "../demo-data.js";
import { fact } from "../services/memory.js";
import type { Profile } from "../types.js";
export type Delivery = {
  status: "simulated" | "delivered" | "queued";
  provider: string;
};
export type PairingPhase = "connecting" | "syncing" | "connected";
export type SyncedContact = {
  key: string;
  name: string;
  nickname: string;
  phone: string;
  language: string;
  style: string;
  consent: boolean;
  profile: Profile;
};
export interface WhatsAppAdapter {
  readonly mode: "simulated" | "live";
  readonly provider: string;
  readonly deviceName: string;
  beginPairing(retailerId: string): Promise<void>;
  pollPairing(retailerId: string, startedAt: Date): Promise<PairingPhase>;
  syncContacts(
    retailerId: string,
  ): Promise<{
    contacts: SyncedContact[];
    histories: {
      contactKey: string;
      direction: string;
      text: string;
      language: string;
    }[];
  }>;
  disconnect(retailerId: string): Promise<void>;
  deliver(input: { phone: string; text: string }): Promise<Delivery>;
}
// No WhatsApp requests occur. This adapter returns fixtures and simulated receipts.
// A real provider supplies its own authentication, connection polling and sync data.
export const simulatedWhatsApp: WhatsAppAdapter = {
  mode: "simulated",
  provider: "demo",
  deviceName: "The Style Studio · Demo device",
  async beginPairing() {},
  async pollPairing(_retailerId, startedAt) {
    const elapsed = Date.now() - startedAt.getTime();
    return elapsed < 1000
      ? "connecting"
      : elapsed < 2400
        ? "syncing"
        : "connected";
  },
  async syncContacts() {
    return {
      contacts: demoContacts.map(
        (
          [
            key,
            name,
            nickname,
            language,
            interests,
            colors,
            budget,
            styles,
            consent,
            style,
          ],
          i,
        ) => ({
          key,
          name,
          nickname,
          language,
          style,
          consent,
          phone: `+91 90000 ${String(10000 + i)}`,
          profile: {
            interests: fact([...interests], "Simulated WhatsApp history"),
            preferred_colors: fact([...colors], "Simulated WhatsApp history"),
            budget_max: fact(budget, "Simulated WhatsApp history"),
            preferred_style: fact([...styles], "Simulated WhatsApp history"),
            disliked_items: fact([], "Simulated WhatsApp history"),
          },
        }),
      ),
      histories: demoHistory.map(([contactKey, direction, text, language]) => ({
        contactKey,
        direction,
        text,
        language,
      })),
    };
  },
  async disconnect() {},
  async deliver({ phone, text }) {
    if (!phone || !text.trim())
      throw new Error("A recipient and message are required.");
    return { status: "simulated", provider: "demo" };
  },
};
