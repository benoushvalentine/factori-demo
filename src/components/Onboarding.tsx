import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Globe,
  Hand,
  Info,
  LoaderCircle,
  MessageCircle,
  Plus,
  QrCode,
  Send,
  ShieldCheck,
  Smartphone,
  Unplug,
  Users,
} from "lucide-react";
import { api } from "../api";
import type { Connection, Customer, Workspace } from "../types";
import "../onboarding.css";
type Run = (fn: () => Promise<unknown>, success?: string) => Promise<boolean>;
const disconnected: Connection = {
  status: "disconnected",
  mode: "simulated",
  provider: "demo",
  deviceName: "Demo retailer device",
  startedAt: null,
  connectedAt: null,
  syncedAt: null,
  contactsSynced: 0,
  historiesSynced: 0,
  importedContacts: 0,
};
type Props = {
  data: Workspace;
  run: Run;
  busy: boolean;
  onChanged: () => Promise<Workspace>;
};
const dateTime = (time: string | null) =>
  time
    ? new Date(time).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not yet";
function DemoQr() {
  const size = 25;
  const finder = (x: number, y: number) => {
    for (const [left, top] of [
      [0, 0],
      [18, 0],
      [0, 18],
    ]) {
      const dx = x - left,
        dy = y - top;
      if (dx >= 0 && dy >= 0 && dx < 7 && dy < 7)
        return (
          dx === 0 ||
          dy === 0 ||
          dx === 6 ||
          dy === 6 ||
          (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
        );
    }
    return null;
  };
  return (
    <div
      className="demo-qr"
      role="img"
      aria-label="Illustrative QR-style pattern marked DEMO. Cannot pair WhatsApp."
    >
      <svg viewBox="-2 -2 29 29" aria-hidden="true">
        <rect x="-2" y="-2" width="29" height="29" fill="white" />
        {Array.from({ length: size * size }, (_, i) => {
          const x = i % size,
            y = Math.floor(i / size);
          const found = finder(x, y);
          const black = found ?? (x * 7 + y * 11 + x * y) % 9 < 4;
          return black ? (
            <rect key={i} x={x} y={y} width="1" height="1" fill="#264b35" />
          ) : null;
        })}
      </svg>
      <strong>DEMO</strong>
    </div>
  );
}
export function WhatsAppConnection({ data, run, busy, onChanged }: Props) {
  const [connection, setConnection] = useState<Connection>(
    data.connection || disconnected,
  );
  const [error, setError] = useState("");
  const refreshRef = useRef(onChanged);
  refreshRef.current = onChanged;
  useEffect(
    () => setConnection(data.connection || disconnected),
    [data.connection],
  );
  const progressing =
    connection.status === "connecting" || connection.status === "syncing";
  useEffect(() => {
    if (!progressing) return;
    let stopped = false,
      fetching = false;
    const poll = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const next = await api<Connection>("/whatsapp/connection");
        if (stopped) return;
        setConnection(next);
        setError("");
        if (next.status === "connected" || next.status === "disconnected")
          await refreshRef.current();
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error
              ? e.message
              : "Unable to check connection status.",
          );
      } finally {
        fetching = false;
      }
    };
    const interval = setInterval(() => void poll(), 600);
    void poll();
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [progressing]);
  const connect = () =>
    void run(async () => {
      setError("");
      setConnection(await api<Connection>("/whatsapp/connect", "POST"));
    }, "Simulated connection started.");
  const disconnect = () =>
    void run(async () => {
      setConnection(await api<Connection>("/whatsapp/disconnect", "POST"));
    }, "WhatsApp simulator disconnected.");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR MESSAGING CONNECTION</div>
          <h1>Connect the conversation.</h1>
          <p>
            A realistic connection flow, clearly separated from a real WhatsApp
            account.
          </p>
        </div>
        <span className="badge">Demo provider · Simulated delivery</span>
      </div>
      {error && (
        <div className="notice amber" role="alert">
          <Info size={18} />
          <span>{error}</span>
        </div>
      )}
      {connection.status === "connected" ? (
        <section className="panel onboarding-connected">
          <span className="onboarding-status-icon">
            <CheckCircle2 size={32} />
          </span>
          <div>
            <span className="badge green">Connected · Simulated</span>
            <h2>Your demo workspace is connected.</h2>
            <p>
              No WhatsApp account was paired. Campaigns and retailer replies are
              delivered only through the simulator.
            </p>
          </div>
          <div className="onboarding-sync-grid">
            <div>
              <Smartphone size={21} />
              <span>Demo device</span>
              <strong>{connection.deviceName}</strong>
            </div>
            <div>
              <Users size={21} />
              <span>Contacts synced</span>
              <strong>{connection.contactsSynced}</strong>
            </div>
            <div>
              <MessageCircle size={21} />
              <span>Conversation histories</span>
              <strong>{connection.historiesSynced}</strong>
            </div>
          </div>
          <div className="onboarding-connection-meta">
            <span>Connected {dateTime(connection.connectedAt)}</span>
            <span>Last sync {dateTime(connection.syncedAt)}</span>
            <span>
              {connection.importedContacts} contacts imported by demo sync
            </span>
          </div>
          <button className="button" disabled={busy} onClick={disconnect}>
            <Unplug size={17} />
            Disconnect simulator
          </button>
        </section>
      ) : (
        <div className="onboarding-connect-grid">
          <section className="panel qr-panel">
            <div className="onboarding-panel-title">
              <QrCode size={22} />
              <h2>Demo pairing preview</h2>
            </div>
            <DemoQr />
            <p className="qr-warning">
              Illustration only · cannot pair WhatsApp
            </p>
            <span className="badge amber">
              {connection.status === "disconnected"
                ? "Disconnected"
                : connection.status === "connecting"
                  ? "Connecting · Simulated"
                  : "Syncing · Simulated"}
            </span>
          </section>
          <section className="panel connection-instructions">
            <h2>Bring your customer context together.</h2>
            <p>
              With a real provider, the connection screen would show a scannable
              pairing QR. Here’s how that real-world flow works:
            </p>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <strong>Open WhatsApp on your phone</strong>
                  <p>Use the retailer’s WhatsApp account.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Go to Linked Devices</strong>
                  <p>Open Settings or the menu, then Linked Devices.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Choose Link a Device</strong>
                  <p>
                    A real provider’s QR would pair the account. This
                    illustration cannot be scanned to connect.
                  </p>
                </div>
              </li>
            </ol>
            <div className="notice">
              <ShieldCheck size={18} />
              <span>
                This demo uses a simulated provider. Press the button below to
                simulate connection and sync sample contacts and histories.
              </span>
            </div>
            <div
              className="onboarding-progress"
              role="status"
              aria-live="polite"
            >
              {progressing && (
                <>
                  <LoaderCircle className="spin" size={19} />
                  <span>
                    {connection.status === "connecting"
                      ? "Establishing the simulated device connection…"
                      : "Syncing demo contacts and conversation histories…"}
                  </span>
                </>
              )}
            </div>
            <button
              className="button primary"
              disabled={busy || progressing}
              onClick={connect}
            >
              {progressing ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Smartphone size={17} />
              )}{" "}
              {progressing ? "Connection in progress" : "Simulate Connection"}
            </button>
            {progressing && (
              <button
                className="text-button"
                disabled={busy}
                onClick={disconnect}
              >
                Cancel connection
              </button>
            )}
          </section>
        </div>
      )}
      <div className="demo-explainer">
        <Info size={18} />
        <span>
          Connection state is stored on the server and survives refresh.
          Reconnecting syncs fixtures without replacing learned customer
          preferences.
        </span>
      </div>
    </>
  );
}
export function FirstContact({
  data,
  run,
  busy,
  onConversation,
  onProfile,
}: {
  data: Workspace;
  run: Run;
  busy: boolean;
  onConversation: (id: string) => void;
  onProfile: (id: string) => void;
}) {
  const eligible = data.customers.filter((c) => c.messages.length === 0);
  const [selectedId, setSelectedId] = useState(
    () =>
      eligible.find((c) => /sneha|nithya/i.test(c.name))?.id ||
      eligible[0]?.id ||
      "",
  );
  const [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [language, setLanguage] = useState("English"),
    [introduction, setIntroduction] = useState(""),
    [permission, setPermission] = useState(false),
    [loading, setLoading] = useState(false),
    [introError, setIntroError] = useState(""),
    [result, setResult] = useState<{
      customer: Customer;
      consentGranted: boolean;
    } | null>(null);
  const selected = data.customers.find((c) => c.id === selectedId);
  const connected = data.connection?.status === "connected";
  useEffect(() => {
    setPermission(false);
    setResult(null);
    setIntroduction("");
    setIntroError("");
    if (!selectedId) return;
    let cancelled = false;
    setLoading(true);
    api<{ text: string }>(`/customers/${selectedId}/introduction`)
      .then((v) => {
        if (!cancelled) setIntroduction(v.text);
      })
      .catch((e) => {
        if (!cancelled) setIntroError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);
  const create = async () => {
    await run(async () => {
      const customer = await api<Customer>("/customers", "POST", {
        name: name.trim(),
        phone: phone.trim(),
        language,
      });
      setSelectedId(customer.id);
      setCreating(false);
      setName("");
      setPhone("");
    }, "Contact created without marketing consent or assumed preferences.");
  };
  const send = async () => {
    if (!selectedId) return;
    await run(
      async () =>
        setResult(
          await api<{ customer: Customer; consentGranted: boolean }>(
            `/customers/${selectedId}/introduction`,
            "POST",
            { text: introduction.trim(), confirmedPermission: true },
          ),
        ),
      "Introduction sent through the simulator. The fictional customer reply has been processed.",
    );
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FIRST CONVERSATION</div>
          <h1>Start with permission. Learn from there.</h1>
          <p>
            No history? Introduce the store, ask to help, and learn one real
            preference before recommending a product.
          </p>
        </div>
      </div>
      <div className="onboarding-journey">
        {[
          { icon: MessageCircle, text: "Introduce yourself" },
          { icon: Hand, text: "Ask permission" },
          { icon: Globe, text: "Learn a preference" },
          { icon: ShieldCheck, text: "Recommend from the catalogue" },
        ].map(({ icon: Icon, text }) => (
          <div key={text}>
            <Icon size={19} />
            <span>{text}</span>
          </div>
        ))}
      </div>
      <div className="first-contact-grid">
        <section className="panel first-contact-form">
          <h2>Who are you meeting?</h2>
          <p>
            Choose a customer without conversation history, or add someone new.
            New contacts start with no marketing consent and an empty preference
            profile.
          </p>
          <label className="field-label">
            Customer
            <select
              aria-label="Customer for first conversation"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={busy}
            >
              {!selectedId && <option value="">Choose a customer</option>}
              {[
                ...eligible,
                ...(selected && !eligible.some((c) => c.id === selected.id)
                  ? [selected]
                  : []),
              ].map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.language}
                </option>
              ))}
            </select>
          </label>
          {!eligible.length && !selected && (
            <p>No customers without history yet. Add a new contact below.</p>
          )}
          <button
            className="button"
            disabled={busy}
            onClick={() => setCreating(!creating)}
          >
            <Plus size={17} />
            {creating ? "Close new contact form" : "Create a new contact"}
          </button>
          {creating && (
            <form
              className="new-contact-form"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <label className="field-label">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={80}
                  autoComplete="name"
                />
              </label>
              <label className="field-label">
                Phone number (international format)
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  pattern="\+[1-9][0-9]{7,14}"
                  placeholder="+919876543210"
                  autoComplete="tel"
                  type="tel"
                />
                <small>Use + followed by country code and number.</small>
              </label>
              <label className="field-label">
                Initial language
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {["English", "Tamil", "Kannada"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <button
                className="button primary"
                disabled={
                  busy ||
                  !name.trim() ||
                  !/^\+[1-9][0-9]{7,14}$/.test(phone.trim())
                }
              >
                <Plus size={17} />
                Create contact
              </button>
            </form>
          )}
          <div className="notice">
            <ShieldCheck size={18} />
            <span>
              Permission to initiate contact and marketing consent are
              different. The checkbox authorises this introduction; marketing
              consent comes only from the fictional customer’s explicit demo
              reply.
            </span>
          </div>
        </section>
        <section className="panel first-contact-compose">
          <div className="onboarding-panel-title">
            <MessageCircle size={21} />
            <h2>A considerate first message</h2>
          </div>
          <span className="badge">Simulated customer & WhatsApp delivery</span>
          {introError && (
            <div className="notice amber" role="alert">
              <Info size={18} />
              <span>{introError}</span>
            </div>
          )}
          {result ? (
            <div className="introduction-result" role="status">
              <CheckCircle2 size={29} />
              <h3>
                {result.consentGranted
                  ? "The customer opted in — in this demo."
                  : "No marketing consent received."}
              </h3>
              <p>
                {result.consentGranted
                  ? "A fictional customer reply has been recorded, their stated preferences saved, and a retailer follow-up prepared for your review."
                  : "Promotional recommendations stay blocked. Open the conversation to review the fictional reply."}
              </p>
              {Object.entries(result.customer.profile || {})
                .filter(([key]) =>
                  [
                    "interests",
                    "preferred_colors",
                    "budget_max",
                    "preferred_style",
                  ].includes(key),
                )
                .map(([key, fact]) => (
                  <div className="introduction-fact" key={key}>
                    <span>{key.replaceAll("_", " ")}</span>
                    <strong>
                      {Array.isArray(fact.value)
                        ? fact.value.join(", ")
                        : String(fact.value ?? "Not stated")}
                    </strong>
                  </div>
                ))}
              <div className="button-group">
                <button
                  className="button primary"
                  onClick={() => onConversation(selectedId)}
                >
                  Continue conversation
                  <ChevronRight size={17} />
                </button>
                <button
                  className="button"
                  onClick={() => onProfile(selectedId)}
                >
                  Open intelligence
                </button>
              </div>
            </div>
          ) : (
            <>
              <label className="field-label">
                Introduction {selected ? `for ${selected.name}` : ""}
                {loading ? (
                  <span className="introduction-loading" role="status">
                    <LoaderCircle size={19} className="spin" />
                    Preparing the introduction…
                  </span>
                ) : (
                  <textarea
                    aria-label="Permission-first introduction"
                    value={introduction}
                    onChange={(e) => setIntroduction(e.target.value)}
                    rows={7}
                    maxLength={800}
                    disabled={busy || !selectedId}
                    placeholder="Choose or create a customer to prepare a permission-first introduction."
                  />
                )}
              </label>
              <p className="introduction-counter">
                {introduction.length}/800 characters · No product assumptions or
                claims of familiarity
              </p>
              <label className="permission-checkbox">
                <input
                  type="checkbox"
                  checked={permission}
                  onChange={(e) => setPermission(e.target.checked)}
                  disabled={busy || !selectedId}
                />
                <span>I have permission to start this conversation (demo)</span>
              </label>
              <button
                className="button primary"
                disabled={
                  busy ||
                  !connected ||
                  !permission ||
                  !introduction.trim() ||
                  !selectedId ||
                  loading
                }
                onClick={() => void send()}
              >
                <Send size={17} />
                Approve & send introduction (simulated)
              </button>
              {!connected && (
                <p className="connection-required">
                  Connect the WhatsApp simulator before sending this
                  introduction.
                </p>
              )}
              <p className="first-contact-disclosure">
                After sending, the system generates a fictional customer reply
                and processes any explicit opt-in and preferences. Review and
                approve the retailer’s follow-up in Conversations.
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
