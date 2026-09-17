import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
  ArrowUpRight,
  Plus,
  RefreshCw,
  ShieldCheck,
  Search,
} from "lucide-react";
import { api } from "../utils/api";
import type { Product } from "../data/products";
import "./admin.css";

type ProductRow = {
  id: string;
  data: Product;
  price_bdt: number;
  image_url: string;
  active: boolean;
  in_stock: boolean;
  sort_order: number;
};
type Plan = {
  id: string;
  product_id: string;
  name: string;
  details: string;
  price_bdt: number;
  active: boolean;
};
type Order = {
  id: string;
  product_name: string;
  package_name: string;
  amount_bdt: number;
  customer_name: string;
  contact: string;
  customer_note: string;
  status: string;
  payment_status: string;
  payment_reference: string;
  delivery_note: string;
  created_at: string;
};
type Store = {
  faq: { id: string; question: string; answer: string }[];
  policies: Record<
    string,
    {
      title: string;
      lastUpdated: string;
      sections: { heading: string; body: string }[];
    }
  >;
  operations: Record<string, string>;
};
type SettingsData = {
  paymentInstructions: string;
  supportHours: string;
  dealEndsAt: string;
  deals?: { productId: string; oldPrice: number }[];
};
type Data = {
  overview: {
    orders: number;
    pending: number;
    revenue: number;
    customers: number;
  };
  customers: {
    contact: string;
    name: string;
    orders: number;
    revenue: number;
    last_order: string;
  }[];
  products: ProductRow[];
  packages: Plan[];
  orders: Order[];
  content: { id: string; data: Store & SettingsData }[];
  requests: {
    id: string;
    kind: string;
    contact: string;
    message: string;
    status: string;
    created_at: string;
  }[];
  audit: {
    id: number;
    actor: string;
    action: string;
    record_id: string;
    created_at: string;
  }[];
};
type Session = { email: string; role: "owner" | "staff" };
const sections = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Products", icon: Package },
  { name: "Packages", icon: ShoppingBag },
  { name: "Orders", icon: ShoppingBag },
  { name: "Customers", icon: Users },
  { name: "Inbox", icon: MessageSquare },
  { name: "Content", icon: FileText },
  { name: "Offers", icon: ShoppingBag },
  { name: "Settings", icon: Settings },
  { name: "Activity", icon: ShieldCheck },
];
const money = (value: number) =>
  "৳" + Number(value).toLocaleString("en-BD", { maximumFractionDigits: 2 });
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ad-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      className={
        "ad-badge " +
        (["verified", "delivered", "resolved"].includes(String(children))
          ? "good"
          : "")
      }
    >
      {children}
    </span>
  );
}
function date(value: string) {
  return new Date(value).toLocaleString();
}
const emptySettings: SettingsData = {
  paymentInstructions: "",
  supportHours: "10 AM–11 PM Bangladesh time",
  dealEndsAt: "",
};

