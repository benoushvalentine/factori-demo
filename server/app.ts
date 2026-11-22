import { randomUUID } from "node:crypto";
import { connectionService } from "./services/connection.js";
import { introduction, hasDemoOptIn } from "./services/introduction.js";
import express from "express";
import {
  salesCustomerTurn,
  salesReceipt,
  geminiStatus,
  customerReply,
  analyzeReply,
  retailerReply,
  geminiEnabled,
} from "./adapters/gemini.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, RETAILER_ID, serializeDatabaseWrite } from "./db.js";
import { seed } from "../prisma/seed.js";
import { fact, simulatedAI as ai, simulatedWhatsApp } from "./intelligence.js";
import type { Profile, ProductData } from "./types.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const origin = req.headers.origin;
  const hostedOrigins = [
    process.env.PUBLIC_ORIGIN,
    process.env.RENDER_EXTERNAL_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : undefined,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return "";
      }
    });
  if (
    origin &&
    !/^http:\/\/(localhost|127\.0\.0\.1):(5173|3001)$/.test(origin) &&
    !hostedOrigins.includes(origin)
  ) {
    res.status(403).json({
      error: "Requests must originate from the configured app URL.",
    });
    return;
  }
  next();
});
// Serialize local demo writes so double-clicks, approvals and opt-outs cannot race a send.
let writeQueue = Promise.resolve();
app.use("/api", async (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  const before = writeQueue;
  let release!: () => void;
  writeQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await before;
  res.once("finish", release);
  res.once("close", release);
  next();
});
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const json = (v: unknown) => v as Prisma.InputJsonValue;
const customerInclude = {
  messages: { orderBy: { createdAt: "asc" as const } },
  changes: { orderBy: { createdAt: "desc" as const } },
};
async function customer(id: string) {
  const result = await db.customer.findFirst({
    where: { id, retailerId: RETAILER_ID },
    include: customerInclude,
  });
  if (!result) throw new HttpError(404, "Customer not found.");
  return result;
}
async function retailer() {
  const result = await db.retailer.findUnique({ where: { id: RETAILER_ID } });
  if (!result)
    throw new HttpError(
      503,
      "Demo database is not initialized. Run npm run db:setup.",
    );
  return result;
}
async function campaign(id: string) {
  const result = await db.campaign.findFirst({
    where: { id, retailerId: RETAILER_ID },
    include: { drafts: true },
  });
  if (!result) throw new HttpError(404, "Campaign not found.");
  return result;
}
async function tone() {
  // Infer the retailer voice from supplied historical examples, never recursively
  // from our own generated campaigns (which would make the detected tone drift).
  const historical = await db.message.findMany({
    where: {
      direction: "outgoing",
      status: "simulated",
      origin: { in: ["seed", "manual"] },
      customer: { retailerId: RETAILER_ID },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return ai.retailerTone(historical);
}
async function catalogue() {
  return db.product.findMany({
    where: { retailerId: RETAILER_ID },
  }) as unknown as Promise<ProductData[]>;
}
function checkSending(
  store: { paused: boolean },
  c: { consent: boolean; takeover: boolean },
) {
  if (store.paused)
    throw new HttpError(409, "Automation is paused. Resume it before sending.");
  if (!c.consent)
    throw new HttpError(
      409,
      "Customer has not consented to promotional messaging.",
    );
  if (c.takeover)
    throw new HttpError(
      409,
      "Manual takeover is active. Turn it off before sending an AI draft.",
    );
}
app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    mode: "local-demo",
    version: process.env.RENDER_GIT_COMMIT || "local",
  }),
);
app.get("/api/workspace", async (_req, res) => {
  const [store, customers, products, campaigns, detectedTone] =
    await Promise.all([
      retailer(),
      db.customer.findMany({
        where: { retailerId: RETAILER_ID },
        include: customerInclude,
        orderBy: { name: "asc" },
      }),
      catalogue(),
      db.campaign.findMany({
        where: { retailerId: RETAILER_ID },
        include: { drafts: true },
        orderBy: { createdAt: "desc" },
      }),
      tone(),
    ]);
  res.json({
    retailer: { ...store, tone: detectedTone },
    connection: await connectionService.state(RETAILER_ID),
    customers,
    products,
    campaigns,
    mode: {
      whatsapp: simulatedWhatsApp.mode,
      ai: geminiEnabled()
        ? geminiStatus().lastError
          ? "gemini-fallback"
          : "gemini"
        : "simulated",
      aiStatus: geminiStatus(),
    },
    stats: {
      totalContacts: customers.length,
      knownPreferences: customers.filter((c) =>
        Object.values(c.profile as Profile).some((f) =>
          Array.isArray(f.value)
            ? f.value.length > 0
            : f.value !== null && f.value !== "",
        ),
      ).length,
      campaignsCreated: campaigns.length,
      messagesSent: customers
        .flatMap((c) => c.messages)
        .filter((m) => m.status === "simulated" && m.origin !== "seed").length,
      interestedCustomers: customers.filter((c) =>
        c.messages.some((m) => m.intent === "Interested"),
      ).length,
      convertedCustomers: customers.filter((c) =>
        (c.purchases as { campaignId?: string }[]).some((p) => p.campaignId),
      ).length,
    },
  });
});
async function requireWhatsAppConnection() {
  if ((await connectionService.state(RETAILER_ID)).status !== "connected")
    throw new HttpError(
      409,
      "Connect the WhatsApp demo before sending messages.",
    );
}
app.get("/api/whatsapp/connection", async (_req, res) =>
  res.json(await connectionService.state(RETAILER_ID)),
);
app.post("/api/whatsapp/connect", async (_req, res) => {
  await retailer();
  res.json(await connectionService.connect(RETAILER_ID));
});
app.post("/api/whatsapp/disconnect", async (_req, res) =>
  res.json(await connectionService.disconnect(RETAILER_ID)),
);
app.post("/api/customers", async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(2).max(80),
      phone: z.string().trim().max(30),
      language: z.enum(["English", "Tamil", "Kannada"]).default("English"),
    })
    .strict()
    .parse(req.body);
  const phone = input.phone.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    throw new HttpError(
      400,
      "Use an international phone number, for example +919876543210.",
    );
  const existing = await db.customer.findMany({
    where: { retailerId: RETAILER_ID },
    select: { phone: true },
  });
  if (
    existing.some(
      (c) => c.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""),
    )
  )
    throw new HttpError(409, "This contact is already in your workspace.");
  const created = await serializeDatabaseWrite(() =>
    db.customer.create({
      data: {
        id: randomUUID(),
        retailerId: RETAILER_ID,
        name: input.name,
        nickname: input.name.split(" ")[0],
        phone,
        language: input.language,
        style: "Respectful",
        consent: false,
        profile: {},
        purchases: [],
      },
    }),
  );
  res.status(201).json(await customer(created.id));
});
app.get("/api/customers/:id/introduction", async (req, res) => {
  const c = await customer(req.params.id);
  res.json({ text: introduction(c, (await retailer()).name) });
});
app.post("/api/customers/:id/introduction", async (req, res) => {
  const { text } = z
    .object({
      text: z.string().trim().min(1).max(800),
      confirmedPermission: z.literal(true),
    })
    .strict()
    .parse(req.body);
  const c = await customer(req.params.id);
  if (c.messages.length)
    throw new HttpError(
      409,
      "An introduction already exists. Continue the conversation instead.",
    );
  if (/https?:\/\/|www\.|₹/i.test(text))
    throw new HttpError(
      400,
      "Start with an introduction and permission question, without product links or prices.",
    );
  await requireWhatsAppConnection();
  const delivery = await simulatedWhatsApp.deliver({ phone: c.phone, text });
  await serializeDatabaseWrite(() =>
    db.$transaction([
      db.message.create({
        data: {
          customerId: c.id,
          direction: "outgoing",
          text,
          status: delivery.status,
          language: c.language,
          origin: "first-contact",
        },
      }),
      db.customer.update({
        where: { id: c.id },
        data: { lastContacted: new Date() },
      }),
    ]),
  );
  const fallback =
    c.language === "Tamil"
      ? "Seri, anuppunga! Casual wear venum, budget 1000 kulla."
      : c.language === "Kannada"
        ? "Haudu, kalisi! Casual wear beku, budget 1000 olage."
        : "Yes, please! I am looking for casual wear under 1000 rupees.";
  const reply = await customerReply(
    c,
    [{ role: "retailer", text }],
    fallback,
    false,
    "introduction",
  );
  const consentGranted = hasDemoOptIn(reply);
  await serializeDatabaseWrite(() =>
    db.$transaction([
      db.customer.update({
        where: { id: c.id },
        data: { consent: consentGranted },
      }),
      db.preferenceChange.create({
        data: {
          customerId: c.id,
          field: "marketing_consent",
          before: c.consent,
          after: consentGranted,
          source: `Simulated customer reply: ${reply}`,
          confidence: 1,
        },
      }),
    ]),
  );
  await processIncoming(c.id, reply);
  res.json({ customer: await customer(c.id), consentGranted });
});
app.post("/api/campaigns", async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(1).max(100),
      customerIds: z.array(z.string()).min(1).max(10),
    })
    .strict()
    .parse(req.body);
  if (new Set(input.customerIds).size !== input.customerIds.length)
    throw new HttpError(400, "Select each customer only once.");
  const [customers, products, detectedTone] = await Promise.all([
    Promise.all(input.customerIds.map(customer)),
    catalogue(),
    tone(),
  ]);
  if (customers.some((c) => !c.consent))
    throw new HttpError(
      409,
      "Only customers with marketing consent can join a campaign.",
    );
  const created = await serializeDatabaseWrite(() =>
    db.campaign.create({
      data: {
        retailerId: RETAILER_ID,
        name: input.name,
        drafts: {
          create: customers.map((c) => {
            const recs = ai.recommend(c, products);
            return {
              customerId: c.id,
              text: ai.generateMessage(c, recs, detectedTone),
              productIds: recs.map((r) => r.product.id),
              reasons: recs.map(
                (r) => `${r.product.name}: ${r.reasons.join("; ")}`,
              ),
            };
          }),
        },
      },
      include: { drafts: true },
    }),
  );
  res.status(201).json(created);
});
app.patch("/api/drafts/:id", async (req, res) => {
  const input = z
    .object({
      text: z.string().trim().min(1).max(4000).optional(),
      status: z.enum(["pending", "approved", "rejected"]).optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0)
    .parse(req.body);
  const draft = await db.draft.findFirst({
    where: { id: req.params.id, campaign: { retailerId: RETAILER_ID } },
  });
  if (!draft) throw new HttpError(404, "Draft not found.");
  if (draft.status === "sent")
    throw new HttpError(409, "Sent messages cannot be edited.");
  const updated = await serializeDatabaseWrite(() =>
    db.draft.update({
      where: { id: draft.id },
      data: {
        ...input,
        status: input.text !== undefined ? "pending" : input.status,
      },
    }),
  );
  res.json(updated);
});
app.post("/api/campaigns/:id/approve", async (req, res) => {
  const c = await campaign(req.params.id);
  await serializeDatabaseWrite(() =>
    db.draft.updateMany({
      where: { campaignId: c.id, status: "pending" },
      data: { status: "approved" },
    }),
  );
  res.json(await campaign(c.id));
});
app.post("/api/campaigns/:id/send", async (req, res) => {
  const c = await campaign(req.params.id);
  const approved = c.drafts.filter((d) => d.status === "approved");
  const retryable = c.drafts.some(
    (d) =>
      d.status === "sent" &&
      ["pending", "failed"].includes(d.automaticReplyStatus),
  );
  if (!approved.length && !retryable && !req.body?.simulateToSale) {
    res.json({ sent: 0, automaticReplies: 0, automaticReplyFailures: 0 });
    return;
  }
  if (approved.length) await requireWhatsAppConnection();
  const store = await retailer(),
    products = await catalogue();
  const customers = await Promise.all(
    approved.map((d) => customer(d.customerId)),
  );
  for (const [i, draft] of approved.entries()) {
    const contact = customers[i];
    checkSending(store, contact);
    const budget = (contact.profile as Profile).budget_max?.value;
    for (const id of draft.productIds as string[]) {
      const p = products.find((p) => p.id === id);
      if (!p || p.stock < 1 || (typeof budget === "number" && p.price > budget))
        throw new HttpError(
          409,
          "A recommendation is no longer available or exceeds the current budget. Generate a new campaign.",
        );
    }
  }
  if (approved.length)
    await serializeDatabaseWrite(() =>
      db.$transaction(async (tx) => {
        for (const [i, draft] of approved.entries()) {
          const delivery = await simulatedWhatsApp.deliver({
            phone: customers[i].phone,
            text: draft.text,
          });
          await tx.message.create({
            data: {
              customerId: draft.customerId,
              text: draft.text,
              direction: "outgoing",
              status: delivery.status,
              language: customers[i].language,
              campaignId: c.id,
            },
          });
          await tx.draft.update({
            where: { id: draft.id },
            data: {
              status: "sent",
              sentAt: new Date(),
              automaticReplyStatus: "pending",
            },
          });
          await tx.customer.update({
            where: { id: draft.customerId },
            data: { lastContacted: new Date() },
          });
        }
      }),
    );
  if (req.body?.simulateToSale === true) {
    await startSalesSimulation(c.id);
    res.json({ sent: approved.length, simulationStarted: true });
    return;
  }
  try {
    const result = await processCampaignReplies(c.id);
    res.json({ sent: approved.length, ...result });
  } catch (error) {
    console.error(
      "Campaign reply processing unavailable",
      { campaignId: c.id },
      error,
    );
    res.json({
      sent: approved.length,
      automaticReplies: 0,
      warning:
        "Campaign messages were already sent. Customer reply processing is unavailable; use Retry customer replies without resending the campaign.",
    });
  }
});
// Bounded, persisted demo autopilot. Model calls run outside SQLite transactions.
const salesJobs = new Map<string, Promise<void>>();
const customerSalesJobs = new Map<string, Promise<void>>();
async function salesGuard(customerId: string) {
  const c = await customer(customerId);
  checkSending(await retailer(), c);
  // Read only: connection synchronisation may itself acquire the writer queue.
  const connection = await db.whatsAppConnection.findUnique({
    where: { retailerId: RETAILER_ID },
  });
  if (connection?.status !== "connected")
    throw new HttpError(409, "Connect the WhatsApp demo before continuing.");
  return c;
}
async function runSalesSimulation(draftId: string) {
  const draft = await db.draft.findUniqueOrThrow({ where: { id: draftId } });
  const campaignId = draft.campaignId;
  const setStatus = (
    salesSimulationStatus: string,
    salesSimulationTurn?: number,
  ) =>
    serializeDatabaseWrite(() =>
      db.draft.update({
        where: { id: draftId },
        data: {
          salesSimulationStatus,
          ...(salesSimulationTurn === undefined ? {} : { salesSimulationTurn }),
        },
      }),
    );
  const history = (c: Awaited<ReturnType<typeof customer>>) =>
    c.messages
      .filter((m) => m.status !== "pending" && m.status !== "rejected")
      .slice(-12)
      .map((m) => ({
        role: m.direction === "incoming" ? "customer" : "retailer",
        text: m.text,
      }));
  try {
    await salesGuard(draft.customerId);
    const alreadyPurchased = (await customer(draft.customerId)).purchases as {
      simulationId?: string;
    }[];
    if (alreadyPurchased.some((p) => p.simulationId === draftId)) {
      await setStatus("completed", 3);
      return;
    }
    const response = await db.message.findFirst({
      where: {
        customerId: draft.customerId,
        campaignId,
        direction: "incoming",
        createdAt: { gte: draft.sentAt! },
      },
    });
    if (!response) await automaticCustomerTurn(draft.customerId, campaignId);
    await serializeDatabaseWrite(() =>
      db.draft.update({
        where: { id: draftId },
        data: { automaticReplyStatus: "processed", salesSimulationTurn: 1 },
      }),
    );
    for (const stage of ["size", "purchase"] as const) {
      let c = await salesGuard(draft.customerId);
      if (
        stage === "size" &&
        (await db.message.findUnique({
          where: { id: `sales-size:${draftId}` },
        }))
      )
        continue;
      let recs = ai.recommend(c, await catalogue());
      if (!recs.length) {
        await setStatus("no_match");
        return;
      }
      // Only show a single actual offer, so customer confirmation cannot pick an unseen item.
      const pending = await db.message.findFirst({
        where: {
          customerId: c.id,
          campaignId,
          status: "pending",
          direction: "outgoing",
        },
        orderBy: { createdAt: "desc" },
      });
      if (pending)
        await serializeDatabaseWrite(async () => {
          const fresh = await salesGuard(c.id);
          await simulatedWhatsApp.deliver({
            phone: fresh.phone,
            text: pending.text,
          });
          await db.$transaction([
            db.message.update({
              where: { id: pending.id },
              data: { status: "simulated" },
            }),
            db.customer.update({
              where: { id: c.id },
              data: { lastContacted: new Date() },
            }),
          ]);
        });
      c = await salesGuard(c.id);
      recs = ai.recommend(c, await catalogue());
      const offered = recs.find((r) => pending?.text.includes(r.product.name));
      recs = offered ? [offered] : recs.slice(0, 1);
      const decision = await salesCustomerTurn(c, history(c), recs, stage);
      await salesGuard(c.id);
      const incomingId = `sales-${stage}:${draftId}`;
      if (!(await db.message.findUnique({ where: { id: incomingId } })))
        await processIncoming(
          c.id,
          decision.message,
          campaignId,
          stage === "size",
          incomingId,
        );
      await setStatus("running", stage === "size" ? 2 : 3);
      if (stage === "size") continue;
      c = await salesGuard(c.id);
      const chosen = ai
        .recommend(c, await catalogue())
        .find((r) => r.product.id === decision.productId)?.product;
      if (!decision.confirmed || !chosen) {
        await setStatus("declined");
        return;
      }
      const size = String((c.profile as Profile).preferred_size?.value || "");
      if (!(chosen.sizes as string[]).includes(size)) {
        await setStatus("no_match");
        return;
      }
      const receipt = await salesReceipt(c, chosen, size);
      await serializeDatabaseWrite(async () => {
        const fresh = await salesGuard(c.id);
        const valid = ai
          .recommend(fresh, await catalogue())
          .some((r) => r.product.id === chosen.id);
        if (!valid)
          throw new HttpError(
            409,
            "The product no longer matches this customer.",
          );
        await simulatedWhatsApp.deliver({ phone: fresh.phone, text: receipt });
        await db.$transaction(async (tx) => {
          const current = await tx.customer.findUniqueOrThrow({
            where: { id: c.id },
          });
          const purchases = current.purchases as { simulationId?: string }[];
          if (purchases.some((p) => p.simulationId === draftId)) return;
          const profile = current.profile as Profile;
          const value = `${chosen.name}, size ${size}, ₹${chosen.price} (simulated)`;
          await tx.customer.update({
            where: { id: c.id },
            data: {
              purchases: json([
                ...purchases,
                {
                  productId: chosen.id,
                  name: chosen.name,
                  price: chosen.price,
                  size,
                  date: new Date().toISOString(),
                  campaignId,
                  simulated: true,
                  simulationId: draftId,
                },
              ]),
              profile: json({
                ...profile,
                last_purchase: fact(
                  value,
                  "Simulated order confirmed in conversation",
                  true,
                  1,
                ),
              }),
              lastContacted: new Date(),
            },
          });
          await tx.preferenceChange.create({
            data: {
              customerId: c.id,
              field: "last_purchase",
              before: json(profile.last_purchase?.value ?? null),
              after: value,
              source: `Simulated customer confirmation: ${decision.message}`,
              confidence: 1,
            },
          });
          await tx.message.create({
            data: {
              id: `sales-receipt:${draftId}`,
              customerId: c.id,
              campaignId,
              direction: "outgoing",
              status: "simulated",
              language: c.language,
              text: receipt,
              intent: "Simulated sale",
            },
          });
          await tx.draft.update({
            where: { id: draftId },
            data: {
              salesSimulationStatus: "completed",
              salesSimulationTurn: 3,
            },
          });
        });
      });
    }
  } catch (error) {
    console.error("Sales simulation stopped", { draftId }, error);
    await setStatus(error instanceof HttpError ? "paused" : "failed").catch(
      () => {},
    );
  }
}
async function startSalesSimulation(campaignId: string) {
  const c = await campaign(campaignId);
  const drafts = c.drafts.filter(
    (d) =>
      d.status === "sent" &&
      !["completed", "no_match", "declined"].includes(d.salesSimulationStatus),
  );
  for (const draft of drafts) {
    if (salesJobs.has(draft.id)) continue;
    await salesGuard(draft.customerId);
    await serializeDatabaseWrite(() =>
      db.draft.update({
        where: { id: draft.id },
        data: { salesSimulationStatus: "running" },
      }),
    );
    const before = customerSalesJobs.get(draft.customerId) || Promise.resolve();
    const job = before.catch(() => {}).then(() => runSalesSimulation(draft.id));
    salesJobs.set(draft.id, job);
    customerSalesJobs.set(draft.customerId, job);
    void job.finally(() => {
      salesJobs.delete(draft.id);
      if (customerSalesJobs.get(draft.customerId) === job)
        customerSalesJobs.delete(draft.customerId);
    });
  }
}
export async function resumeSalesSimulations() {
  const drafts = await db.draft.findMany({
    where: {
      salesSimulationStatus: "running",
      campaign: { retailerId: RETAILER_ID },
    },
  });
  for (const id of new Set(drafts.map((d) => d.campaignId)))
    await startSalesSimulation(id).catch(console.error);
}
app.post("/api/campaigns/:id/simulate-sale", async (req, res) => {
  await startSalesSimulation(req.params.id);
  res.json({ simulationStarted: true });
});
const replyJobs = new Map<string, Promise<void>>();
async function processCampaignReplies(campaignId: string) {
  const pending = await db.draft.findMany({
    where: {
      campaignId,
      status: "sent",
      automaticReplyStatus: { in: ["pending", "failed"] },
      salesSimulationStatus: "not_started",
    },
  });
  const outcomes = await Promise.allSettled(
    pending.map(async (draft) => {
      let job = replyJobs.get(draft.id);
      if (!job) {
        job = (async () => {
          const contact = await customer(draft.customerId);
          if (!contact.consent) {
            await serializeDatabaseWrite(() =>
              db.draft.update({
                where: { id: draft.id },
                data: { automaticReplyStatus: "skipped" },
              }),
            );
            return;
          }
          // Legacy sent campaigns may already have a response. Recover failed jobs
          // without manufacturing duplicate incoming messages or preference changes.
          const response = await db.message.findFirst({
            where: {
              customerId: draft.customerId,
              direction: "incoming",
              createdAt: { gte: draft.sentAt! },
            },
          });
          if (!response)
            await automaticCustomerTurn(draft.customerId, campaignId);
          await serializeDatabaseWrite(() =>
            db.draft.update({
              where: { id: draft.id },
              data: { automaticReplyStatus: "processed" },
            }),
          );
        })();
        replyJobs.set(draft.id, job);
      }
      try {
        await job;
      } catch (error) {
        console.error(
          "Automatic customer reply failed",
          { campaignId, customerId: draft.customerId },
          error,
        );
        await serializeDatabaseWrite(() =>
          db.draft.update({
            where: { id: draft.id },
            data: { automaticReplyStatus: "failed" },
          }),
        ).catch((statusError) =>
          console.error("Reply status could not be saved", statusError),
        );
        throw error;
      } finally {
        if (replyJobs.get(draft.id) === job) replyJobs.delete(draft.id);
      }
    }),
  );
  const failed = outcomes.filter((r) => r.status === "rejected").length;
  return {
    automaticReplies: outcomes.length - failed,
    automaticReplyFailures: failed,
    ...(failed
      ? {
          warning: `Campaign messages were sent, but ${failed} customer reply update(s) failed. Use Retry customer replies; campaign messages will not be sent again.`,
        }
      : {}),
  };
}
async function automaticCustomerTurn(id: string, campaignId?: string) {
  const contact = await customer(id);
  const fallback =
    contact.id === "ananya"
      ? "Super ah irukku! Idhe maari konjam pastel colors la irukka?"
      : contact.id === "kiran"
        ? "Chennagide, aadre swalpa expensive ide. 700 olage enadru ideya?"
        : contact.language === "Tamil"
          ? "Super ah irukku! Pastel colors la irukka?"
          : contact.language === "Kannada"
            ? "Chennagide! Blue colour ideya?"
            : "These look nice. Do you have blue options?";
  const history = contact.messages.slice(-10).map((m) => ({
    role: m.direction === "incoming" ? "customer" : "retailer",
    text: m.text,
  }));
  const firstTurn = !contact.messages.some(
    (m) => m.direction === "incoming" && m.origin !== "seed",
  );
  const text = await customerReply(contact, history, fallback, firstTurn);
  await processIncoming(id, text, campaignId);
}
const profileInput = z
  .object({
    interests: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    preferred_colors: z
      .array(z.string().trim().min(1).max(40))
      .max(20)
      .optional(),
    budget_max: z.number().int().positive().max(10000000).nullable().optional(),
    preferred_style: z
      .array(z.string().trim().min(1).max(40))
      .max(20)
      .optional(),
    disliked_items: z
      .array(z.string().trim().min(1).max(60))
      .max(20)
      .optional(),
  })
  .strict();
app.patch("/api/customers/:id", async (req, res) => {
  const input = z
    .object({
      nickname: z.string().trim().min(1).max(60).optional(),
      language: z.enum(["Tamil", "Kannada", "English"]).optional(),
      languageOverride: z.boolean().optional(),
      consent: z.boolean().optional(),
      takeover: z.boolean().optional(),
      profile: profileInput.optional(),
    })
    .strict()
    .parse(req.body);
  const c = await customer(req.params.id);
  const p = { ...(c.profile as Profile) };
  const { profile: edits, ...rest } = input;
  // Switching back to automatic detection re-evaluates history, rather than keeping a manual value forever.
  if (rest.languageOverride === false) {
    const incoming = c.messages
      .filter((m) => m.direction === "incoming")
      .reverse();
    const detected = incoming
      .map((m) => ai.detectLanguage(m.text, c.language))
      .find((d) => d.confidence >= 0.7);
    rest.language = detected?.language ?? "English";
  }
  if (rest.language && rest.languageOverride === undefined)
    rest.languageOverride = true;
  const result = await serializeDatabaseWrite(() =>
    db.$transaction(async (tx) => {
      for (const [field, value] of Object.entries(edits ?? {})) {
        const previous = p[field]?.value ?? null;
        p[field] = fact(value!, "Retailer correction");
        await tx.preferenceChange.create({
          data: {
            customerId: c.id,
            field,
            before: json(previous),
            after: json(value),
            source: "Retailer correction",
            confidence: 1,
          },
        });
      }
      const updated = await tx.customer.update({
        where: { id: c.id },
        data: { ...rest, profile: json(p) },
      });
      // A saved consent change or correction invalidates unsent campaign recommendations and followups.
      if (edits || input.language || input.consent === false) {
        await tx.draft.updateMany({
          where: { customerId: c.id, status: { in: ["pending", "approved"] } },
          data: { status: "rejected" },
        });
        await tx.message.updateMany({
          where: { customerId: c.id, status: "pending" },
          data: { status: "rejected" },
        });
      }
      return updated;
    }),
  );
  res.json(result);
});
app.delete("/api/customers/:id/memory", async (req, res) => {
  const c = await customer(req.params.id);
  await serializeDatabaseWrite(() =>
    db.$transaction([
      db.preferenceChange.deleteMany({ where: { customerId: c.id } }),
      db.customer.update({
        where: { id: c.id },
        data: {
          profile: {},
          language: "English",
          languageOverride: false,
          style: "Concise",
        },
      }),
      db.draft.updateMany({
        where: { customerId: c.id, status: { in: ["pending", "approved"] } },
        data: { status: "rejected" },
      }),
      db.message.updateMany({
        where: { customerId: c.id, status: "pending" },
        data: { status: "rejected" },
      }),
    ]),
  );
  res.json({ ok: true });
});
app.delete("/api/customers/:id/history", async (req, res) => {
  const c = await customer(req.params.id);
  await serializeDatabaseWrite(() =>
    db.$transaction([
      db.preferenceChange.deleteMany({ where: { customerId: c.id } }),
      db.message.deleteMany({ where: { customerId: c.id } }),
      db.draft.deleteMany({ where: { customerId: c.id } }),
      db.customer.update({
        where: { id: c.id },
        data: {
          profile: {},
          purchases: [],
          lastContacted: null,
          language: "English",
          languageOverride: false,
          style: "Concise",
        },
      }),
    ]),
  );
  res.json({ ok: true });
});
app.post("/api/customers/:id/incoming", async (req, res) => {
  const { text } = z
    .object({ text: z.string().trim().min(1).max(4000) })
    .strict()
    .parse(req.body);
  res.json(await processIncoming(req.params.id, text));
});
async function processIncoming(
  customerId: string,
  text: string,
  campaignId?: string,
  generateReply = true,
  incomingId?: string,
) {
  const c = await customer(customerId),
    store = await retailer();
  const interpretation = await analyzeReply(text, c);
  // An order total is not a new maximum budget.
  if (
    incomingId?.startsWith("sales-purchase:") &&
    !/budget|within|under|maximum|olage|kulla/i.test(text)
  )
    delete interpretation.updates.budget_max;
  const detected = interpretation.detected;
  const language = c.languageOverride ? c.language : detected.language;
  const style = detected.confidence >= 0.7 ? interpretation.style : c.style;
  const changes = Object.entries(interpretation.updates).filter(
    ([key, f]) =>
      JSON.stringify(f.value) !==
      JSON.stringify((c.profile as Profile)[key]?.value),
  );
  const updatedProfile = {
    ...(c.profile as Profile),
    ...interpretation.updates,
  };
  const result = await serializeDatabaseWrite(() =>
    db.$transaction(async (tx) => {
      if (interpretation.deletion) {
        await tx.preferenceChange.deleteMany({ where: { customerId: c.id } });
        await tx.message.deleteMany({ where: { customerId: c.id } });
        await tx.draft.deleteMany({ where: { customerId: c.id } });
        const updated = await tx.customer.update({
          where: { id: c.id },
          data: {
            profile: {},
            purchases: [],
            consent: false,
            language: "English",
            languageOverride: false,
            style: "Concise",
            lastContacted: null,
          },
        });
        return { customer: updated, reply: null };
      }
      await tx.message.create({
        data: {
          ...(incomingId ? { id: incomingId } : {}),
          customerId: c.id,
          direction: "incoming",
          text,
          status: "received",
          language: detected.language,
          intent: interpretation.intent,
          campaignId,
        },
      });
      for (const [field, value] of changes)
        await tx.preferenceChange.create({
          data: {
            customerId: c.id,
            field,
            before: json((c.profile as Profile)[field]?.value ?? null),
            after: json(value.value),
            source: `Customer message: ${text}`,
            confidence: value.confidence,
          },
        });
      const updated = await tx.customer.update({
        where: { id: c.id },
        data: {
          profile: json(updatedProfile),
          language,
          style,
          ...(interpretation.optout ? { consent: false } : {}),
        },
      });
      // Incoming feedback makes old unapproved follow-ups obsolete. New information also invalidates old campaign drafts.
      await tx.message.updateMany({
        where: { customerId: c.id, status: "pending" },
        data: { status: "rejected" },
      });
      if (changes.length || interpretation.optout)
        await tx.draft.updateMany({
          where: { customerId: c.id, status: { in: ["pending", "approved"] } },
          data: { status: "rejected" },
        });
      return {
        customer: updated,
        reply: null as Awaited<ReturnType<typeof tx.message.create>> | null,
      };
    }),
  );
  if (
    generateReply &&
    !interpretation.deletion &&
    !interpretation.optout &&
    c.consent &&
    !c.takeover &&
    !store.paused
  ) {
    const recs = ai.recommend(result.customer, await catalogue());
    const fallbackReply =
      interpretation.intent === "Unclear"
        ? language === "Tamil"
          ? `Endha colour illa style venum nu konjam sollunga?`
          : language === "Kannada"
            ? `Yaava colour athava style beku antha heli?`
            : `Could you tell me which colour, style or budget you’d prefer?`
        : ai.generateFollowup(result.customer, recs, await tone(), {
            text,
            intent: interpretation.intent,
            budget:
              typeof interpretation.updates.budget_max?.value === "number"
                ? interpretation.updates.budget_max.value
                : undefined,
            category: Array.isArray(interpretation.updates.interests?.value)
              ? interpretation.updates.interests.value[0]
              : undefined,
          });
    const latest = await customer(c.id);
    const replyText = await retailerReply(
      result.customer,
      latest.messages
        .filter((m) => m.status !== "rejected")
        .slice(-10)
        .map((m) => ({
          role: m.direction === "incoming" ? "customer" : "retailer",
          text: m.text,
        })),
      recs,
      await tone(),
      fallbackReply,
    );
    result.reply = await serializeDatabaseWrite(() =>
      db.message.create({
        data: {
          customerId: c.id,
          direction: "outgoing",
          text: replyText,
          language,
          status: "pending",
          campaignId,
        },
      }),
    );
  }
  return {
    ...result,
    analysis: {
      language: detected.language,
      confidence: detected.confidence,
      intent: interpretation.intent,
      style,
      changes: interpretation.deletion
        ? ["Customer data deleted; consent withdrawn"]
        : changes.map(([field]) => field),
    },
  };
}

app.patch("/api/messages/:id", async (req, res) => {
  const input = z
    .object({
      text: z.string().trim().min(1).max(4000).optional(),
      status: z.enum(["simulated", "rejected"]).optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0)
    .parse(req.body);
  const message = await db.message.findFirst({
    where: { id: req.params.id, customer: { retailerId: RETAILER_ID } },
  });
  if (!message) throw new HttpError(404, "Message not found.");
  if (message.direction !== "outgoing" || message.status !== "pending")
    throw new HttpError(
      409,
      "Only pending outgoing replies can be edited or approved.",
    );
  if (input.text && input.status === "simulated")
    throw new HttpError(400, "Save edits before approving the reply.");
  if (input.status === "simulated") {
    await requireWhatsAppConnection();
    const c = await customer(message.customerId);
    checkSending(await retailer(), c);
    await simulatedWhatsApp.deliver({ phone: c.phone, text: message.text });
  }
  const result = await serializeDatabaseWrite(() =>
    db.$transaction(async (tx) => {
      const updated = await tx.message.update({
        where: { id: message.id },
        data: input,
      });
      if (input.status === "simulated")
        await tx.customer.update({
          where: { id: message.customerId },
          data: { lastContacted: new Date() },
        });
      return updated;
    }),
  );
  if (input.status === "simulated" && geminiEnabled())
    await automaticCustomerTurn(
      message.customerId,
      message.campaignId ?? undefined,
    );
  res.json(result);
});
app.post("/api/customers/:id/manual", async (req, res) => {
  const { text } = z
    .object({ text: z.string().trim().min(1).max(4000) })
    .strict()
    .parse(req.body);
  const c = await customer(req.params.id);
  if (!c.takeover)
    throw new HttpError(
      409,
      "Enable manual takeover before sending a retailer-written message.",
    );
  if (!c.consent)
    throw new HttpError(
      409,
      "Marketing consent is withdrawn. Sending is blocked in this demo.",
    );
  await requireWhatsAppConnection();
  const delivery = await simulatedWhatsApp.deliver({ phone: c.phone, text });
  const message = await serializeDatabaseWrite(() =>
    db.$transaction(async (tx) => {
      await tx.message.updateMany({
        where: { customerId: c.id, status: "pending" },
        data: { status: "rejected" },
      });
      await tx.customer.update({
        where: { id: c.id },
        data: { lastContacted: new Date() },
      });
      return tx.message.create({
        data: {
          customerId: c.id,
          direction: "outgoing",
          text,
          status: delivery.status,
          language: ai.detectLanguage(text, c.language).language,
          origin: "manual",
        },
      });
    }),
  );
  if (geminiEnabled()) await automaticCustomerTurn(c.id);
  res.status(201).json(message);
});
app.post("/api/customers/:id/convert", async (req, res) => {
  const { productId } = z
    .object({ productId: z.string() })
    .strict()
    .parse(req.body);
  const c = await customer(req.params.id);
  const p = await db.product.findFirst({
    where: { id: productId, retailerId: RETAILER_ID },
  });
  if (!p || !p.stock)
    throw new HttpError(400, "Select an available catalogue product.");
  const sentDraft = await db.draft.findFirst({
    where: {
      customerId: c.id,
      status: "sent",
      campaign: { retailerId: RETAILER_ID },
    },
    orderBy: { sentAt: "desc" },
  });
  const campaignId =
    sentDraft && (sentDraft.productIds as string[]).includes(productId)
      ? sentDraft.campaignId
      : null;
  const purchases = [
    ...(c.purchases as object[]),
    {
      productId: p.id,
      name: p.name,
      price: p.price,
      date: new Date().toISOString(),
      campaignId,
      simulated: true,
    },
  ];
  const updated = await serializeDatabaseWrite(() =>
    db.customer.update({
      where: { id: c.id },
      data: { purchases },
    }),
  );
  res.json(updated);
});
app.patch("/api/retailer", async (req, res) => {
  const input = z.object({ paused: z.boolean() }).strict().parse(req.body);
  res.json(
    await serializeDatabaseWrite(() =>
      db.retailer.update({ where: { id: RETAILER_ID }, data: input }),
    ),
  );
});
app.post("/api/reset", async (_req, res) => {
  await serializeDatabaseWrite(() => seed());
  res.json({ ok: true });
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "API route not found." }),
);
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: err.issues
          .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
          .join("; "),
      });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid JSON body." });
      return;
    }
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      err.status === 413
    ) {
      res.status(413).json({ error: "Request body is too large." });
      return;
    }
    console.error(err);
    res.status(500).json({
      error: "Unexpected server error. Please retry or reset the demo.",
    });
  },
);
export default app;
