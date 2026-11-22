export type Fact = {
  value: string[] | number | string | null;
  source: string;
  confidence: number;
  explicit: boolean;
};
export type Message = {
  origin?: string;
  id: string;
  customerId: string;
  direction: "incoming" | "outgoing";
  text: string;
  status: "received" | "pending" | "simulated" | "rejected";
  language: string;
  intent: string | null;
  createdAt: string;
  campaignId: string | null;
};
export type Change = {
  id: string;
  field: string;
  before: unknown;
  after: unknown;
  source: string;
  confidence: number;
  createdAt: string;
};
export type Purchase = {
  productId: string;
  name: string;
  price: number;
  date: string;
  campaignId?: string;
};
export type Customer = {
  id: string;
  name: string;
  phone: string;
  nickname: string;
  language: string;
  languageOverride: boolean;
  style: string;
  consent: boolean;
  takeover: boolean;
  profile: Record<string, Fact>;
  purchases: Purchase[];
  lastContacted: string | null;
  messages: Message[];
  changes: Change[];
};
export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  colors: string[];
  sizes: string[];
  stock: number;
  image: string;
  url: string;
  style: string;
};
export type Draft = {
  automaticReplyStatus?: "pending" | "processed" | "failed" | "skipped";
  id: string;
  customerId: string;
  text: string;
  productIds: string[];
  reasons: string[];
  status: "pending" | "approved" | "rejected" | "sent";
  sentAt: string | null;
};
export type Campaign = {
  id: string;
  name: string;
  createdAt: string;
  drafts: Draft[];
};
export type Connection = {
  status: "disconnected" | "connecting" | "syncing" | "connected";
  mode: "simulated";
  provider: "demo";
  deviceName: string;
  startedAt: string | null;
  connectedAt: string | null;
  syncedAt: string | null;
  contactsSynced: number;
  historiesSynced: number;
  importedContacts: number;
};
export type Workspace = {
  connection: Connection;
  retailer: {
    id: string;
    name: string;
    paused: boolean;
    tone: {
      style: string;
      greeting: string;
      confidence: number;
      source: string;
    };
  };
  customers: Customer[];
  products: Product[];
  campaigns: Campaign[];
  stats: {
    totalContacts: number;
    knownPreferences: number;
    campaignsCreated: number;
    messagesSent: number;
    interestedCustomers: number;
    convertedCustomers: number;
  };
  mode: {
    whatsapp: string;
    ai: string;
    aiStatus?: {
      enabled: boolean;
      model: string;
      successfulCalls: number;
      lastError: string | null;
    };
  };
};
export type Analysis = {
  language: string;
  confidence: number;
  intent: string;
  style: string;
  changes: string[];
};