export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null),
    [checking, setChecking] = useState(true),
    [tab, setTab] = useState("Overview");
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0);
  const [product, setProduct] = useState<ProductRow | null>(null),
    [plan, setPlan] = useState<Plan | null>(null),
    [order, setOrder] = useState<Order | null>(null);
  const [store, setStore] = useState<Store | null>(null),
    [settings, setSettings] = useState<SettingsData>(emptySettings);
  useEffect(() => {
    api<Session>("/admin/session")
      .then(setSession)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const value = await api<Data>("/admin/data?offset=" + offset);
      setData(value);
      setStore(value.content.find((c) => c.id === "store")?.data || null);
      setSettings({
        ...emptySettings,
        ...value.content.find((c) => c.id === "settings")?.data,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [offset]);
  useEffect(() => {
    if (session) void reload();
  }, [session, reload]);
  async function action(task: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      setNotice(message);
      await reload();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      setSession(
        await api<Session>("/admin/login", {
          email: fields.get("email"),
          password: fields.get("password"),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const save = async (kind: string, id: string, value: unknown) =>
    action(
      () => api(`/admin/${kind}/${encodeURIComponent(id)}`, value, "PUT"),
      "Saved. Customer pages receive the updated data when refreshed.",
    );
  const filtered = (text: string) =>
    text.toLowerCase().includes(query.toLowerCase());
  const owner = session?.role === "owner";
  if (checking)
    return (
      <div className="admin-shell ad-loading">Loading secure workspace…</div>
    );
  if (!session)
    return (
      <div className="admin-shell ad-login">
        <div className="ad-login-story">
          <a href="/" className="ad-brand">
            Q<span>QuickSub</span>
          </a>
          <span className="ad-eyebrow">YOUR STORE, ONE WORKSPACE</span>
          <h1>
            A clearer view.
            <br />A better day.
          </h1>
          <p>
            Manage your catalog, keep orders moving, and help your customers—all
            in one place.
          </p>
          <div className="ad-login-note">
            <ShieldCheck /> Protected access for your store team
          </div>
        </div>
        <main className="ad-login-form">
          <form onSubmit={login}>
            <span className="ad-eyebrow">QUICKSUB ADMIN</span>
            <h2>Welcome back</h2>
            <p>Sign in with your authorized Supabase account.</p>
            {error && (
              <div role="alert" className="ad-error">
                {error}
              </div>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <button className="ad-primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to dashboard"}
            </button>
            <a href="/" className="ad-back">
              ← Back to customer website
            </a>
            <p className="ad-muted">
              First setup? Configure Supabase and add your account as an owner
              using ADMIN-SETUP.md.
            </p>
          </form>
        </main>
      </div>
    );
  return (
    <div className="admin-shell ad-layout">
      <aside className="ad-sidebar">
        <a href="/admin" className="ad-brand">
          Q
          <span>
            QuickSub<small>STORE MANAGEMENT</small>
          </span>
        </a>
        <nav aria-label="Admin navigation">
          {sections
            .filter(
              (s) =>
                owner ||
                !["Content", "Offers", "Settings", "Activity"].includes(s.name),
            )
            .map(({ name, icon: Icon }) => (
              <button
                key={name}
                className={tab === name ? "selected" : ""}
                onClick={() => {
                  setTab(name);
                  setQuery("");
                  setProduct(null);
                  setPlan(null);
                  setOrder(null);
                  setNotice("");
                }}
              >
                <Icon size={18} />
                {name}
                {name === "Inbox" &&
                  !!data?.requests.filter((r) => r.status === "open")
                    .length && (
                    <small>
                      {data.requests.filter((r) => r.status === "open").length}
                    </small>
                  )}
              </button>
            ))}
        </nav>
        <div className="ad-sidebar-bottom">
          <a href="/" target="_blank" rel="noreferrer">
            View customer website <ArrowUpRight size={16} />
          </a>
          <div className="ad-user">
            <strong>{session.email}</strong>
            <span>{session.role} account</span>
          </div>
          <button
            onClick={() =>
              void action(async () => {
                await api("/admin/logout", {});
                setSession(null);
                setData(null);
              }, "Signed out")
            }
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="ad-main">
        <header className="ad-topbar">
          <span>
            Workspace / <strong>{tab}</strong>
          </span>
          <span className="ad-badge">{session.role}</span>
        </header>
        <div className="ad-content">
          <div className="ad-page-heading">
            <div>
              <span className="ad-eyebrow">QUICKSUB WORKSPACE</span>
              <h1>{tab === "Overview" ? "Your store at a glance" : tab}</h1>
              <p>
                {tab === "Overview"
                  ? "A working view of your store and its latest orders."
                  : "Manage your " +
                    tab.toLowerCase() +
                    " and keep your customer experience up to date."}
              </p>
            </div>
            <button
              className="ad-secondary"
              disabled={loading || busy}
              onClick={() => void reload()}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
          {error && (
            <div className="ad-error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="ad-success" role="status">
              {notice}
            </div>
          )}
          {!data ? (
            <div className="ad-card ad-empty">
              {loading
                ? "Loading your store…"
                : "Store data is unavailable. Check database setup, then refresh."}
            </div>
          ) : (
            <>
              {tab === "Overview" && (
                <>
                  <div className="ad-metrics">
                    {[
                      [
                        "Active products",
                        data.products.filter((p) => p.active).length,
                      ],
                      [
                        "Available packages",
                        data.packages.filter((p) => p.active).length,
                      ],
                      ["Pending orders", data.overview.pending],
                      ["Verified revenue", money(data.overview.revenue)],
                    ].map(([label, value]) => (
                      <div className="ad-card" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="ad-overview-grid">
                    <section className="ad-card">
                      <div className="ad-section-heading">
                        <h2>Recent orders</h2>
                        <button
                          className="ad-link"
                          onClick={() => setTab("Orders")}
                        >
                          View all →
                        </button>
                      </div>
                      {data.orders.length ? (
                        data.orders.slice(0, 5).map((o) => (
                          <button
                            className="ad-order-row"
                            key={o.id}
                            onClick={() => {
                              setTab("Orders");
                              setOrder(o);
                            }}
                          >
                            <span className="ad-order-icon">
                              <ShoppingBag size={18} />
                            </span>
                            <span>
                              <strong>{o.customer_name}</strong>
                              <small>
                                {o.product_name} · {o.package_name}
                              </small>
                            </span>
                            <span>
                              <strong>{money(o.amount_bdt)}</strong>
                              <Badge>{o.status}</Badge>
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="ad-empty">
                          Your first customer order will appear here.
                        </div>
                      )}
                    </section>
                    <section className="ad-card ad-blue-card">
                      <span className="ad-eyebrow">READY FOR CUSTOMERS</span>
                      <h2>Keep your store in sync.</h2>
                      <p>
                        Publish a product, add an exact-price package, then
                        customers can place an order from its details window.
                      </p>
                      <button onClick={() => setTab("Products")}>
                        Manage catalog <ArrowUpRight size={17} />
                      </button>
                      <small>
                        Payment confirmation and delivery are reviewed by your
                        team.
                      </small>
                    </section>
                  </div>
                </>
              )}
              {[
                "Products",
                "Packages",
                "Orders",
                "Customers",
                "Inbox",
              ].includes(tab) && (
                <div className="ad-toolbar">
                  <div className="ad-search">
                    <Search size={17} />
                    <input
                      aria-label="Search records"
                      placeholder={"Search " + tab.toLowerCase() + "…"}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  {owner && tab === "Products" && (
                    <button
                      className="ad-primary"
                      onClick={() =>
                        setProduct({
                          id: crypto.randomUUID(),
                          price_bdt: 1,
                          image_url: "",
                          active: false,
                          in_stock: true,
                          sort_order: data.products.length,
                          data: {
                            id: "",
                            slug: "",
                            name: "",
                            category: "streaming",
                            shortDescription: "",
                            cardCopy: "",
                            deliveryEstimate: "Contact support",
                            cta: "Order now",
                            badges: [],
                            accentColor: "#2563eb",
                            icon: "Package",
                            bannerImage: "",
                            startingPrice: "",
                          },
                        })
                      }
                    >
                      <Plus size={16} />
                      Add product
                    </button>
                  )}
                  {owner && tab === "Packages" && (
                    <button
                      className="ad-primary"
                      disabled={!data.products.length}
                      onClick={() =>
                        setPlan({
                          id: crypto.randomUUID(),
                          product_id: data.products[0].id,
                          name: "",
                          details: "",
                          price_bdt: 1,
                          active: true,
                        })
                      }
                    >
                      <Plus size={16} />
                      Add package
                    </button>
                  )}
                </div>
              )}
              {tab === "Products" && (
                <div className="ad-card ad-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Starting price</th>
                        <th>Availability</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.products
                        .filter((p) => filtered(p.data.name))
                        .map((p) => (
                          <tr key={p.id}>
                            <td>
                              <div className="ad-product-cell">
                                <img src={p.image_url} alt="" loading="lazy" />
                                <span>
                                  <strong>{p.data.name}</strong>
                                  <small>
                                    {p.active ? "Published" : "Hidden"}
                                  </small>
                                </span>
                              </div>
                            </td>
                            <td>{p.data.category}</td>
                            <td>{money(p.price_bdt)}</td>
                            <td>
                              <Badge>
                                {p.in_stock ? "In stock" : "Out of stock"}
                              </Badge>
                            </td>
                            <td>
                              {owner && (
                                <button
                                  className="ad-link"
                                  onClick={() => setProduct(structuredClone(p))}
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!data.products.length && (
                    <div className="ad-empty">
                      Import your existing catalog or add your first product.
                    </div>
                  )}
                </div>
              )}
              {tab === "Packages" && (
                <div className="ad-card ad-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Package</th>
                        <th>Product</th>
                        <th>Exact price</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.packages
                        .filter((p) => filtered(p.name))
                        .map((p) => (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.name}</strong>
                              <small>{p.details}</small>
                            </td>
                            <td>
                              {
                                data.products.find((x) => x.id === p.product_id)
                                  ?.data.name
                              }
                            </td>
                            <td>{money(p.price_bdt)}</td>
                            <td>
                              <Badge>{p.active ? "Active" : "Hidden"}</Badge>
                            </td>
                            <td>
                              {owner && (
                                <button
                                  className="ad-link"
                                  onClick={() => setPlan({ ...p })}
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!data.packages.length && (
                    <div className="ad-empty">
                      Add duration or quantity packages with exact prices to
                      enable customer checkout.
                    </div>
                  )}
                </div>
              )}
              {tab === "Orders" && (
                <>
                  <div className="ad-card ad-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Order / customer</th>
                          <th>Package</th>
                          <th>Total</th>
                          <th>Payment</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.orders
                          .filter((o) =>
                            filtered(
                              [
                                o.id,
                                o.customer_name,
                                o.contact,
                                o.product_name,
                                o.status,
                                o.payment_status,
                              ].join(" "),
                            ),
                          )
                          .map((o) => (
                            <tr key={o.id}>
                              <td>
                                <strong>{o.customer_name}</strong>
                                <small>
                                  {o.id.slice(0, 8)} · {date(o.created_at)}
                                </small>
                              </td>
                              <td>
                                {o.product_name}
                                <small>{o.package_name}</small>
                              </td>
                              <td>{money(o.amount_bdt)}</td>
                              <td>
                                <Badge>{o.payment_status}</Badge>
                              </td>
                              <td>
                                <Badge>{o.status}</Badge>
                              </td>
                              <td>
                                <button
                                  className="ad-link"
                                  onClick={() => setOrder({ ...o })}
                                >
                                  Review
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {!data.orders.length && (
                      <div className="ad-empty">No orders on this page.</div>
                    )}
                  </div>
                  <div className="ad-pagination">
                    <button
                      disabled={!offset || loading}
                      onClick={() => setOffset(Math.max(0, offset - 50))}
                    >
                      ← Previous
                    </button>
                    <span>
                      Page {offset / 50 + 1} · search applies to these 50 orders
                    </span>
                    <button
                      disabled={data.orders.length < 50 || loading}
                      onClick={() => setOffset(offset + 50)}
                    >
                      Next →
                    </button>
                  </div>
                </>
              )}
              {tab === "Customers" && (
                <div className="ad-card">
                  <h2>Customer directory</h2>
                  <p className="ad-muted">
                    {data.overview.customers} customers · totals include their
                    complete order history.
                  </p>
                  {data.customers
                    .filter((c) => filtered(c.contact + " " + c.name))
                    .map((c) => (
                      <div className="ad-customer" key={c.contact}>
                        <strong>{c.name}</strong>
                        <p>{c.contact}</p>
                        <p className="ad-muted">
                          {c.orders} orders · {money(c.revenue)} verified · Last
                          order {date(c.last_order)}
                        </p>
                      </div>
                    ))}
                  {!data.customers.length && (
                    <div className="ad-empty">
                      Customers appear after placing an order.
                    </div>
                  )}
                  <div className="ad-pagination">
                    <button
                      disabled={!offset || loading}
                      onClick={() => setOffset(Math.max(0, offset - 50))}
                    >
                      ← Previous
                    </button>
                    <span>Page {offset / 50 + 1}</span>
                    <button
                      disabled={data.customers.length < 50 || loading}
                      onClick={() => setOffset(offset + 50)}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
              {tab === "Inbox" && (
                <div className="ad-card">
                  <h2>Support, restock & newsletter requests</h2>
                  <p className="ad-muted">
                    Latest 100 requests. Contact customers through your usual
                    support channel.
                  </p>
                  {data.requests
                    .filter((r) =>
                      filtered(r.contact + " " + r.message + " " + r.kind),
                    )
                    .map((r) => (
                      <article className="ad-request" key={r.id}>
                        <div>
                          <Badge>{r.kind}</Badge>
                          <strong>{r.contact}</strong>
                          <small>{date(r.created_at)}</small>
                        </div>
                        <p>{r.message || "Newsletter signup"}</p>
                        <button
                          className="ad-secondary"
                          disabled={busy}
                          onClick={() =>
                            void save("request", r.id, {
                              status: r.status === "open" ? "resolved" : "open",
                            })
                          }
                        >
                          {r.status === "open" ? "Mark resolved" : "Reopen"}
                        </button>
                      </article>
                    ))}
                  {!data.requests.length && (
                    <div className="ad-empty">
                      New customer requests will appear here.
                    </div>
                  )}
                </div>
              )}
              {tab === "Content" && store && (
                <form
                  className="ad-card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save("content", "store", store);
                  }}
                >
                  <h2>FAQs & Gemini knowledge</h2>
                  <p className="ad-muted">
                    FAQs appear on the customer page and are available to
                    Gemini. Policy and operation text informs the support
                    assistant.
                  </p>
                  {store.faq.map((f, i) => (
                    <div className="ad-faq-editor" key={f.id}>
                      <Field label={"Question " + (i + 1)}>
                        <input
                          required
                          value={f.question}
                          onChange={(e) =>
                            setStore({
                              ...store,
                              faq: store.faq.map((x, j) =>
                                j === i
                                  ? { ...x, question: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </Field>
                      <Field label="Answer">
                        <textarea
                          required
                          value={f.answer}
                          onChange={(e) =>
                            setStore({
                              ...store,
                              faq: store.faq.map((x, j) =>
                                j === i ? { ...x, answer: e.target.value } : x,
                              ),
                            })
                          }
                        />
                      </Field>
                      <button
                        type="button"
                        className="ad-link"
                        onClick={() =>
                          setStore({
                            ...store,
                            faq: store.faq.filter((_, j) => i !== j),
                          })
                        }
                      >
                        Remove question
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="ad-secondary"
                    onClick={() =>
                      setStore({
                        ...store,
                        faq: [
                          ...store.faq,
                          { id: crypto.randomUUID(), question: "", answer: "" },
                        ],
                      })
                    }
                  >
                    Add question
                  </button>
                  <h2 className="ad-spaced">Store operations</h2>
                  {Object.entries(store.operations).map(([key, value]) => (
                    <Field key={key} label={key}>
                      <textarea
                        value={value}
                        onChange={(e) =>
                          setStore({
                            ...store,
                            operations: {
                              ...store.operations,
                              [key]: e.target.value,
                            },
                          })
                        }
                      />
                    </Field>
                  ))}
                  {Object.entries(store.policies).map(([key, policy]) => (
                    <details className="ad-customer" key={key}>
                      <summary>{policy.title}</summary>
                      {policy.sections.map((s, i) => (
                        <Field key={i} label={s.heading}>
                          <textarea
                            value={s.body}
                            onChange={(e) =>
                              setStore({
                                ...store,
                                policies: {
                                  ...store.policies,
                                  [key]: {
                                    ...policy,
                                    sections: policy.sections.map((x, j) =>
                                      j === i
                                        ? { ...x, body: e.target.value }
                                        : x,
                                    ),
                                  },
                                },
                              })
                            }
                          />
                        </Field>
                      ))}
                    </details>
                  ))}
                  <button className="ad-primary" disabled={busy}>
                    Save content
                  </button>
                </form>
              )}
              {tab === "Content" && !store && (
                <div className="ad-card ad-empty">
                  Run the catalog seed first to initialize your FAQ and policy
                  content.
                </div>
              )}
              {tab === "Offers" && (
                <form
                  className="ad-card ad-narrow"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save("content", "settings", {
                      ...settings,
                      deals: settings.deals || [],
                    });
                  }}
                >
                  <h2>Featured offers</h2>
                  <p className="ad-muted">
                    Choose products and their genuine previous prices. The
                    storefront uses the current catalog price, hides unavailable
                    products, and stops showing offers at the deadline in
                    Settings. Set package prices separately before publishing an
                    offer.
                  </p>
                  {settings.deals === undefined && (
                    <p className="ad-note">
                      The original featured offers are currently used. Saving
                      this list replaces them.
                    </p>
                  )}
                  {(settings.deals || []).map((deal, i) => (
                    <div className="ad-form-grid ad-faq-editor" key={i}>
                      <Field label="Product">
                        <select
                          value={deal.productId}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              deals: settings.deals?.map((d, j) =>
                                i === j
                                  ? { ...d, productId: e.target.value }
                                  : d,
                              ),
                            })
                          }
                        >
                          {data.products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.data.name} — current {money(p.price_bdt)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Previous price (BDT)">
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="0.01"
                          value={deal.oldPrice}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              deals: settings.deals?.map((d, j) =>
                                i === j
                                  ? { ...d, oldPrice: Number(e.target.value) }
                                  : d,
                              ),
                            })
                          }
                        />
                      </Field>
                      <button
                        type="button"
                        className="ad-link"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            deals: settings.deals?.filter((_, j) => i !== j),
                          })
                        }
                      >
                        Remove offer
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="ad-secondary"
                    disabled={
                      !data.products.length ||
                      (settings.deals?.length || 0) >= 12
                    }
                    onClick={() =>
                      setSettings({
                        ...settings,
                        deals: [
                          ...(settings.deals || []),
                          {
                            productId: data.products[0].id,
                            oldPrice: Number(data.products[0].price_bdt) + 100,
                          },
                        ],
                      })
                    }
                  >
                    Add offer
                  </button>
                  <button
                    className="ad-primary"
                    disabled={busy}
                    style={{ marginLeft: 12 }}
                  >
                    Save offers
                  </button>
                  <p className="ad-muted">
                    For a bundle, create a product describing all included
                    items, then add its exact-price package.
                  </p>
                </form>
              )}
              {tab === "Settings" && (
                <form
                  className="ad-card ad-narrow"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save("content", "settings", settings);
                  }}
                >
                  <h2>Checkout & campaign settings</h2>
                  <Field label="Payment instructions shown after an order">
                    <textarea
                      placeholder="Your verified bKash / Nagad merchant number and payment instructions"
                      value={settings.paymentInstructions}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          paymentInstructions: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Support hours">
                    <input
                      value={settings.supportHours}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          supportHours: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Offer countdown ends (your local time)">
                    <input
                      type="datetime-local"
                      value={
                        settings.dealEndsAt
                          ? new Date(
                              Date.parse(settings.dealEndsAt) -
                                new Date(
                                  settings.dealEndsAt,
                                ).getTimezoneOffset() *
                                  60000,
                            )
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          dealEndsAt: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : "",
                        })
                      }
                    />
                  </Field>
                  <button
                    type="button"
                    className="ad-secondary"
                    onClick={() => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + 1);
                      setSettings({ ...settings, dealEndsAt: d.toISOString() });
                    }}
                  >
                    Set one month from today
                  </button>
                  <p className="ad-muted">
                    The saved deadline is shared by all visitors. It does not
                    reset on refresh. Configure Gemini and Supabase keys in the
                    server environment; never enter them in public content.
                  </p>
                  <button className="ad-primary" disabled={busy}>
                    Save settings
                  </button>
                </form>
              )}
              {tab === "Activity" && (
                <div className="ad-card">
                  <h2>Recent admin activity</h2>
                  <p className="ad-muted">
                    Latest 100 recorded changes. Account roles are provisioned
                    in Supabase.
                  </p>
                  {data.audit.map((a) => (
                    <div className="ad-order-row" key={a.id}>
                      <span>
                        <strong>{a.action} updated</strong>
                        <small>
                          {a.record_id} · actor {a.actor}
                        </small>
                      </span>
                      <small>{date(a.created_at)}</small>
                    </div>
                  ))}
                  {!data.audit.length && (
                    <div className="ad-empty">
                      Changes to records will appear here.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      {product && (
        <div className="ad-overlay">
          <form
            className="ad-editor"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await save("product", product.id, {
                  ...product,
                  data: { ...product.data, id: product.id },
                })
              )
                setProduct(null);
            }}
          >
            <div className="ad-section-heading">
              <h2>Edit product</h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => setProduct(null)}
                aria-label="Close editor"
              >
                ×
              </button>
            </div>
            <div className="ad-form-grid">
              <Field label="Product name">
                <input
                  required
                  maxLength={160}
                  value={product.data.name}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      data: { ...product.data, name: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="URL slug">
                <input
                  required
                  pattern="[a-z0-9-]+"
                  value={product.data.slug}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      data: { ...product.data, slug: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Category">
                <select
                  value={product.data.category}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      data: {
                        ...product.data,
                        category: e.target.value as Product["category"],
                      },
                    })
                  }
                >
                  {["streaming", "music", "gaming", "ai"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Starting price (BDT)">
                <input
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  required
                  value={product.price_bdt}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      price_bdt: Number(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Short description">
              <input
                required
                value={product.data.shortDescription}
                onChange={(e) =>
                  setProduct({
                    ...product,
                    data: { ...product.data, shortDescription: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Product details">
              <textarea
                required
                value={product.data.cardCopy}
                onChange={(e) =>
                  setProduct({
                    ...product,
                    data: { ...product.data, cardCopy: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Image URL">
              <input
                required
                value={product.image_url}
                onChange={(e) =>
                  setProduct({ ...product, image_url: e.target.value })
                }
              />
            </Field>
            <Field label="Or upload image (JPEG, PNG, WebP; max 6 MB)">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  setError("");
                  try {
                    const r = await fetch("/api/admin/images", {
                      method: "POST",
                      headers: {
                        "Content-Type": file.type,
                        "X-QuickSub-Client": "web",
                      },
                      body: file,
                      signal: AbortSignal.timeout(30000),
                    });
                    const result = await r.json();
                    if (!r.ok) throw new Error(result.error);
                    setProduct((p) =>
                      p ? { ...p, image_url: result.url } : p,
                    );
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </Field>
            <div className="ad-form-grid">
              <Field label="Delivery estimate">
                <input
                  required
                  value={product.data.deliveryEstimate}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      data: {
                        ...product.data,
                        deliveryEstimate: e.target.value,
                      },
                    })
                  }
                />
              </Field>
              <Field label="Accent color">
                <input
                  type="color"
                  value={product.data.accentColor}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      data: { ...product.data, accentColor: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Display order">
                <input
                  type="number"
                  required
                  value={product.sort_order}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      sort_order: Number(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <label className="ad-check">
              <input
                type="checkbox"
                checked={product.active}
                onChange={(e) =>
                  setProduct({ ...product, active: e.target.checked })
                }
              />
              Published on customer page
            </label>
            <label className="ad-check">
              <input
                type="checkbox"
                checked={product.in_stock}
                onChange={(e) =>
                  setProduct({ ...product, in_stock: e.target.checked })
                }
              />
              In stock
            </label>
            {error && (
              <div className="ad-error" role="alert">
                {error}
              </div>
            )}
            <button className="ad-primary" disabled={busy}>
              {busy ? "Saving…" : "Save product"}
            </button>
          </form>
        </div>
      )}
      {plan && (
        <div className="ad-overlay">
          <form
            className="ad-editor"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await save("package", plan.id, plan)) setPlan(null);
            }}
          >
            <div className="ad-section-heading">
              <h2>Edit package</h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPlan(null)}
                aria-label="Close editor"
              >
                ×
              </button>
            </div>
            <Field label="Product">
              <select
                value={plan.product_id}
                onChange={(e) =>
                  setPlan({ ...plan, product_id: e.target.value })
                }
              >
                {data?.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.data.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Package name / duration / quantity">
              <input
                required
                maxLength={160}
                placeholder="Premium · 1 month"
                value={plan.name}
                onChange={(e) => setPlan({ ...plan, name: e.target.value })}
              />
            </Field>
            <Field label="Package details">
              <textarea
                value={plan.details}
                onChange={(e) => setPlan({ ...plan, details: e.target.value })}
              />
            </Field>
            <Field label="Exact price (BDT)">
              <input
                type="number"
                required
                min="0.01"
                max="10000000"
                step="0.01"
                value={plan.price_bdt}
                onChange={(e) =>
                  setPlan({ ...plan, price_bdt: Number(e.target.value) })
                }
              />
            </Field>
            <label className="ad-check">
              <input
                type="checkbox"
                checked={plan.active}
                onChange={(e) => setPlan({ ...plan, active: e.target.checked })}
              />
              Available to customers
            </label>
            {error && (
              <div className="ad-error" role="alert">
                {error}
              </div>
            )}
            <button className="ad-primary" disabled={busy}>
              {busy ? "Saving…" : "Save package"}
            </button>
          </form>
        </div>
      )}
      {order && (
        <div className="ad-overlay">
          <form
            className="ad-editor"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await save("order", order.id, order)) setOrder(null);
            }}
          >
            <div className="ad-section-heading">
              <h2>Review order</h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => setOrder(null)}
                aria-label="Close editor"
              >
                ×
              </button>
            </div>
            <p className="ad-muted">{order.id}</p>
            <h3>
              {order.product_name} · {order.package_name}
            </h3>
            <p>
              {money(order.amount_bdt)} · {order.customer_name} ·{" "}
              {order.contact}
            </p>
            <p className="ad-note">
              Customer note: {order.customer_note || "None"}
            </p>
            <p className="ad-note">
              Payment reference:{" "}
              <strong>{order.payment_reference || "Not submitted"}</strong>
            </p>
            <p className="ad-muted">
              Verify the transaction in your merchant account before marking it
              paid. Changing a status here does not transfer or refund money.
            </p>
            <Field label="Payment status">
              <select
                value={order.payment_status}
                onChange={(e) =>
                  setOrder({ ...order, payment_status: e.target.value })
                }
              >
                {[
                  "unpaid",
                  "submitted",
                  "verified",
                  "rejected",
                  "refunded",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Order status">
              <select
                value={order.status}
                onChange={(e) => setOrder({ ...order, status: e.target.value })}
              >
                {["pending", "processing", "delivered", "cancelled"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Customer-facing delivery / status note (no passwords)">
              <textarea
                maxLength={2000}
                value={order.delivery_note}
                onChange={(e) =>
                  setOrder({ ...order, delivery_note: e.target.value })
                }
              />
            </Field>
            {error && (
              <div className="ad-error" role="alert">
                {error}
              </div>
            )}
            <button className="ad-primary" disabled={busy}>
              {busy ? "Saving…" : "Save order update"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
