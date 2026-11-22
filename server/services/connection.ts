import { Prisma } from "@prisma/client";
import { db, serializeDatabaseWrite } from "../db.js";
import {
  simulatedWhatsApp,
  type WhatsAppAdapter,
} from "../adapters/whatsapp.js";
const digits = (phone: string) => phone.replace(/\D/g, "");
export class WhatsAppConnectionService {
  private refreshing = new Map<
    string,
    Promise<Awaited<ReturnType<typeof db.whatsAppConnection.findUniqueOrThrow>>>
  >();
  constructor(private readonly provider: WhatsAppAdapter) {}
  private view(
    record: Awaited<ReturnType<typeof db.whatsAppConnection.findUnique>>,
  ) {
    return {
      status: record?.status || "disconnected",
      mode: this.provider.mode,
      provider: this.provider.provider,
      deviceName: this.provider.deviceName,
      startedAt: record?.startedAt || null,
      connectedAt: record?.connectedAt || null,
      syncedAt: record?.syncedAt || null,
      contactsSynced: record?.contactsSynced || 0,
      historiesSynced: record?.historiesSynced || 0,
      importedContacts: record?.importedContacts || 0,
    };
  }
  async state(retailerId: string) {
    let record = await db.whatsAppConnection.findUnique({
      where: { retailerId },
    });
    if (
      record?.startedAt &&
      ["connecting", "syncing"].includes(record.status)
    ) {
      let pending = this.refreshing.get(retailerId);
      if (!pending) {
        pending = this.advance(retailerId, record.startedAt);
        this.refreshing.set(retailerId, pending);
      }
      try {
        record = await pending;
      } finally {
        this.refreshing.delete(retailerId);
      }
    }
    return this.view(record);
  }
  async connect(retailerId: string) {
    const existing = await db.whatsAppConnection.findUnique({
      where: { retailerId },
    });
    if (existing && existing.status !== "disconnected")
      return this.state(retailerId);
    await this.provider.beginPairing(retailerId);
    const data = {
      status: "connecting",
      startedAt: new Date(),
      connectedAt: null,
      syncedAt: null,
      contactsSynced: 0,
      historiesSynced: 0,
      importedContacts: 0,
    };
    return this.view(
      await serializeDatabaseWrite(() =>
        db.whatsAppConnection.upsert({
          where: { retailerId },
          create: { retailerId, ...data },
          update: data,
        }),
      ),
    );
  }
  async disconnect(retailerId: string) {
    await this.refreshing.get(retailerId);
    await this.provider.disconnect(retailerId);
    const data = { status: "disconnected", startedAt: null, connectedAt: null };
    return this.view(
      await serializeDatabaseWrite(() =>
        db.whatsAppConnection.upsert({
          where: { retailerId },
          create: { retailerId, ...data },
          update: data,
        }),
      ),
    );
  }
  private async advance(retailerId: string, startedAt: Date) {
    const status = await this.provider.pollPairing(retailerId, startedAt);
    if (status !== "connected")
      return serializeDatabaseWrite(() =>
        db.whatsAppConnection.update({
          where: { retailerId },
          data: { status },
        }),
      );
    const payload = await this.provider.syncContacts(retailerId);
    return serializeDatabaseWrite(() =>
      db.$transaction(async (tx) => {
        const existing = await tx.customer.findMany({ where: { retailerId } });
        const ids = new Map<string, string>();
        let importedContacts = 0;
        for (const contact of payload.contacts) {
          let customer = existing.find(
            (c) => digits(c.phone) === digits(contact.phone),
          );
          if (!customer) {
            customer = await tx.customer.create({
              data: {
                id: `${retailerId}:whatsapp:${contact.key}`,
                retailerId,
                name: contact.name,
                nickname: contact.nickname,
                phone: contact.phone,
                language: contact.language,
                style: contact.style,
                consent: contact.consent,
                profile: contact.profile as Prisma.InputJsonValue,
                purchases: [],
              },
            });
            importedContacts++;
          }
          ids.set(contact.key, customer.id);
        }
        for (const [index, message] of payload.histories.entries()) {
          const customerId = ids.get(message.contactKey);
          if (!customerId) continue;
          const found = await tx.message.findFirst({
            where: {
              customerId,
              text: message.text,
              direction: message.direction,
            },
          });
          if (!found)
            await tx.message.create({
              data: {
                customerId,
                direction: message.direction,
                text: message.text,
                language: message.language,
                status:
                  message.direction === "outgoing" ? "simulated" : "received",
                origin: "seed",
                createdAt: new Date(
                  Date.now() - (payload.histories.length - index) * 3600000,
                ),
              },
            });
        }
        return tx.whatsAppConnection.update({
          where: { retailerId },
          data: {
            status: "connected",
            connectedAt: new Date(),
            syncedAt: new Date(),
            contactsSynced: payload.contacts.length,
            historiesSynced: payload.histories.length,
            importedContacts,
          },
        });
      }),
    );
  }
}
export const connectionService = new WhatsAppConnectionService(
  simulatedWhatsApp,
);
