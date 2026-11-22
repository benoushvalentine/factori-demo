import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  LayoutDashboard,
  Users,
  BrainCircuit,
  Package,
  Megaphone,
  MessagesSquare,
  ChartNoAxesCombined,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCheck,
  Send,
  Sparkles,
  Globe,
  ArrowUpRight,
  RotateCcw,
  Pause,
  Play,
  Menu,
  X,
  Store,
  AlertCircle,
  LoaderCircle,
  ShieldCheck,
  Clock,
  MessageCircle,
  ShoppingBag,
  Pencil,
  Trash2,
  Eye,
  CheckCircle2,
  Ban,
  Hand,
  Info,
  Leaf,
  Activity,
} from "lucide-react";
import { api } from "./api";
import { FirstContact, WhatsAppConnection } from "./components/Onboarding";
import type {
  Workspace,
  Customer,
  Product,
  Campaign,
  Draft,
  Message,
  Fact,
} from "./types";
type Page =
  | "dashboard"
  | "contacts"
  | "intelligence"
  | "products"
  | "campaigns"
  | "conversations"
  | "analytics"
  | "first-contact"
  | "whatsapp";
type Run = (fn: () => Promise<unknown>, success?: string) => Promise<boolean>;
const pages: {
  id: Page;
  label: string;
  icon: typeof Users;
}[] = [
  {
    id: "dashboard",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    id: "contacts",
    label: "Contacts",
    icon: Users,
  },
  { id: "first-contact", label: "First conversation", icon: MessageCircle },
  { id: "whatsapp", label: "WhatsApp connection", icon: Globe },
  {
    id: "intelligence",
    label: "Customer intelligence",
    icon: BrainCircuit,
  },
  {
    id: "products",
    label: "Product catalogue",
    icon: Package,
  },
  {
    id: "campaigns",
    label: "Campaigns",
    icon: Megaphone,
  },
  {
    id: "conversations",
    label: "Conversations",
    icon: MessagesSquare,
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: ChartNoAxesCombined,
  },
];
const money = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
const date = (v: string | null, short = false) =>
  v
    ? new Date(v).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        ...(short
          ? {}
          : {
              year: "numeric",
            }),
      })
    : "Not contacted yet";
const time = (v: string) =>
  new Date(v).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
const value = (v: unknown): string =>
  v === null || v === undefined
    ? "Not set"
    : Array.isArray(v)
      ? v.join(", ")
      : typeof v === "object" && v !== null && "value" in v
        ? value((v as Fact).value)
        : String(v);
