import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { resolve } from "node:path";
import { realpathSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import app from "../server/app.js";
import { db } from "../server/db.js";
import { seed } from "../prisma/seed.js";
import {
  detectLanguage,
  fact,
  interpret,
  recommend,
} from "../server/intelligence.js";
let server: Server;
let base: string;
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  status = 200,
) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  assert.equal(
    response.status,
    status,
    `${method} ${path}: ${JSON.stringify(result)}`,
  );
  return result;
}
before(async () => {
  // A separate DATABASE_URL is passed by the test command. Never reset the presenter's database.
  assert.ok(
    process.env.DATABASE_URL?.includes("factori-tests-"),
    "Run through npm test so fixture resets can only touch a temporary database.",
  );
  const files = await db.$queryRaw<
    { name: string; file: string }[]
  >`PRAGMA database_list`;
  assert.equal(
    realpathSync(resolve(files.find((f) => f.name === "main")!.file)),
    realpathSync(resolve(process.env.DATABASE_URL!.slice(5))),
    "Verify the actual SQLite connection before resetting any fixture data.",
  );
  await seed();
  await db.whatsAppConnection.create({
    data: {
      retailerId: "style-studio",
      status: "connected",
      connectedAt: new Date(),
    },
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
after(async () => {
  if (!server) {
    await db.$disconnect();
    return;
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
});

test("full Tanglish and Kanglish workflow persists memory and changes recommendations", async () => {
  let workspace = await request("/api/workspace");
  assert.equal(workspace.customers.length, 12);
  assert.equal(workspace.products.length, 16);
  assert.equal(workspace.stats.messagesSent, 0);
  assert.equal(workspace.retailer.tone.style, "Friendly");
  const campaign = await request(
    "/api/campaigns",
    "POST",
    { name: "Weekend edit", customerIds: ["ananya", "kiran"] },
    201,
  );
  const ananyaDraft = campaign.drafts.find(
    (d: any) => d.customerId === "ananya",
  );
  const kiranDraft = campaign.drafts.find((d: any) => d.customerId === "kiran");
  assert.match(ananyaDraft.text, /unga|Unga/);
  assert.match(kiranDraft.text, /Nimma/);
  assert.doesNotMatch(
    ananyaDraft.text + kiranDraft.text,
    /[\u0B80-\u0BFF\u0C80-\u0CFF]/,
  );
  assert.ok(kiranDraft.productIds.includes("shirt-oxford"));
  assert.equal(
    (await request(`/api/campaigns/${campaign.id}/send`, "POST")).sent,
    0,
  );
  await request(`/api/campaigns/${campaign.id}/approve`, "POST");
  const delivery = await request(`/api/campaigns/${campaign.id}/send`, "POST");
  assert.equal(delivery.sent, 2);
  assert.equal(delivery.automaticReplies, 2);
  const automatic = await request("/api/workspace");
  assert.ok(
    automatic.customers
      .find((c: any) => c.id === "ananya")
      .profile.preferred_colors.value.includes("Pastel"),
  );
  assert.equal(
    automatic.customers.find((c: any) => c.id === "kiran").profile.budget_max
      .value,
    700,
  );
  assert.equal(
    automatic.customers
      .find((c: any) => c.id === "kiran")
      .messages.filter((m: any) => m.direction === "incoming").length,
    2,
  );
  assert.equal(
    (await request(`/api/campaigns/${campaign.id}/send`, "POST")).sent,
    0,
  );
  const ananya = await request("/api/customers/ananya/incoming", "POST", {
    text: "Super ah irukku! Idhe maari konjam pastel colors la irukka?",
  });
  assert.equal(ananya.analysis.language, "Tamil");
  assert.equal(ananya.analysis.intent, "Interested");
  assert.ok(ananya.customer.profile.preferred_colors.value.includes("Pastel"));
  assert.equal(ananya.reply.status, "pending");
  assert.match(ananya.reply.text, /pastel/i);
  assert.doesNotMatch(ananya.reply.text, /^(Hey|Hello)\b/);
  assert.equal((ananya.reply.text.match(/https:\/\//g) || []).length, 1);
  const kiran = await request("/api/customers/kiran/incoming", "POST", {
    text: "Chennagide, aadre swalpa expensive ide. 700 olage enadru ideya?",
  });
  assert.equal(kiran.analysis.language, "Kannada");
  assert.equal(kiran.customer.profile.budget_max.value, 700);
  assert.match(kiran.reply.text, /₹590/);
  assert.match(kiran.reply.text, /₹700/);
  assert.doesNotMatch(kiran.reply.text, /^(Hey|Hello)\b/);
  assert.doesNotMatch(kiran.reply.text, /₹990|₹1,190/);
  workspace = await request("/api/workspace");
  const independentAnanya = workspace.customers.find(
    (c: any) => c.id === "ananya",
  );
  assert.equal(independentAnanya.profile.budget_max.value, 2000);
  assert.deepEqual(independentAnanya.profile.interests.value, ["Dresses"]);
  assert.deepEqual(kiran.customer.profile.preferred_colors.value, [
    "Black",
    "Blue",
  ]);
  const next = await request(
    "/api/campaigns",
    "POST",
    { name: "Updated picks", customerIds: ["ananya", "kiran"] },
    201,
  );
  const nextAnanya = next.drafts.find((d: any) => d.customerId === "ananya");
  assert.equal(nextAnanya.productIds.length, 2);
  assert.ok(
    nextAnanya.productIds.every((id: string) =>
      ["dress-lavender", "dress-sage", "dress-rose"].includes(id),
    ),
  );
  const nextKiran = next.drafts.find((d: any) => d.customerId === "kiran");
  assert.equal(nextKiran.productIds.length, 2);
  assert.ok(
    nextKiran.productIds.every((id: string) =>
      ["tee-blue", "tee-black", "tee-pastel"].includes(id),
    ),
  );
  const independentClient = new PrismaClient();
  const persisted = await independentClient.customer.findUniqueOrThrow({
    where: { id: "kiran" },
    include: { changes: true, messages: true },
  });
  assert.equal((persisted.profile as any).budget_max.value, 700);
  assert.ok(persisted.changes.length > 0);
  assert.ok(persisted.messages.some((m) => m.text.includes("700 olage")));
  await independentClient.$disconnect();
  await request("/api/customers/ananya/convert", "POST", {
    productId: ananyaDraft.productIds[0],
  });
  workspace = await request("/api/workspace");
  assert.equal(
    workspace.retailer.tone.style,
    "Friendly",
    "Generated messages must not feed back into retailer tone detection",
  );
  assert.equal(workspace.stats.messagesSent, 2);
  assert.equal(workspace.stats.interestedCustomers, 1);
  assert.equal(workspace.stats.convertedCustomers, 1);
});

test("manual correction, language override and low-confidence messages preserve control", async () => {
  await request("/api/customers/kiran", "PATCH", {
    language: "English",
    languageOverride: true,
    profile: { budget_max: 650 },
  });
  const result = await request("/api/customers/kiran/incoming", "POST", {
    text: "Idhu beda. Nanage formal wear beku.",
  });
  assert.equal(result.customer.language, "English");
  assert.deepEqual(result.customer.profile.interests.value, ["Formal wear"]);
  assert.equal(result.customer.profile.budget_max.value, 650);
  assert.match(result.reply.text, /Crisp White Formal Shirt/);
  const vague = await request("/api/customers/kiran/incoming", "POST", {
    text: "Okay",
  });
  assert.deepEqual(vague.analysis.changes, []);
  assert.match(vague.reply.text, /which colour, style or budget/);
  const auto = await request("/api/customers/kiran", "PATCH", {
    languageOverride: false,
  });
  assert.equal(auto.language, "Kannada");
  assert.equal(auto.languageOverride, false);
});

test("campaign validation, consent and unknown resource boundaries", async () => {
  await request("/api/campaigns", "POST", { name: "No", customerIds: [] }, 400);
  await request(
    "/api/campaigns",
    "POST",
    {
      name: "No",
      customerIds: Array.from({ length: 11 }, (_, i) => `customer${i}`),
    },
    400,
  );
  await request(
    "/api/campaigns",
    "POST",
    { name: "No", customerIds: ["ananya", "ananya"] },
    400,
  );
  await request(
    "/api/campaigns",
    "POST",
    { name: "No", customerIds: ["priya"] },
    409,
  );
  await request(
    "/api/campaigns",
    "POST",
    { name: "No", customerIds: ["unknown"] },
    404,
  );
  await request(
    "/api/customers/ananya",
    "PATCH",
    { profile: { budget_max: -1 } },
    400,
  );
  await request("/api/customers/ananya", "PATCH", { retailerId: "other" }, 400);
  await request("/api/customers/unknown", "PATCH", { nickname: "X" }, 404);
});

test("editing resets approval, pause and takeover block sends, repeated sends are idempotent", async () => {
  const c = await request(
    "/api/campaigns",
    "POST",
    { name: "Approval controls", customerIds: ["arjun"] },
    201,
  );
  await request(`/api/campaigns/${c.id}/approve`, "POST");
  const draft = await request(`/api/drafts/${c.drafts[0].id}`, "PATCH", {
    text: "Edited by retailer",
    status: "approved",
  });
  assert.equal(draft.status, "pending");
  assert.equal((await request(`/api/campaigns/${c.id}/send`, "POST")).sent, 0);
  await request(`/api/campaigns/${c.id}/approve`, "POST");
  await request("/api/retailer", "PATCH", { paused: true });
  await request(`/api/campaigns/${c.id}/send`, "POST", undefined, 409);
  await request("/api/retailer", "PATCH", { paused: false });
  await request("/api/customers/arjun", "PATCH", { takeover: true });
  await request(`/api/campaigns/${c.id}/send`, "POST", undefined, 409);
  const inbound = await request("/api/customers/arjun/incoming", "POST", {
    text: "Looking for blue please",
  });
  assert.equal(inbound.reply, null);
  await request("/api/customers/arjun", "PATCH", { takeover: false });
  const sends = await Promise.all([
    request(`/api/campaigns/${c.id}/send`, "POST"),
    request(`/api/campaigns/${c.id}/send`, "POST"),
  ]);
  assert.equal(sends[0].sent + sends[1].sent, 1);
  await request(
    `/api/drafts/${draft.id}`,
    "PATCH",
    { text: "Cannot change" },
    409,
  );
});

test("opt-out rejects unsent messages and suppresses future automation", async () => {
  const c = await request(
    "/api/campaigns",
    "POST",
    { name: "Consent check", customerIds: ["rahul"] },
    201,
  );
  await request(`/api/campaigns/${c.id}/approve`, "POST");
  const result = await request("/api/customers/rahul/incoming", "POST", {
    text: "Stop",
  });
  assert.equal(result.customer.consent, false);
  assert.equal(result.reply, null);
  assert.equal((await request(`/api/campaigns/${c.id}/send`, "POST")).sent, 0);
  await request(
    "/api/campaigns",
    "POST",
    { name: "No", customerIds: ["rahul"] },
    409,
  );
});

test("pending replies require separate approval, are immutable once sent, and respect consent", async () => {
  const incoming = await request("/api/customers/meera/incoming", "POST", {
    text: "Pastel dresses venum",
  });
  const edited = await request(`/api/messages/${incoming.reply.id}`, "PATCH", {
    text: "A human edited reply.",
  });
  assert.equal(edited.status, "pending");
  await request(
    `/api/messages/${edited.id}`,
    "PATCH",
    { text: "Edit and send", status: "simulated" },
    400,
  );
  await request(`/api/messages/${edited.id}`, "PATCH", { status: "simulated" });
  await request(
    `/api/messages/${edited.id}`,
    "PATCH",
    { status: "simulated" },
    409,
  );
  const next = await request("/api/customers/meera/incoming", "POST", {
    text: "Okay",
  });
  await request("/api/customers/meera", "PATCH", { consent: false });
  await request(
    `/api/messages/${next.reply.id}`,
    "PATCH",
    { status: "simulated" },
    409,
  );
});

test("forgetting and deleting history invalidates retained drafts", async () => {
  const c = await request(
    "/api/campaigns",
    "POST",
    { name: "Forget demo", customerIds: ["rohan"] },
    201,
  );
  await request(`/api/campaigns/${c.id}/approve`, "POST");
  await request("/api/customers/rohan/memory", "DELETE");
  let workspace = await request("/api/workspace");
  let rohan = workspace.customers.find((c: any) => c.id === "rohan");
  assert.deepEqual(rohan.profile, {});
  assert.equal((await request(`/api/campaigns/${c.id}/send`, "POST")).sent, 0);
  await request("/api/customers/rohan/incoming", "POST", {
    text: "I would like blue casual wear",
  });
  await request("/api/customers/rohan/history", "DELETE");
  workspace = await request("/api/workspace");
  rohan = workspace.customers.find((c: any) => c.id === "rohan");
  assert.deepEqual(rohan.messages, []);
  assert.deepEqual(rohan.changes, []);
  const deletion = await request("/api/customers/lakshmi/incoming", "POST", {
    text: "Delete my data",
  });
  assert.deepEqual(deletion.customer.profile, {});
  assert.equal(deletion.customer.consent, false);
  assert.equal(deletion.reply, null);
});

test("simple rules protect explicit preferences and strict product constraints", () => {
  assert.equal(
    detectLanguage("Super ah irukku! konjam pastel colors la irukka?").language,
    "Tamil",
  );
  assert.equal(
    detectLanguage("Idhu beda. Nanage formal wear beku.").language,
    "Kannada",
  );
  const profile = { purchase_intent: fact("Low", "Retailer correction") };
  assert.deepEqual(interpret("Super!", profile).updates, {});
  const product = {
    id: "p",
    name: "Blue tee",
    category: "Casual wear",
    description: "",
    price: 701,
    colors: ["Blue"],
    sizes: ["S"],
    stock: 1,
    style: "Casual",
    url: "",
    image: "",
  };
  const customer = {
    id: "c",
    name: "C",
    nickname: "C",
    language: "English",
    style: "Friendly",
    profile: {
      budget_max: fact(700, "Customer"),
      interests: fact(["Casual wear"], "Customer"),
    },
  };
  assert.equal(recommend(customer, [product]).length, 0);
  assert.equal(
    recommend(customer, [{ ...product, price: 500, stock: 0 }]).length,
    0,
  );
  assert.equal(
    recommend(
      {
        ...customer,
        profile: {
          ...customer.profile,
          disliked_items: fact(["Blue"], "Customer"),
        },
      },
      [{ ...product, price: 500 }],
    ).length,
    0,
  );
});

test("manual takeover lets the retailer write while automation is paused and still respects consent", async () => {
  await request(
    "/api/customers/vikram/manual",
    "POST",
    { text: "Hello from the retailer" },
    409,
  );
  await request("/api/customers/vikram", "PATCH", { takeover: true });
  await request("/api/retailer", "PATCH", { paused: true });
  const sent = await request(
    "/api/customers/vikram/manual",
    "POST",
    { text: "Please let me know which size you need." },
    201,
  );
  assert.equal(sent.origin, "manual");
  assert.equal(sent.status, "simulated");
  assert.equal(
    (await request("/api/workspace")).retailer.tone.style,
    "Respectful",
    "Human-written examples may update retailer tone",
  );
  await request("/api/customers/vikram", "PATCH", { consent: false });
  await request(
    "/api/customers/vikram/manual",
    "POST",
    { text: "Blocked by consent" },
    409,
  );
  await request("/api/retailer", "PATCH", { paused: false });
});

test("retailer-scoped lookups never return or mutate another retailer records", async () => {
  await db.retailer.create({
    data: { id: "other-retailer", name: "Other retailer" },
  });
  await db.customer.create({
    data: {
      id: "private-customer",
      retailerId: "other-retailer",
      name: "Private contact",
      phone: "+00 000",
      nickname: "Private",
      language: "English",
      style: "Concise",
      profile: {},
      purchases: [],
    },
  });
  const c = await db.campaign.create({
    data: {
      retailerId: "other-retailer",
      name: "Private campaign",
      drafts: {
        create: {
          customerId: "private-customer",
          text: "Private text",
          productIds: [],
          reasons: [],
        },
      },
    },
    include: { drafts: true },
  });
  const m = await db.message.create({
    data: {
      customerId: "private-customer",
      direction: "outgoing",
      text: "Private text",
      status: "pending",
      language: "English",
    },
  });
  const workspace = await request("/api/workspace");
  assert.ok(workspace.customers.every((v: any) => v.id !== "private-customer"));
  assert.ok(workspace.campaigns.every((v: any) => v.id !== c.id));
  await request(
    "/api/customers/private-customer",
    "PATCH",
    { nickname: "Leaked" },
    404,
  );
  await request(`/api/campaigns/${c.id}/send`, "POST", undefined, 404);
  await request(
    `/api/drafts/${c.drafts[0].id}`,
    "PATCH",
    { status: "approved" },
    404,
  );
  await request(`/api/messages/${m.id}`, "PATCH", { status: "simulated" }, 404);
  assert.equal(
    (await db.customer.findUniqueOrThrow({ where: { id: "private-customer" } }))
      .nickname,
    "Private",
  );
});

test("Gemini retries transient overload, canonicalizes colours and rejects invented evidence", async () => {
  const { analyzeReply } = await import("../server/adapters/gemini.js");
  const originalFetch = globalThis.fetch;
  const saved = {
    mode: process.env.AI_MODE,
    environment: process.env.NODE_ENV,
    key: process.env.GEMINI_API_KEY,
  };
  let calls = 0;
  process.env.AI_MODE = "live";
  process.env.NODE_ENV = "development";
  process.env.GEMINI_API_KEY = "test-only-placeholder";
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return new Response("{}", { status: 503 });
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  language: "Tamil",
                  confidence: 0.95,
                  style: "Friendly",
                  intent: "Preference shared",
                  preferences: [
                    {
                      field: "preferred_colors",
                      value: ["pastel colours"],
                      explicit: true,
                      confidence: 0.95,
                      evidence: "Pastel colours",
                    },
                    {
                      field: "budget_max",
                      value: 500,
                      explicit: true,
                      confidence: 0.99,
                      evidence: "500",
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    });
  };
  try {
    const result = await analyzeReply("Pastel colours venum", {
      id: "test",
      name: "Test",
      nickname: "Test",
      language: "Tamil",
      style: "Friendly",
      profile: { preferred_colors: fact(["Black"], "Customer") },
    });
    assert.equal(calls, 2);
    assert.deepEqual(result.updates.preferred_colors.value, [
      "Black",
      "Pastel",
    ]);
    assert.equal(result.updates.budget_max, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (saved.mode === undefined) delete process.env.AI_MODE;
    else process.env.AI_MODE = saved.mode;
    if (saved.environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved.environment;
    if (saved.key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = saved.key;
  }
});

test("WhatsApp demo pairing persists, syncs idempotently and blocks delivery after disconnect", async () => {
  const before = await request("/api/workspace");
  const kiranProfile = before.customers.find(
    (c: any) => c.id === "kiran",
  ).profile;
  const messageCount = await db.message.count({
    where: { customer: { retailerId: "style-studio" } },
  });
  assert.equal(
    (await request("/api/whatsapp/disconnect", "POST")).status,
    "disconnected",
  );
  const campaign = await request(
    "/api/campaigns",
    "POST",
    { name: "Disconnected guard", customerIds: ["ananya"] },
    201,
  );
  await request(`/api/campaigns/${campaign.id}/approve`, "POST");
  await request(`/api/campaigns/${campaign.id}/send`, "POST", undefined, 409);
  assert.equal(
    (await request("/api/whatsapp/connect", "POST")).status,
    "connecting",
  );
  assert.equal((await request("/api/whatsapp/connection")).mode, "simulated");
  await db.whatsAppConnection.update({
    where: { retailerId: "style-studio" },
    data: { startedAt: new Date(Date.now() - 1400) },
  });
  assert.equal((await request("/api/whatsapp/connection")).status, "syncing");
  await db.whatsAppConnection.update({
    where: { retailerId: "style-studio" },
    data: { startedAt: new Date(Date.now() - 4000) },
  });
  const connected = await request("/api/whatsapp/connection");
  assert.equal(connected.status, "connected");
  assert.equal(connected.contactsSynced, 12);
  assert.equal(connected.historiesSynced, 8);
  assert.equal(connected.importedContacts, 0);
  const independent = new PrismaClient();
  assert.equal(
    (
      await independent.whatsAppConnection.findUniqueOrThrow({
        where: { retailerId: "style-studio" },
      })
    ).status,
    "connected",
  );
  await independent.$disconnect();
  assert.deepEqual(
    (await request("/api/workspace")).customers.find(
      (c: any) => c.id === "kiran",
    ).profile,
    kiranProfile,
  );
  assert.equal(
    await db.message.count({
      where: { customer: { retailerId: "style-studio" } },
    }),
    messageCount,
  );
  await request("/api/whatsapp/disconnect", "POST");
  await request("/api/whatsapp/connect", "POST");
  await db.whatsAppConnection.update({
    where: { retailerId: "style-studio" },
    data: { startedAt: new Date(Date.now() - 4000) },
  });
  await request("/api/whatsapp/connection");
  assert.equal(
    await db.message.count({
      where: { customer: { retailerId: "style-studio" } },
    }),
    messageCount,
  );
});

test("zero-history introductions require permission, learn preferences, and record demo opt-in before recommendations", async () => {
  const contact = await request(
    "/api/customers",
    "POST",
    { name: "Asha Demo", phone: "+91 90000 99999", language: "English" },
    201,
  );
  assert.equal(contact.consent, false);
  assert.deepEqual(contact.profile, {});
  assert.deepEqual(contact.messages, []);
  const intro = await request(`/api/customers/${contact.id}/introduction`);
  assert.match(intro.text, /The Style Studio/);
  assert.match(intro.text, /Would you like/);
  assert.doesNotMatch(intro.text, /https?:|₹/);
  await request(
    `/api/customers/${contact.id}/introduction`,
    "POST",
    { text: intro.text, confirmedPermission: false },
    400,
  );
  assert.equal(
    await db.message.count({ where: { customerId: contact.id } }),
    0,
  );
  const result = await request(
    `/api/customers/${contact.id}/introduction`,
    "POST",
    { text: intro.text, confirmedPermission: true },
  );
  assert.equal(result.consentGranted, true);
  assert.equal(result.customer.consent, true);
  assert.equal(result.customer.profile.budget_max.value, 1000);
  assert.deepEqual(result.customer.profile.interests.value, ["Casual wear"]);
  assert.ok(
    result.customer.messages.some(
      (m: any) => m.direction === "incoming" && /Yes/.test(m.text),
    ),
  );
  assert.ok(
    result.customer.messages.some(
      (m: any) => m.direction === "outgoing" && m.status === "pending",
    ),
  );
  assert.ok(
    result.customer.changes.some(
      (c: any) =>
        c.field === "marketing_consent" &&
        c.source.includes("Simulated customer reply"),
    ),
  );
  await request(
    `/api/customers/${contact.id}/introduction`,
    "POST",
    { text: intro.text, confirmedPermission: true },
    409,
  );
  await request(
    "/api/customers",
    "POST",
    { name: "Duplicate", phone: "+919000099999", language: "English" },
    409,
  );
  await request(
    "/api/customers",
    "POST",
    { name: "Invalid", phone: "123", language: "English" },
    400,
  );
});