const labels: Record<string, string> = {
  interests: "Interests",
  preferred_colors: "Colours",
  budget_max: "Maximum budget",
  preferred_style: "Style",
  disliked_items: "Avoid",
  purchase_intent: "Purchase intent",
  preferred_size: "Size",
  communication_style: "Communication style",
  preferred_language: "Language",
};
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span
      className={`avatar ${small ? "small" : ""} color-${name.charCodeAt(0) % 5}`}
    >
      {initials(name)}
    </span>
  );
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "neutral" | "blue" | "red";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({
  icon: Icon = Package,
  title,
  children,
  action,
}: {
  icon?: typeof Users;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function SectionHead({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const fallback = product.category.toLowerCase().includes("dress")
    ? "/assets/dress.svg"
    : product.category.toLowerCase().includes("formal")
      ? "/assets/trousers.svg"
      : "/assets/shirt.svg";
  return (
    <img
      className={`product-image ${className}`}
      src={product.image || fallback}
      alt={product.name}
      onError={(e) => {
        if (!e.currentTarget.src.endsWith(fallback))
          e.currentTarget.src = fallback;
      }}
    />
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab" && ref.current) {
        const els = ref.current.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,[tabindex="0"]',
        );
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export default function App() {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState<{
      text: string;
      error: boolean;
    } | null>(null);
  const [page, setPage] = useState<Page>(() => {
      const p = location.hash.slice(1) as Page;
      return pages.some((x) => x.id === p) ? p : "whatsapp";
    }),
    [mobile, setMobile] = useState(false),
    [customerId, setCustomerId] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [campaignId, setCampaignId] = useState("");
  const refresh = useCallback(async () => {
    const next = await api<Workspace>("/workspace");
    setData(next);
    setError("");
    return next;
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    const listener = () => {
      const p = location.hash.slice(1) as Page;
      if (pages.some((x) => x.id === p)) setPage(p);
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  const previousConnection = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!data) return;
    const status = data.connection?.status || "disconnected";
    const previous = previousConnection.current;
    previousConnection.current = status;
    const completed =
      previous !== undefined &&
      previous !== "connected" &&
      status === "connected";
    const target =
      status !== "connected"
        ? "whatsapp"
        : completed || !location.hash
          ? "dashboard"
          : null;
    if (target && target !== page) {
      setPage(target);
      location.hash = target;
      setMobile(false);
      window.scrollTo({ top: 0 });
    }
    if (completed)
      setToast({
        text: "WhatsApp demo connected. Contacts synced — your dashboard is ready.",
        error: false,
      });
  }, [data, page]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const nav = (next: Page) => {
    setPage(next);
    location.hash = next;
    setMobile(false);
    window.scrollTo({
      top: 0,
    });
  };
  const run: Run = async (fn, success) => {
    setBusy(true);
    try {
      const outcome = await fn();
      await refresh();
      const warning =
        outcome &&
        typeof outcome === "object" &&
        "warning" in outcome &&
        typeof outcome.warning === "string"
          ? outcome.warning
          : null;
      if (warning) setToast({ text: warning, error: true });
      else if (success)
        setToast({
          text: success,
          error: false,
        });
      return true;
    } catch (e) {
      setToast({
        text:
          e instanceof Error ? e.message : "Unable to complete this action.",
        error: true,
      });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const openCustomer = (id: string) => {
    setCustomerId(id);
    nav("intelligence");
  };
  const showConversation = (id: string) => {
    setCustomerId(id);
    nav("conversations");
  };
  const startCampaign = (ids: string[] = []) => {
    setSelected(ids);
    setCampaignId("");
    nav("campaigns");
  };
  const activeCustomer =
    data?.customers.find((c) => c.id === customerId) || data?.customers[0];
  const reset = () => {
    if (
      confirm(
        "Reset the demo? Campaigns, conversations, preferences and purchases will return to the original sample data.",
      )
    )
      void run(async () => {
        await api("/reset", "POST");
        setCampaignId("");
        setSelected([]);
        setCustomerId("");
        nav("whatsapp");
      }, "Demo restored. Ready for your next walkthrough.");
  };
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-backdrop" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <a
          className="brand"
          href="#dashboard"
          onClick={() => nav("dashboard")}
          aria-label="Factori home"
        >
          <img src="/assets/favicon.svg" alt="" />
          <span>
            factori<span className="brand-period">.</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="store-icon">
            <Store size={20} />
          </span>
          <div>
            <strong>{data?.retailer.name || "The Style Studio"}</strong>
            <span>Retailer workspace</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {pages.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => nav(id)}
              disabled={Boolean(
                data &&
                  data.connection?.status !== "connected" &&
                  id !== "whatsapp",
              )}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "conversations" &&
                data &&
                data.customers.some((c) =>
                  c.messages.some((m) => m.status === "pending"),
                ) && (
                  <span className="nav-count">
                    {data.customers.reduce(
                      (s, c) =>
                        s +
                        c.messages.filter((m) => m.status === "pending").length,
                      0,
                    )}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-note">
            <span className="demo-note-icon">
              <Sparkles size={17} />
            </span>
            <strong>Built for better connections.</strong>
            <p>Your customer's next favourite is already in your catalogue.</p>
          </div>
          <button
            className="reset-button"
            onClick={reset}
            disabled={busy || !data}
          >
            <RotateCcw size={16} />
            Reset demo workspace
          </button>
          <div className="sidebar-user">
            <Avatar name="The Style Studio" small />
            <div>
              <strong>Demo retailer</strong>
              <span>Local workspace</span>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{pages.find((x) => x.id === page)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span
              className="demo-status"
              role="status"
              aria-label={
                data?.mode.ai.startsWith("gemini")
                  ? "Gemini chat enabled; WhatsApp delivery simulated"
                  : "Simulated AI and WhatsApp"
              }
            >
              <span />
              <span className="demo-status-label">
                {data?.mode.ai.startsWith("gemini")
                  ? "Gemini chat"
                  : "Simulated demo"}
              </span>
              <span className="demo-status-detail">
                {data?.mode.ai.startsWith("gemini")
                  ? "· WhatsApp demo"
                  : "· AI & WhatsApp"}
              </span>
            </span>
            <Avatar name="The Style Studio" small />
          </div>
        </header>
        <main id="main-content">
          {data?.mode.ai === "gemini-fallback" && (
            <div className="notice amber" role="status">
              <AlertCircle size={18} />
              <span>
                Gemini is temporarily unavailable. Rule-based replies are
                keeping the demo running. {data.mode.aiStatus?.lastError}
              </span>
            </div>
          )}
          {!data ? (
            <div className="initial-state">
              {error ? (
                <>
                  <AlertCircle size={32} />
                  <h2>We couldn’t load your workspace</h2>
                  <p>{error}</p>
                  <button
                    className="button primary"
                    onClick={() => {
                      setError("");
                      void refresh().catch((e) => setError(e.message));
                    }}
                  >
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <LoaderCircle className="spin" size={30} />
                  <h2>Opening your workspace</h2>
                  <p>Loading customers, catalogue and conversations…</p>
                </>
              )}
            </div>
          ) : (
            <>
              {data.connection?.status !== "connected" && (
                <div className="connection-banner" role="status">
                  <Globe size={19} />
                  <span>
                    <strong>WhatsApp simulator is not connected.</strong>{" "}
                    Explore the workspace, then connect to send simulated
                    messages.
                  </span>
                  <button className="button" onClick={() => nav("whatsapp")}>
                    Connect WhatsApp
                  </button>
                </div>
              )}
              {page === "whatsapp" && (
                <WhatsAppConnection
                  data={data}
                  run={run}
                  busy={busy}
                  onChanged={refresh}
                />
              )}
              {page === "first-contact" && (
                <FirstContact
                  data={data}
                  run={run}
                  busy={busy}
                  onConversation={showConversation}
                  onProfile={openCustomer}
                />
              )}
              {data.retailer.paused && (
                <div className="notice amber">
                  <Pause size={18} />
                  <span>
                    Automation is paused. You can review drafts and explore
                    data. Resume to send AI drafts. Retailer-written replies
                    remain available during manual takeover.
                  </span>
                  <button
                    onClick={() =>
                      void run(
                        () =>
                          api("/retailer", "PATCH", {
                            paused: false,
                          }),
                        "Automation resumed.",
                      )
                    }
                    disabled={busy}
                  >
                    Resume
                  </button>
                </div>
              )}
              {page === "dashboard" && (
                <Dashboard
                  data={data}
                  nav={nav}
                  startCampaign={startCampaign}
                  openCustomer={openCustomer}
                  openCampaign={(id) => {
                    setCampaignId(id);
                    nav("campaigns");
                  }}
                />
              )}
              {page === "contacts" && (
                <Contacts
                  data={data}
                  selected={selected}
                  setSelected={setSelected}
                  openCustomer={openCustomer}
                  startCampaign={startCampaign}
                  onNewConversation={() => nav("first-contact")}
                />
              )}
              {page === "intelligence" && activeCustomer && (
                <Intelligence
                  data={data}
                  customer={activeCustomer}
                  setCustomerId={setCustomerId}
                  run={run}
                  busy={busy}
                  showConversation={showConversation}
                  startCampaign={startCampaign}
                />
              )}
              {page === "products" && <Products data={data} />}
              {page === "campaigns" && (
                <Campaigns
                  data={data}
                  selected={selected}
                  setSelected={setSelected}
                  campaignId={campaignId}
                  setCampaignId={setCampaignId}
                  run={run}
                  busy={busy}
                  showConversation={showConversation}
                />
              )}
              {page === "conversations" && activeCustomer && (
                <Conversations
                  data={data}
                  customer={activeCustomer}
                  setCustomerId={setCustomerId}
                  run={run}
                  busy={busy}
                  openCustomer={openCustomer}
                />
              )}
              {page === "analytics" && (
                <Analytics data={data} startCampaign={startCampaign} />
              )}
            </>
          )}
        </main>
        <footer className="main-footer">
          <span>Factori Commerce Intelligence</span>
          <span>
            <ShieldCheck size={13} />
            Local demo · No real messages are sent
          </span>
        </footer>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="working-indicator" role="status">
          <LoaderCircle size={14} className="spin" />
          Saving changes…
        </div>
      )}
    </div>
  );
}
function Dashboard({
  data,
  nav,
  startCampaign,
  openCustomer,
  openCampaign,
}: {
  data: Workspace;
  nav: (p: Page) => void;
  startCampaign: (ids?: string[]) => void;
  openCustomer: (id: string) => void;
  openCampaign: (id: string) => void;
}) {
  const { stats, customers, campaigns } = data;
  const known = stats.totalContacts
    ? Math.round((stats.knownPreferences / stats.totalContacts) * 100)
    : 0;
  const featured = customers.filter((c) => /ananya|kiran/i.test(c.name));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR STORE, AT A GLANCE</div>
          <h1>A little insight. A better connection.</h1>
          <p>
            Turn what you know about your customers into their next favourite
            find.
          </p>
        </div>
        <button className="button primary" onClick={() => startCampaign()}>
          <Plus size={18} />
          Create campaign
        </button>
      </div>
      <div className="overview-stats">
        {[
          {
            label: "Total contacts",
            v: stats.totalContacts,
            sub: "Your customer community",
            icon: Users,
          },
          {
            label: "Known preferences",
            v: stats.knownPreferences,
            sub: `${known}% of your contacts`,
            icon: BrainCircuit,
          },
          {
            label: "Messages sent",
            v: stats.messagesSent,
            sub: "Simulated, with your approval",
            icon: MessagesSquare,
          },
          {
            label: "Interested customers",
            v: stats.interestedCustomers,
            sub: "Interest detected in replies",
            icon: ShoppingBag,
          },
        ].map(({ label, v, sub, icon: Icon }) => (
          <div className="stat" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{v.toString().padStart(2, "0")}</strong>
            <span className="stat-caption">{sub}</span>
          </div>
        ))}
      </div>
      <div className="overview-secondary-stats">
        <span>
          <Megaphone size={17} />
          <strong>{stats.campaignsCreated}</strong> campaigns created
        </span>
        <span>
          <ShoppingBag size={17} />
          <strong>{stats.convertedCustomers}</strong> converted customers
        </span>
        <button className="text-button" onClick={() => nav("analytics")}>
          View campaign analytics
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="onboarding-entry-grid">
        <button
          className="onboarding-entry"
          onClick={() => nav("first-contact")}
        >
          <MessageCircle size={23} />
          <div>
            <strong>Meeting a new customer?</strong>
            <span>
              Start with a permission-first introduction, learn their
              preferences, then recommend.
            </span>
          </div>
        </button>
        <button className="onboarding-entry" onClick={() => nav("whatsapp")}>
          <Globe size={23} />
          <div>
            <strong>
              {data.connection?.status === "connected"
                ? "WhatsApp demo connected"
                : "Connect your WhatsApp workspace"}
            </strong>
            <span>
              Preview the demo pairing flow and sync sample contacts and
              conversation histories.
            </span>
          </div>
        </button>
      </div>
      <div className="dashboard-feature-row">
        <section className="campaign-feature">
          <div className="feature-copy">
            <span className="eyebrow">
              <Sparkles size={14} />
              MORE PERSONAL. MORE RELEVANT.
            </span>
            <h2>
              The right product. <br />
              In their own words.
            </h2>
            <p>
              Meet Ananya and Kiran. Discover their style, send a personal
              recommendation, and learn from every reply.
            </p>
            <button
              className="button dark"
              onClick={() => startCampaign(featured.map((c) => c.id))}
            >
              Start a personalised campaign
              <Plus size={17} />
            </button>
            <span className="feature-footnote">
              <ShieldCheck size={14} />
              You review every message before it’s sent.
            </span>
          </div>
          <div className="feature-preview">
            <div className="floating-label">
              <span className="mini-icon">
                <Sparkles size={14} />
              </span>
              Made for Ananya<Badge tone="green">Tanglish</Badge>
            </div>
            <div className="feature-garments">
              <img
                src="/assets/dress.svg"
                alt="Illustration of a pastel dress"
              />
              <img
                src="/assets/kurta.svg"
                alt="Illustration of a casual kurta"
              />
            </div>
            <div className="preview-message">
              <span className="preview-message-title">
                <MessageCircle size={13} />A conversation, not a broadcast
              </span>
              <p>
                “Ananya, un style-ku suit aagura collection irukku. Oru thadava
                paarunga!”
              </p>
              <span>Illustrative message · Review before sending</span>
            </div>
          </div>
        </section>
        <section className="panel intelligence-summary">
          <span className="panel-icon">
            <BrainCircuit size={22} />
          </span>
          <h2>
            Good memory. <br />
            Great recommendations.
          </h2>
          <p>
            Individual preferences, remembered and refined with every
            conversation.
          </p>
          <div className="memory-progress">
            <span>Customer understanding</span>
            <strong>{known}%</strong>
            <div>
              <span
                style={{
                  width: `${known}%`,
                }}
              />
            </div>
          </div>
          <button className="text-button" onClick={() => nav("intelligence")}>
            Explore customer intelligence
            <ChevronRight size={16} />
          </button>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <SectionHead
            title="Recent campaigns"
            action={
              <button className="text-button" onClick={() => nav("campaigns")}>
                View all
                <ChevronRight size={15} />
              </button>
            }
          >
            A personal approach, from draft to delivery.
          </SectionHead>
          {campaigns.length ? (
            <div className="campaign-list">
              {campaigns.slice(0, 4).map((c) => (
                <button
                  className="campaign-list-item"
                  key={c.id}
                  onClick={() => openCampaign(c.id)}
                >
                  <span className="list-icon">
                    <Megaphone size={19} />
                  </span>
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {c.drafts.length} customers · {date(c.createdAt, true)}
                    </small>
                  </span>
                  <Badge
                    tone={
                      c.drafts.every((d) => d.status === "sent")
                        ? "green"
                        : "amber"
                    }
                  >
                    {campaignStatus(c)}
                  </Badge>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <Empty icon={Megaphone} title="Your first conversation starts here">
              Create a campaign for a handful of customers. Make every
              recommendation count.
            </Empty>
          )}
        </section>
        <section className="panel">
          <SectionHead
            title="People behind the preferences"
            action={
              <button
                className="icon-button"
                onClick={() => nav("contacts")}
                aria-label="View all contacts"
              >
                <ArrowUpRight size={18} />
              </button>
            }
          >
            Every customer has a different story.
          </SectionHead>
          <div className="signals">
            {customers.slice(0, 3).map((c) => (
              <button
                className="signal-row"
                key={c.id}
                onClick={() => openCustomer(c.id)}
              >
                <Avatar name={c.name} />
                <div>
                  <div>
                    <strong>{c.name}</strong>
                    <Badge>{c.language}</Badge>
                  </div>
                  <p>
                    {value(c.profile.interests?.value)}
                    {c.profile.budget_max?.value
                      ? ` · Up to ${money(Number(c.profile.budget_max.value))}`
                      : ""}
                  </p>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="demo-explainer">
        <Info size={17} />
        <span>
          <strong>A complete demo, a human at the centre.</strong> Explore
          realistic customers, simulate regional-language replies, and watch
          preferences evolve. Customer replies and WhatsApp delivery are
          simulated; Gemini powers the chat when connected.
        </span>
        <button className="text-button" onClick={() => nav("conversations")}>
          Try a conversation
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}
function campaignStatus(c: Campaign) {
  const sent = c.drafts.filter((d) => d.status === "sent").length;
  if (sent === c.drafts.length && sent) return "Simulated delivery";
  if (sent) return "Partially sent";
  if (c.drafts.every((d) => d.status === "rejected")) return "Rejected";
  if (c.drafts.some((d) => d.status === "approved")) return "Ready to send";
  return "Needs review";
}
function Contacts({
  data,
  selected,
  setSelected,
  openCustomer,
  startCampaign,
  onNewConversation,
}: {
  data: Workspace;
  selected: string[];
  setSelected: (s: string[]) => void;
  openCustomer: (id: string) => void;
  startCampaign: (s: string[]) => void;
  onNewConversation: () => void;
}) {
  const [search, setSearch] = useState(""),
    [language, setLanguage] = useState("All languages"),
    [consent, setConsent] = useState("All contacts");
  const filtered = data.customers.filter(
    (c) =>
      `${c.name} ${c.nickname} ${c.phone} ${value(c.profile.interests?.value)}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (language === "All languages" || c.language === language) &&
      (consent === "All contacts" ||
        c.consent === (consent === "Marketing consent")),
  );
  const toggle = (id: string) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : selected.length < 10
          ? [...selected, id]
          : selected,
    );
  const eligible = filtered.filter((c) => c.consent && !c.takeover);
  const allSelected =
    eligible.length > 0 && eligible.every((c) => selected.includes(c.id));
  return (
    <>
      <PageTitle
        eyebrow="YOUR CUSTOMER COMMUNITY"
        title="Small details. Stronger connections."
        description="Know their taste, remember their preferences, make it personal."
        action={
          <button
            className="button primary"
            disabled={!selected.length}
            onClick={() => startCampaign(selected)}
          >
            <Plus size={17} />
            Create campaign{selected.length > 0 && ` (${selected.length})`}
          </button>
        }
      />
      <div className="contacts-new-action">
        <button className="button" onClick={onNewConversation}>
          <MessageCircle size={17} />
          New conversation
        </button>
      </div>
      <div className="inline-metrics">
        <span>
          <strong>{data.customers.length}</strong> total contacts
        </span>
        <span>
          <strong>{data.customers.filter((c) => c.consent).length}</strong> with
          marketing consent
        </span>
        <span>
          <strong>3</strong> supported languages
        </span>
      </div>
      <section className="panel contacts-panel">
        <div className="filter-toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Search contacts"
              placeholder="Search name, phone or interest…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="filter-controls">
            <Select
              label="Filter by language"
              value={language}
              onChange={setLanguage}
              options={["All languages", "Tamil", "Kannada", "English"]}
            />
            <Select
              label="Filter by consent"
              value={consent}
              onChange={setConsent}
              options={["All contacts", "Marketing consent", "No consent"]}
            />
          </div>
        </div>
        {selected.length > 0 && (
          <div className="selection-bar">
            <CheckCircle2 size={16} />
            <strong>{selected.length} of 10 customers selected</strong>
            <span>Personal campaigns work better in small batches.</span>
            <button className="text-button" onClick={() => setSelected([])}>
              Clear selection
            </button>
          </div>
        )}
        <div className="table-scroll">
          <table className="contacts-table">
            <thead>
              <tr>
                <th className="check-cell">
                  <input
                    type="checkbox"
                    aria-label="Select up to 10 eligible visible contacts"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(
                        allSelected
                          ? selected.filter(
                              (id) => !eligible.some((c) => c.id === id),
                            )
                          : [
                              ...new Set([
                                ...selected,
                                ...eligible.map((c) => c.id),
                              ]),
                            ].slice(0, 10),
                      )
                    }
                  />
                </th>
                <th>Customer</th>
                <th>Language</th>
                <th>What they like</th>
                <th>Budget</th>
                <th>Marketing</th>
                <th>Last contacted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className={selected.includes(c.id) ? "selected" : ""}
                >
                  <td className="check-cell">
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.name}`}
                      disabled={
                        !c.consent ||
                        c.takeover ||
                        (!selected.includes(c.id) && selected.length >= 10)
                      }
                      checked={selected.includes(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                  </td>
                  <td>
                    <button
                      className="customer-cell"
                      onClick={() => openCustomer(c.id)}
                    >
                      <Avatar name={c.name} />
                      <span>
                        <strong>{c.name}</strong>
                        <small>{c.phone}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <Badge>
                      {c.language === "Tamil"
                        ? "Tamil · Latin"
                        : c.language === "Kannada"
                          ? "Kannada · Latin"
                          : "English"}
                    </Badge>
                    <small className="cell-note">
                      {c.languageOverride
                        ? "Manual selection"
                        : "Auto-detected"}
                    </small>
                  </td>
                  <td>
                    <div className="interest-cell">
                      {(Array.isArray(c.profile.interests?.value)
                        ? c.profile.interests.value
                        : []
                      )
                        .slice(0, 2)
                        .map((v) => (
                          <span className="soft-tag" key={v}>
                            {v}
                          </span>
                        ))}
                      {!c.profile.interests?.value && (
                        <span className="muted">Still learning</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {c.profile.budget_max?.value ? (
                      money(Number(c.profile.budget_max.value))
                    ) : (
                      <span className="muted">Not set</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={c.consent ? "green" : "red"}>
                      {c.consent ? "Consented" : "Opted out"}
                    </Badge>
                    {c.takeover && (
                      <small className="cell-note">Manual takeover</small>
                    )}
                  </td>
                  <td className="nowrap muted">
                    {date(c.lastContacted, true)}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`View ${c.name}'s profile`}
                      onClick={() => openCustomer(c.id)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty icon={Search} title="No contacts found">
            Try another name or change your filters.
          </Empty>
        )}
        <div className="table-footer">
          <span>
            Showing {filtered.length} of {data.customers.length} contacts
          </span>
          <span>
            <ShieldCheck size={14} />
            Consent required · Maximum 10 per campaign
          </span>
        </div>
      </section>
    </>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="select-wrap">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <ChevronDown size={15} />
    </label>
  );
}
function Intelligence({
  data,
  customer: c,
  setCustomerId,
  run,
  busy,
  showConversation,
  startCampaign,
}: {
  data: Workspace;
  customer: Customer;
  setCustomerId: (s: string) => void;
  run: Run;
  busy: boolean;
  showConversation: (id: string) => void;
  startCampaign: (ids: string[]) => void;
}) {
  const [editing, setEditing] = useState(false),
    [purchase, setPurchase] = useState(false),
    [productId, setProductId] = useState(
      data.products.find((p) => p.stock > 0)?.id || "",
    );
  return (
    <>
      <PageTitle
        eyebrow="CUSTOMER INTELLIGENCE"
        title="Remember the little things."
        description="A living profile, shaped by conversations and controlled by you."
      />
      <div className="profile-customer-switch">
        <label>
          Customer{" "}
          <select
            aria-label="Select customer intelligence profile"
            value={c.id}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            {data.customers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section className="panel profile-header">
        <Avatar name={c.name} />
        <div className="profile-identity">
          <h2>{c.name}</h2>
          <p>
            {c.phone}
            <span>·</span>Preferred name: {c.nickname}
          </p>
          <div className="badge-row">
            <Badge tone={c.consent ? "green" : "red"}>
              {c.consent ? "Marketing consent" : "Marketing stopped"}
            </Badge>
            <Badge>
              {c.language} ·{" "}
              {c.language === "English" ? "English" : "Latin script"}
            </Badge>
            <Badge>{c.style}</Badge>
          </div>
        </div>
        <div className="button-group">
          <button className="button" onClick={() => showConversation(c.id)}>
            <MessagesSquare size={16} />
            Conversation
          </button>
          <button
            className="button primary"
            disabled={!c.consent || c.takeover}
            onClick={() => startCampaign([c.id])}
          >
            <Plus size={16} />
            Recommend products
          </button>
        </div>
      </section>
      <div className="intelligence-grid">
        <div>
          <section className="panel">
            <SectionHead
              title="Their preferences"
              action={
                <button
                  className="button small"
                  onClick={() => setEditing(true)}
                >
                  <Pencil size={14} />
                  Edit
                </button>
              }
            >
              Explicit preferences take priority over inferred signals.
            </SectionHead>
            <div className="preference-grid">
              {Object.entries(c.profile)
                .filter(
                  ([key]) =>
                    !["preferred_language", "preferred_script"].includes(key),
                )
                .map(([key, fact]) => (
                  <div className="preference-item" key={key}>
                    <span className="preference-label">
                      {labels[key] || key.replaceAll("_", " ")}
                    </span>
                    <strong>
                      {key === "budget_max" && typeof fact.value === "number"
                        ? money(fact.value)
                        : value(fact.value)}
                    </strong>
                    <div>
                      <Badge tone={fact.explicit ? "green" : "neutral"}>
                        {fact.explicit ? "Explicit" : "Inferred"}
                      </Badge>
                      <small>
                        {Math.round(fact.confidence * 100)}% confidence
                      </small>
                    </div>
                    <p title={fact.source}>{fact.source}</p>
                  </div>
                ))}
              {!Object.keys(c.profile).length && (
                <Empty icon={BrainCircuit} title="A fresh start">
                  Preferences will appear when this customer shares something
                  specific.
                </Empty>
              )}
            </div>
          </section>
          <section className="panel section-gap">
            <SectionHead title="Memory timeline">
              Every change has a source. Nothing is silently assumed.
            </SectionHead>
            {c.changes.length ? (
              <div className="timeline">
                {[...c.changes].reverse().map((change) => (
                  <div className="timeline-item" key={change.id}>
                    <span className="timeline-dot">
                      <BrainCircuit size={14} />
                    </span>
                    <div>
                      <strong>
                        {labels[change.field] ||
                          change.field.replaceAll("_", " ")}{" "}
                        updated
                      </strong>
                      <p>
                        <span className="old-value">
                          {value(change.before)}
                        </span>
                        <ChevronRight size={12} />
                        <span>{value(change.after)}</span>
                      </p>
                      <small>
                        {change.source} · {Math.round(change.confidence * 100)}%
                        · {date(change.createdAt, true)}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon={Activity} title="The story is just beginning">
                New preference changes will appear here with their source and
                confidence.
              </Empty>
            )}
          </section>
          <section className="panel section-gap">
            <SectionHead
              title="Purchase history"
              action={
                <button
                  className="button small"
                  disabled={busy}
                  onClick={() => setPurchase(true)}
                >
                  <Plus size={14} />
                  Record demo purchase
                </button>
              }
            >
              Seeded history and recorded demo purchases.
            </SectionHead>
            {c.purchases.length ? (
              <div className="purchase-list">
                {c.purchases.map((p, i) => (
                  <div className="purchase-row" key={`${p.productId}-${i}`}>
                    <span className="list-icon">
                      <ShoppingBag size={18} />
                    </span>
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {date(p.date)} ·{" "}
                        {p.campaignId
                          ? "Campaign purchase"
                          : "Demo purchase history"}
                      </small>
                    </div>
                    <strong>{money(p.price)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon={ShoppingBag} title="No purchases recorded">
                Record a demo purchase to see it reflected in analytics.
              </Empty>
            )}
          </section>
        </div>
        <div>
          <section className="panel profile-settings">
            <SectionHead title="Language & communication" />
            <label className="field-label" htmlFor="preferred-customer-name">
              Preferred name
            </label>
            <NicknameEditor customer={c} run={run} busy={busy} />
            <label className="field-label">
              Message language
              <select
                value={c.language}
                disabled={busy}
                onChange={(e) =>
                  void run(
                    () =>
                      api(`/customers/${c.id}`, "PATCH", {
                        language: e.target.value,
                        languageOverride: true,
                      }),
                    "Language override saved.",
                  )
                }
              >
                {["English", "Tamil", "Kannada"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <div className="setting-description">
              <span>
                {c.languageOverride
                  ? "Manual override active"
                  : "Automatically detected"}
              </span>
              {c.languageOverride && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        api(`/customers/${c.id}`, "PATCH", {
                          languageOverride: false,
                        }),
                      "Automatic language detection enabled.",
                    )
                  }
                >
                  Use automatic
                </button>
              )}
            </div>
            <div className="info-block">
              <Globe size={17} />
              <p>
                Tamil and Kannada messages use English letters. The next reply
                refines language detection unless overridden.
              </p>
            </div>
            <div className="detected-style">
              <span>Detected customer style</span>
              <strong>{c.style}</strong>
            </div>
          </section>
          <section className="panel section-gap">
            <SectionHead title="Retailer voice" />
            <div className="voice-icon">
              <Sparkles size={20} />
            </div>
            <h3 className="voice-title">{data.retailer.tone.style}</h3>
            <p className="body-muted">
              Detected from the retailer’s outgoing conversation history.
            </p>
            <div className="voice-source">
              <span>Greeting pattern</span>
              <strong>{data.retailer.tone.greeting}</strong>
              <small>
                {Math.round(data.retailer.tone.confidence * 100)}% confidence ·
                Simulated detection
              </small>
            </div>
          </section>
          <section className="panel section-gap control-panel">
            <SectionHead title="Human control" />
            <label className="toggle-row">
              <span>
                <strong>Marketing consent</strong>
                <small>
                  {c.consent
                    ? "Promotional messages allowed"
                    : "Promotional messages blocked"}
                </small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={c.consent}
                disabled={busy}
                onChange={(e) =>
                  void run(
                    () =>
                      api(`/customers/${c.id}`, "PATCH", {
                        consent: e.target.checked,
                      }),
                    "Marketing consent updated.",
                  )
                }
              />
            </label>
            <label className="toggle-row">
              <span>
                <strong>Manual takeover</strong>
                <small>Pause AI follow-ups for this customer</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={c.takeover}
                disabled={busy}
                onChange={(e) =>
                  void run(
                    () =>
                      api(`/customers/${c.id}`, "PATCH", {
                        takeover: e.target.checked,
                      }),
                    "Conversation control updated.",
                  )
                }
              />
            </label>
            <p className="body-muted small-text">
              Clearing memory resets preferences, language and style while
              retaining conversations. Deleting history also removes purchases
              and campaign drafts.
            </p>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    `Clear ${c.name}'s preferences, preference history, detected language and style? Conversations and purchases are retained.`,
                  )
                )
                  void run(
                    () => api(`/customers/${c.id}/memory`, "DELETE"),
                    "Customer memory cleared.",
                  );
              }}
            >
              <Trash2 size={14} />
              Clear preference memory
            </button>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    `Delete ${c.name}'s conversations, preferences, purchases and campaign drafts, and reset detected language and style? Restore the original sample only by resetting the demo.`,
                  )
                )
                  void run(
                    () => api(`/customers/${c.id}/history`, "DELETE"),
                    "Conversation history and memory deleted.",
                  );
              }}
            >
              <Trash2 size={14} />
              Delete customer history
            </button>
          </section>
        </div>
      </div>
      {editing && (
        <PreferenceEditor
          key={c.id}
          customer={c}
          onClose={() => setEditing(false)}
          run={run}
          busy={busy}
        />
      )}
      {purchase && (
        <Modal
          title="Record a demo purchase"
          onClose={() => setPurchase(false)}
        >
          <p className="body-muted">
            Record an actual catalogue product for {c.name}. This simulates a
            purchase; no payment is processed.
          </p>
          <label className="field-label">
            Product
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {data.products
                .filter((p) => p.stock > 0)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {money(p.price)}
                  </option>
                ))}
            </select>
          </label>
          <div className="modal-actions">
            <button className="button" onClick={() => setPurchase(false)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy || !productId}
              onClick={async () => {
                if (
                  await run(
                    () =>
                      api(`/customers/${c.id}/convert`, "POST", {
                        productId,
                      }),
                    "Demo purchase recorded.",
                  )
                )
                  setPurchase(false);
              }}
            >
              <ShoppingBag size={16} />
              Record purchase
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function NicknameEditor({
  customer: c,
  run,
  busy,
}: {
  customer: Customer;
  run: Run;
  busy: boolean;
}) {
  const [name, setName] = useState(c.nickname);
  useEffect(() => setName(c.nickname), [c.id, c.nickname]);
  return (
    <div className="inline-input">
      <input
        id="preferred-customer-name"
        aria-label="Preferred customer name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
      />
      <button
        className="icon-button"
        aria-label="Save preferred name"
        disabled={busy || !name.trim() || name === c.nickname}
        onClick={() =>
          void run(
            () =>
              api(`/customers/${c.id}`, "PATCH", {
                nickname: name.trim(),
              }),
            "Preferred name updated.",
          )
        }
      >
        <Check size={18} />
      </button>
    </div>
  );
}
function PreferenceEditor({
  customer: c,
  onClose,
  run,
  busy,
}: {
  customer: Customer;
  onClose: () => void;
  run: Run;
  busy: boolean;
}) {
  const fields = [
    "interests",
    "preferred_colors",
    "budget_max",
    "preferred_style",
    "disliked_items",
  ];
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(
      fields.map((f) => [
        f,
        c.profile[f]?.value === null
          ? ""
          : value(c.profile[f]?.value) === "Not set"
            ? ""
            : value(c.profile[f]?.value),
      ]),
    ),
  );
  return (
    <Modal title={`Edit ${c.name}'s preferences`} onClose={onClose}>
      <p className="body-muted">
        Saved as explicit preferences with a retailer edit as the source.
        Separate list values with commas.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const profile = Object.fromEntries(
            fields.map((f) => [
              f,
              f === "budget_max"
                ? form[f].trim()
                  ? Number(form[f])
                  : null
                : form[f]
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
            ]),
          );
          if (
            await run(
              () =>
                api(`/customers/${c.id}`, "PATCH", {
                  profile,
                }),
              "Preferences saved as explicit retailer edits.",
            )
          )
            onClose();
        }}
      >
        {fields.map((f) => (
          <label className="field-label" key={f}>
            {labels[f]}
            <input
              value={form[f]}
              type={f === "budget_max" ? "number" : "text"}
              min={f === "budget_max" ? 1 : undefined}
              max={f === "budget_max" ? 10000000 : undefined}
              placeholder={
                f === "budget_max"
                  ? "No budget limit"
                  : "Separate values with commas"
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  [f]: e.target.value,
                })
              }
            />
          </label>
        ))}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            <Check size={16} />
            Save preferences
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Products({ data }: { data: Workspace }) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All categories"),
    [stock, setStock] = useState("All stock");
  const [detail, setDetail] = useState<Product | null>(null);
  const filtered = data.products.filter(
    (p) =>
      `${p.name} ${p.description} ${p.category} ${p.colors.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (category === "All categories" || p.category === category) &&
      (stock === "All stock" ||
        (stock === "In stock" ? p.stock > 0 : p.stock === 0)),
  );
  return (
    <>
      <PageTitle
        eyebrow="YOUR PRODUCT COLLECTION"
        title="Good finds, ready for the right person."
        description="Recommendations always use real prices, availability and catalogue details."
      />
      <div className="catalogue-summary">
        <span>
          <Package size={17} />
          <strong>{data.products.length}</strong> demo products
        </span>
        <span>
          <CheckCircle2 size={17} />
          <strong>
            {data.products.filter((p) => p.stock > 0).length}
          </strong>{" "}
          available to recommend
        </span>
        <Badge>Illustrative catalogue · Prices in INR</Badge>
      </div>
      <div className="filter-toolbar catalogue-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search products"
            placeholder="Search your catalogue…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="filter-controls">
          <Select
            label="Product category"
            value={category}
            onChange={setCategory}
            options={[
              "All categories",
              ...new Set(data.products.map((p) => p.category)),
            ]}
          />
          <Select
            label="Stock availability"
            value={stock}
            onChange={setStock}
            options={["All stock", "In stock", "Out of stock"]}
          />
        </div>
      </div>
      <div className="product-grid">
        {filtered.map((p) => (
          <button
            className="product-card"
            key={p.id}
            onClick={() => setDetail(p)}
          >
            <div className="product-card-image">
              <ProductImage product={p} />
              <span className={`stock-pill ${p.stock === 0 ? "out" : ""}`}>
                {p.stock > 0 ? "In stock" : "Out of stock"}
              </span>
              <span className="product-image-action">
                <Eye size={19} />
              </span>
            </div>
            <div className="product-card-copy">
              <span>{p.category}</span>
              <div>
                <h3>{p.name}</h3>
                <strong>{money(p.price)}</strong>
              </div>
              <p>{p.colors.join(" · ")}</p>
            </div>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <Empty title="No products match" icon={Search}>
          Change your search or filters to discover more.
        </Empty>
      )}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <div className="product-detail">
            <ProductImage product={detail} />
            <div>
              <Badge tone={detail.stock > 0 ? "green" : "red"}>
                {detail.stock > 0
                  ? `${detail.stock} available`
                  : "Out of stock"}
              </Badge>
              <h3>{money(detail.price)}</h3>
              <p>{detail.description}</p>
              <dl>
                <dt>Category</dt>
                <dd>{detail.category}</dd>
                <dt>Style</dt>
                <dd>{detail.style}</dd>
                <dt>Colours</dt>
                <dd>{detail.colors.join(", ")}</dd>
                <dt>Sizes</dt>
                <dd>{detail.sizes.join(", ")}</dd>
                <dt>Sample product reference</dt>
                <dd>
                  <a
                    className="sample-product-link"
                    href={detail.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {detail.url}
                  </a>
                  <small className="cell-note">
                    Illustrative .example link · No live storefront
                  </small>
                </dd>
              </dl>
            </div>
          </div>
          <div className="notice">
            <Info size={17} />
            <span>
              Demonstration catalogue. Product links are sample references; no
              storefront or checkout is connected.
            </span>
          </div>
          <div className="modal-actions">
            <button className="button" onClick={() => setDetail(null)}>
              Close details
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Campaigns({
  data,
  selected,
  setSelected,
  campaignId,
  setCampaignId,
  run,
  busy,
  showConversation,
}: {
  data: Workspace;
  selected: string[];
  setSelected: (s: string[]) => void;
  campaignId: string;
  setCampaignId: (s: string) => void;
  run: Run;
  busy: boolean;
  showConversation: (id: string) => void;
}) {
  const [name, setName] = useState("A little something for you"),
    [search, setSearch] = useState("");
  const campaign = data.campaigns.find((c) => c.id === campaignId);
  const [showHistory, setShowHistory] = useState(false);
  const toggle = (id: string) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : selected.length < 10
          ? [...selected, id]
          : selected,
    );
  const generate = async () => {
    await run(async () => {
      const created = await api<Campaign>("/campaigns", "POST", {
        name: name.trim(),
        customerIds: selected,
      });
      setCampaignId(created.id);
    }, "Personalised recommendations generated. Review each message before approval.");
  };
  const approved =
      campaign?.drafts.filter((d) => d.status === "approved").length || 0,
    sent = campaign?.drafts.filter((d) => d.status === "sent").length || 0;
  return (
    <>
      <PageTitle
        eyebrow="PERSONALISED CAMPAIGNS"
        title="A recommendation for every individual."
        description="A small audience. Thoughtful products. Messages that sound like you."
        action={
          <div className="button-group">
            <button
              className="button"
              onClick={() => setShowHistory(!showHistory)}
            >
              <Clock size={16} />
              {showHistory ? "Hide history" : "Campaign history"}
            </button>
            {campaign && (
              <button
                className="button primary"
                onClick={() => {
                  setCampaignId("");
                  setSelected([]);
                }}
              >
                <Plus size={17} />
                New campaign
              </button>
            )}
          </div>
        }
      />
      <div className="campaign-steps">
        {[
          {
            label: "Select customers",
            icon: Users,
          },
          {
            label: "Generate & review",
            icon: Sparkles,
          },
          {
            label: "Approve & send",
            icon: Send,
          },
        ].map(({ label, icon: Icon }, i) => (
          <div
            key={label}
            className={
              (campaign ? i === 1 || (sent > 0 && i === 2) : i === 0)
                ? "current"
                : ""
            }
          >
            <span>
              <Icon size={16} />
            </span>
            <strong>{label}</strong>
            {i < 2 && <div className="step-rule" />}
          </div>
        ))}
      </div>
      {showHistory && (
        <section className="panel section-gap history-panel">
          <SectionHead title="Campaign history" />
          {data.campaigns.length ? (
            <div className="campaign-list">
              {data.campaigns.map((c) => (
                <button
                  className={`campaign-list-item ${c.id === campaignId ? "active" : ""}`}
                  key={c.id}
                  onClick={() => setCampaignId(c.id)}
                >
                  <span className="list-icon">
                    <Megaphone size={18} />
                  </span>
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {c.drafts.length} customers · {date(c.createdAt)}
                    </small>
                  </span>
                  <Badge
                    tone={
                      c.drafts.every((d) => d.status === "sent")
                        ? "green"
                        : "amber"
                    }
                  >
                    {campaignStatus(c)}
                  </Badge>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <p className="body-muted">
              No campaigns yet. Your first one will appear here.
            </p>
          )}
        </section>
      )}
      {!campaign ? (
        <div className="campaign-setup">
          <section className="panel audience-panel">
            <SectionHead title="Who’s this one for?">
              Select up to 10 customers with marketing consent.
            </SectionHead>
            <label className="search-field">
              <Search size={18} />
              <input
                aria-label="Search campaign audience"
                placeholder="Find a customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="audience-list">
              {data.customers
                .filter((c) =>
                  `${c.name} ${c.phone}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((c) => (
                  <label
                    className={`audience-item ${selected.includes(c.id) ? "selected" : ""}`}
                    key={c.id}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      disabled={
                        busy ||
                        !c.consent ||
                        c.takeover ||
                        (!selected.includes(c.id) && selected.length >= 10)
                      }
                      onChange={() => toggle(c.id)}
                    />
                    <Avatar name={c.name} />
                    <span>
                      <strong>{c.name}</strong>
                      <small>
                        {!c.consent
                          ? "No marketing consent"
                          : c.takeover
                            ? "Manual takeover active"
                            : value(c.profile.interests?.value)}
                      </small>
                    </span>
                    <Badge tone={!c.consent ? "red" : "neutral"}>
                      {c.language}
                    </Badge>
                  </label>
                ))}
            </div>
          </section>
          <aside>
            <section className="panel campaign-configuration">
              <SectionHead title="Make it personal" />
              <label className="field-label">
                Campaign name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </label>
              <div className="selection-summary">
                <Users size={20} />
                <strong>
                  {selected.length}
                  <small>/ 10 customers</small>
                </strong>
              </div>
              <div className="generation-explainer">
                <div>
                  <BrainCircuit size={18} />
                  <span>Read each customer’s individual preferences</span>
                </div>
                <div>
                  <Package size={18} />
                  <span>
                    Filter real catalogue products by budget and stock
                  </span>
                </div>
                <div>
                  <Globe size={18} />
                  <span>Write in their language, using your detected tone</span>
                </div>
              </div>
              <button
                className="button primary full-width"
                disabled={busy || !selected.length || !name.trim()}
                onClick={() => void generate()}
              >
                <Sparkles size={17} />
                Generate recommendations
              </button>
              <p className="small-text body-muted center">
                Simulated AI · Nothing is sent until you approve.
              </p>
            </section>
            <div className="setup-tip">
              <Leaf size={21} />
              <p>
                <strong>Quality over quantity.</strong>A relevant recommendation
                feels like good service. Start with Ananya and Kiran to see how
                it works.
              </p>
              <button
                className="text-button"
                onClick={() =>
                  setSelected(
                    data.customers
                      .filter(
                        (c) =>
                          /ananya|kiran/i.test(c.name) &&
                          c.consent &&
                          !c.takeover,
                      )
                      .map((c) => c.id),
                  )
                }
              >
                Select demo customers
                <Plus size={15} />
              </button>
            </div>
          </aside>
        </div>
      ) : (
        <>
          <section className="campaign-review-header panel">
            <div>
              <Badge tone={sent ? "green" : "amber"}>
                {campaignStatus(campaign)}
              </Badge>
              <h2>{campaign.name}</h2>
              <p>
                {campaign.drafts.length} customers · Created{" "}
                {date(campaign.createdAt)} · {sent} simulated deliveries
              </p>
            </div>
            <div className="button-group">
              <button
                className="button"
                disabled={
                  busy || !campaign.drafts.some((d) => d.status === "pending")
                }
                onClick={() =>
                  void run(
                    () => api(`/campaigns/${campaign.id}/approve`, "POST"),
                    "Pending messages approved.",
                  )
                }
              >
                <CheckCheck size={17} />
                Approve all pending
              </button>
              {campaign.drafts.some(
                (d) =>
                  d.status === "sent" &&
                  ["pending", "failed"].includes(
                    d.automaticReplyStatus || "pending",
                  ),
              ) && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => api(`/campaigns/${campaign.id}/send`, "POST"),
                      "Customer replies processed. No campaign messages were resent.",
                    )
                  }
                >
                  <RotateCcw size={17} />
                  Retry customer replies
                </button>
              )}
              <button
                className="button primary"
                disabled={
                  busy ||
                  !approved ||
                  data.retailer.paused ||
                  data.connection?.status !== "connected"
                }
                onClick={() =>
                  void run(
                    () => api(`/campaigns/${campaign.id}/send`, "POST"),
                    `${approved} approved message${approved === 1 ? "" : "s"} sent. Customer replies and preference updates simulated automatically.`,
                  )
                }
              >
                <Send size={17} />
                Send approved ({approved})
              </button>
            </div>
          </section>
          <div className="notice">
            <ShieldCheck size={18} />
            <span>
              Review every recommendation and message. Editing a message resets
              its approval. Only approved messages are sent through the
              simulator.
            </span>
          </div>
          <div className="draft-grid">
            {campaign.drafts.map((d) => {
              const c = data.customers.find((x) => x.id === d.customerId);
              return c ? (
                <DraftCard
                  key={d.id}
                  draft={d}
                  customer={c}
                  products={data.products}
                  run={run}
                  busy={busy}
                  showConversation={showConversation}
                />
              ) : null;
            })}
          </div>
          {sent > 0 && (
            <div className="next-step-banner">
              <span className="panel-icon">
                <MessagesSquare size={22} />
              </span>
              <div>
                <h3>The conversation is just getting started.</h3>
                <p>
                  Customer replies and preference updates run automatically.
                  Open conversations to review their responses and pending
                  follow-ups.
                </p>
              </div>
              <button
                className="button"
                onClick={() =>
                  showConversation(
                    campaign.drafts.find((d) => d.status === "sent")!
                      .customerId,
                  )
                }
              >
                Open conversations
                <MessagesSquare size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
function DraftCard({
  draft: d,
  customer: c,
  products,
  run,
  busy,
  showConversation,
}: {
  draft: Draft;
  customer: Customer;
  products: Product[];
  run: Run;
  busy: boolean;
  showConversation: (id: string) => void;
}) {
  const [text, setText] = useState(d.text),
    [editing, setEditing] = useState(false);
  useEffect(() => setText(d.text), [d.text]);
  const selectedProducts = d.productIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));
  return (
    <article
      className={`panel draft-card ${d.status === "rejected" ? "draft-rejected" : ""}`}
    >
      <div className="draft-customer">
        <Avatar name={c.name} />
        <div>
          <h3>{c.name}</h3>
          <span>
            {c.language === "Tamil"
              ? "Tanglish"
              : c.language === "Kannada"
                ? "Kanglish"
                : "English"}{" "}
            · {c.style}
          </span>
        </div>
        <Badge
          tone={
            d.status === "sent"
              ? "green"
              : d.status === "approved"
                ? "green"
                : d.status === "rejected"
                  ? "red"
                  : "amber"
          }
        >
          {d.status === "sent"
            ? "Simulated delivery"
            : d.status === "pending"
              ? "Needs review"
              : d.status}
        </Badge>
      </div>
      <div className="draft-products">
        {selectedProducts.map((p) => (
          <div className="recommendation-product" key={p.id}>
            <ProductImage product={p} />
            <div>
              <strong>{p.name}</strong>
              <span>{p.colors.join(" · ")}</span>
              <b>{money(p.price)}</b>
            </div>
            <Badge tone={p.stock > 0 ? "green" : "red"}>
              {p.stock > 0 ? "In stock" : "Unavailable"}
            </Badge>
          </div>
        ))}
        {!selectedProducts.length && (
          <div className="notice amber">
            <Info size={16} />
            <span>
              No suitable product found. Review this message carefully.
            </span>
          </div>
        )}
      </div>
      <div className="match-reasons">
        {d.reasons.map((r, i) => (
          <span key={i}>
            <CheckCircle2 size={13} />
            {r}
          </span>
        ))}
      </div>
      <div className="draft-message-header">
        <span>
          <MessageCircle size={14} />
          PERSONALISED MESSAGE
        </span>
        {!["sent", "rejected"].includes(d.status) && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setEditing(!editing)}
          >
            <Pencil size={13} />
            {editing ? "Cancel edit" : "Edit"}
          </button>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            className="draft-textarea"
            aria-label={`Message for ${c.name}`}
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
          />
          <div className="edit-actions">
            <span className="small-text body-muted">
              Saving resets approval.
            </span>
            <button
              className="button small"
              disabled={busy || !text.trim() || text === d.text}
              onClick={async () => {
                if (
                  await run(
                    () =>
                      api(`/drafts/${d.id}`, "PATCH", {
                        text: text.trim(),
                      }),
                    "Message saved. Review and approve again.",
                  )
                )
                  setEditing(false);
              }}
            >
              Save changes
            </button>
          </div>
        </>
      ) : (
        <div className="draft-message">
          <p>{d.text}</p>
          <span>
            {d.status === "sent" ? (
              <>
                <CheckCheck size={14} />
                {time(d.sentAt || new Date().toISOString())} · Simulated
              </>
            ) : (
              <>
                <Sparkles size={13} />
                Generated using simulated AI
              </>
            )}
          </span>
        </div>
      )}
      <div className="draft-actions">
        {d.status === "sent" ? (
          <button
            className="text-button"
            onClick={() => showConversation(c.id)}
          >
            View conversation
            <ChevronRight size={15} />
          </button>
        ) : (
          <>
            <button
              className="button small subtle"
              disabled={busy || d.status === "rejected" || editing}
              onClick={() =>
                void run(
                  () =>
                    api(`/drafts/${d.id}`, "PATCH", {
                      status: "rejected",
                    }),
                  "Recommendation rejected.",
                )
              }
            >
              <X size={15} />
              Reject
            </button>
            <button
              className={`button small ${d.status === "approved" ? "approved-button" : "primary"}`}
              disabled={
                busy ||
                d.status === "approved" ||
                d.status === "rejected" ||
                editing
              }
              onClick={() =>
                void run(
                  () =>
                    api(`/drafts/${d.id}`, "PATCH", {
                      status: "approved",
                    }),
                  "Message approved. Ready for simulated sending.",
                )
              }
            >
              <Check size={16} />
              {d.status === "approved" ? "Approved" : "Approve message"}
            </button>
            {d.status === "rejected" && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      api(`/drafts/${d.id}`, "PATCH", {
                        status: "pending",
                      }),
                    "Draft restored for review.",
                  )
                }
              >
                Restore draft
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
function Conversations({
  data,
  customer: c,
  setCustomerId,
  run,
  busy,
  openCustomer,
}: {
  data: Workspace;
  customer: Customer;
  setCustomerId: (s: string) => void;
  run: Run;
  busy: boolean;
  openCustomer: (id: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [manual, setManual] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setManual("");
  }, [c.id]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [c.id, c.messages.length]);
  return (
    <>
      <PageTitle
        eyebrow="CONVERSATION INTELLIGENCE"
        title="Listen. Learn. Recommend better."
        description="Every reply adds context. Every response stays in your hands."
        action={
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  api("/retailer", "PATCH", {
                    paused: !data.retailer.paused,
                  }),
                data.retailer.paused
                  ? "Automation resumed."
                  : "Automation paused.",
              )
            }
          >
            {data.retailer.paused ? <Play size={16} /> : <Pause size={16} />}{" "}
            {data.retailer.paused ? "Resume automation" : "Pause automation"}
          </button>
        }
      />
      <div className="conversation-layout">
        <aside className="conversation-list panel">
          <div className="conversation-list-head">
            <h2>
              Conversations <span>{data.customers.length}</span>
            </h2>
            <label className="search-field">
              <Search size={16} />
              <input
                aria-label="Search conversations"
                placeholder="Find a customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="conversation-customer-list">
            {data.customers
              .filter((x) =>
                x.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((x) => {
                const last = x.messages[x.messages.length - 1];
                return (
                  <button
                    key={x.id}
                    className={`conversation-contact ${c.id === x.id ? "active" : ""}`}
                    onClick={() => setCustomerId(x.id)}
                  >
                    <Avatar name={x.name} />
                    <span>
                      <strong>{x.name}</strong>
                      <small>{last?.text || "Start a conversation"}</small>
                      <span className="conversation-contact-meta">
                        <Badge>{x.language}</Badge>
                        {x.messages.some((m) => m.status === "pending") && (
                          <span
                            className="pending-dot"
                            title="Reply awaiting approval"
                          />
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        </aside>
        <section className="chat-panel panel">
          <header className="chat-header">
            <Avatar name={c.name} />
            <div>
              <h2>{c.name}</h2>
              <p>
                {c.phone} · {c.language}{" "}
                {c.language !== "English" ? "(Latin)" : ""}
              </p>
            </div>
            <button
              className="icon-button"
              onClick={() => openCustomer(c.id)}
              aria-label={`View ${c.name}'s intelligence`}
            >
              <BrainCircuit size={20} />
            </button>
          </header>
          <div className="chat-safety-strip">
            <ShieldCheck size={13} />
            <span>
              Automatic simulated customer replies · AI replies require approval
            </span>
            {c.takeover && <Badge tone="amber">Manual takeover</Badge>}
            {!c.consent && <Badge tone="red">Marketing stopped</Badge>}
          </div>
          <div className="chat-messages">
            {!c.messages.length ? (
              <Empty icon={MessageCircle} title="A new conversation">
                Generate a campaign or simulate a customer reply to begin.
              </Empty>
            ) : (
              <>
                <span className="chat-history-label">
                  Conversation history · Demo data
                </span>
                {c.messages.map((m) => (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    customer={c}
                    run={run}
                    busy={busy}
                    paused={
                      data.retailer.paused ||
                      data.connection?.status !== "connected"
                    }
                  />
                ))}
              </>
            )}
            <div ref={chatEnd} />
          </div>
          {c.takeover && (
            <section className="manual-composer">
              <div className="simulator-title">
                <span>
                  <Hand size={16} />
                  RETAILER TAKEOVER
                </span>
                <Badge tone="amber">Human written</Badge>
              </div>
              <p>
                You’re writing as the retailer. AI drafts are paused for this
                customer.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const text = manual.trim();
                  if (!text) return;
                  if (
                    await run(
                      () => api(`/customers/${c.id}/manual`, "POST", { text }),
                      "Retailer message sent through the simulator.",
                    )
                  )
                    setManual("");
                }}
              >
                <label className="field-label" htmlFor="retailer-message">
                  Your message
                  <textarea
                    id="retailer-message"
                    aria-label="Retailer message"
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    placeholder={`Write a personal reply to ${c.nickname}…`}
                    rows={3}
                    maxLength={4000}
                  />
                </label>
                <button
                  className="button primary"
                  type="submit"
                  disabled={
                    busy ||
                    !c.consent ||
                    !manual.trim() ||
                    data.connection?.status !== "connected"
                  }
                >
                  <Send size={16} />
                  Send retailer message (simulated)
                </button>
              </form>
              {!c.consent && (
                <p>
                  Marketing consent is required before sending a retailer
                  message.
                </p>
              )}
            </section>
          )}
        </section>
        <aside className="conversation-insights">
          <section className="panel">
            <SectionHead
              title="Live customer memory"
              action={<BrainCircuit size={19} />}
            />
            <div className="insight-language">
              <Globe size={17} />
              <div>
                <strong>
                  {c.language}
                  {c.language !== "English" ? " · Latin" : ""}
                </strong>
                <span>
                  {c.languageOverride
                    ? "Manually selected"
                    : "Automatically detected"}
                </span>
              </div>
            </div>
            <div className="compact-facts">
              {[
                "interests",
                "preferred_colors",
                "budget_max",
                "preferred_style",
                "purchase_intent",
                "preferred_size",
              ].map(
                (f) =>
                  c.profile[f] && (
                    <div key={f}>
                      <span>{labels[f]}</span>
                      <strong>
                        {f === "budget_max" &&
                        typeof c.profile[f].value === "number"
                          ? money(Number(c.profile[f].value))
                          : value(c.profile[f].value)}
                      </strong>
                    </div>
                  ),
              )}
            </div>
            <button className="text-button" onClick={() => openCustomer(c.id)}>
              Full customer profile
              <ChevronRight size={15} />
            </button>
          </section>
          <section className="panel section-gap conversation-controls">
            <SectionHead title="You’re in control" />
            <button
              className={`control-action ${c.takeover ? "active" : ""}`}
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    api(`/customers/${c.id}`, "PATCH", {
                      takeover: !c.takeover,
                    }),
                  c.takeover
                    ? "AI drafts resumed for this customer."
                    : "Manual takeover active. AI follow-ups paused.",
                )
              }
            >
              <Hand size={18} />
              <span>
                <strong>
                  {c.takeover ? "Resume AI drafts" : "Take over conversation"}
                </strong>
                <small>
                  {c.takeover
                    ? "Return to assisted replies"
                    : "Pause generated follow-ups"}
                </small>
              </span>
            </button>
            <button
              className="control-action"
              disabled={busy || !c.consent}
              onClick={() =>
                void run(
                  () =>
                    api(`/customers/${c.id}`, "PATCH", {
                      consent: false,
                    }),
                  "Promotional messaging stopped.",
                )
              }
            >
              <Ban size={18} />
              <span>
                <strong>
                  {c.consent ? "Stop marketing" : "Marketing stopped"}
                </strong>
                <small>Block promotional messaging</small>
              </span>
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
function ChatMessage({
  message: m,
  customer: c,
  run,
  busy,
  paused,
}: {
  message: Message;
  customer: Customer;
  run: Run;
  busy: boolean;
  paused: boolean;
}) {
  const [editing, setEditing] = useState(false),
    [text, setText] = useState(m.text);
  useEffect(() => setText(m.text), [m.text]);
  return (
    <article
      className={`chat-message ${m.direction} ${m.status === "pending" ? "pending" : ""} ${m.status === "rejected" ? "message-rejected" : ""}`}
    >
      <div className="chat-message-label">
        {m.direction === "incoming" ? c.nickname : "The Style Studio"}
        {m.status === "pending" && (
          <Badge tone="amber">Awaiting approval</Badge>
        )}
        {m.status === "rejected" && <Badge tone="red">Rejected</Badge>}
      </div>
      {editing ? (
        <textarea
          aria-label="Edit pending follow-up"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
        />
      ) : (
        <p>{m.text}</p>
      )}
      <div className="chat-message-meta">
        <span>{time(m.createdAt)}</span>
        <span>
          {m.language}
          {m.intent ? ` · ${m.intent}` : ""}
        </span>
        {m.status === "simulated" && (
          <span>
            <CheckCheck size={13} />
            {m.origin === "manual"
              ? "Retailer-written · Simulated"
              : "Simulated"}
          </span>
        )}
      </div>
      {m.status === "pending" && (
        <div className="pending-actions">
          {editing ? (
            <>
              <button
                className="text-button"
                disabled={busy || !text.trim()}
                onClick={async () => {
                  if (
                    await run(
                      () =>
                        api(`/messages/${m.id}`, "PATCH", {
                          text: text.trim(),
                        }),
                      "Follow-up edited.",
                    )
                  )
                    setEditing(false);
                }}
              >
                <Check size={14} />
                Save edit
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setEditing(false);
                  setText(m.text);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setEditing(true)}
              >
                <Pencil size={13} />
                Edit
              </button>
              <button
                className="text-button danger"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      api(`/messages/${m.id}`, "PATCH", {
                        status: "rejected",
                      }),
                    "Follow-up rejected.",
                  )
                }
              >
                <X size={14} />
                Reject
              </button>
              <button
                className="button small primary"
                disabled={busy || paused || c.takeover || !c.consent}
                onClick={() =>
                  void run(
                    () =>
                      api(`/messages/${m.id}`, "PATCH", {
                        status: "simulated",
                      }),
                    "Follow-up approved and sent through the simulator.",
                  )
                }
              >
                <Check size={14} />
                Approve & send
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
function Analytics({
  data,
  startCampaign,
}: {
  data: Workspace;
  startCampaign: (ids?: string[]) => void;
}) {
  const sentDrafts = data.campaigns
    .flatMap((c) => c.drafts)
    .filter((d) => d.status === "sent");
  const sentCustomers = new Set(sentDrafts.map((d) => d.customerId));
  const replied = data.customers.filter(
    (c) =>
      sentCustomers.has(c.id) &&
      c.messages.some(
        (m) =>
          m.direction === "incoming" &&
          new Date(m.createdAt).getTime() >
            Math.min(
              ...sentDrafts
                .filter((d) => d.customerId === c.id)
                .map((d) => new Date(d.sentAt || 0).getTime()),
            ),
      ),
  );
  const interestedRecipients = replied.filter((c) =>
    ["High", "Medium"].includes(String(c.profile.purchase_intent?.value)),
  ).length;
  const convertedRecipients = data.customers.filter(
    (c) =>
      sentCustomers.has(c.id) &&
      c.purchases.some(
        (p) =>
          p.campaignId &&
          data.campaigns.some(
            (campaign) =>
              campaign.id === p.campaignId &&
              campaign.drafts.some(
                (d) => d.customerId === c.id && d.status === "sent",
              ),
          ),
      ),
  ).length;
  const languageCounts = ["Tamil", "Kannada", "English"].map((language) => ({
    language,
    count: sentDrafts.filter(
      (d) =>
        data.customers.find((c) => c.id === d.customerId)?.language ===
        language,
    ).length,
  }));
  return (
    <>
      <PageTitle
        eyebrow="CAMPAIGN ANALYTICS"
        title="Measure the conversation, not the noise."
        description="Transparent demo metrics based on recorded campaigns, replies and purchases."
        action={
          <Badge tone="green">
            <Activity size={13} />
            Live workspace data
          </Badge>
        }
      />
      <div className="overview-stats">
        {[
          {
            label: "Campaigns created",
            v: data.stats.campaignsCreated,
            sub: "Including drafts and rejected campaigns",
            icon: Megaphone,
          },
          {
            label: "Messages sent",
            v: data.stats.messagesSent,
            sub: "Campaigns and approved follow-ups",
            icon: Send,
          },
          {
            label: "Interested customers",
            v: data.stats.interestedCustomers,
            sub: "Detected from customer responses",
            icon: MessageCircle,
          },
          {
            label: "Converted customers",
            v: data.stats.convertedCustomers,
            sub: "Recorded campaign demo purchases",
            icon: ShoppingBag,
          },
        ].map(({ label, v, sub, icon: Icon }) => (
          <div className="stat" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{v.toString().padStart(2, "0")}</strong>
            <span className="stat-caption">{sub}</span>
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="panel">
          <SectionHead title="From recommendation to response">
            Unique customers in the campaign journey.
          </SectionHead>
          <div className="funnel">
            {[
              {
                label: "Received a simulated campaign",
                n: sentCustomers.size,
              },
              {
                label: "Replied after campaign delivery",
                n: replied.length,
              },
              {
                label: "Interested in a product",
                n: interestedRecipients,
              },
              {
                label: "Recorded campaign purchase",
                n: convertedRecipients,
              },
            ].map((f, i) => (
              <div key={f.label}>
                <div>
                  <span>{f.label}</span>
                  <strong>{f.n}</strong>
                </div>
                <div className="bar-track">
                  <span
                    style={{
                      width: `${sentCustomers.size ? Math.min(100, (f.n / sentCustomers.size) * 100) : 0}%`,
                      opacity: 1 - i * 0.15,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {!sentCustomers.size && (
            <p className="chart-empty-note">
              Your first approved campaign will bring this journey to life.
            </p>
          )}
        </section>
        <section className="panel">
          <SectionHead title="Every language, a connection">
            Campaign deliveries by customer’s current language.
          </SectionHead>
          <div className="language-bars">
            {languageCounts.map((l, i) => (
              <div key={l.language}>
                <div>
                  <span className={`language-marker language-${i}`} />
                  <strong>{l.language}</strong>
                  <span>{l.count} messages</span>
                </div>
                <div className="bar-track">
                  <span
                    style={{
                      width: `${sentDrafts.length ? (l.count / sentDrafts.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="notice">
            <Globe size={17} />
            <span>
              Tamil and Kannada messages use Latin script. Language is detected
              automatically unless manually overridden.
            </span>
          </div>
        </section>
      </div>
      <section className="panel section-gap">
        <SectionHead title="Campaign performance">
          Actual recorded activity. No estimated opens or invented revenue.
        </SectionHead>
        {data.campaigns.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Customers</th>
                  <th>Approved</th>
                  <th>Simulated sends</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.drafts.length}</td>
                    <td>
                      {
                        c.drafts.filter(
                          (d) => d.status === "approved" || d.status === "sent",
                        ).length
                      }
                    </td>
                    <td>
                      {c.drafts.filter((d) => d.status === "sent").length}
                    </td>
                    <td>
                      <Badge
                        tone={
                          c.drafts.every((d) => d.status === "sent")
                            ? "green"
                            : "amber"
                        }
                      >
                        {campaignStatus(c)}
                      </Badge>
                    </td>
                    <td className="muted nowrap">{date(c.createdAt, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={ChartNoAxesCombined}
            title="Your next campaign is the first data point"
            action={
              <button
                className="button primary"
                onClick={() => startCampaign()}
              >
                <Plus size={16} />
                Create a campaign
              </button>
            }
          >
            Generate, review and send a simulated campaign to start tracking
            meaningful engagement.
          </Empty>
        )}
      </section>
      <div className="demo-explainer">
        <Info size={17} />
        <span>
          Seeded purchase history is shown in customer profiles. Conversion
          metrics count only campaign purchases explicitly recorded during this
          demo. No external analytics or sales system is connected.
        </span>
      </div>
    </>
  );
}
