'use client';

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Command,
  Gauge,
  Loader2,
  Lock,
  Mic,
  MoonStar,
  Package,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  SunMedium,
  TimerReset,
  Warehouse,
  X,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge, type BadgeVariant } from "@/components/shared/badge";
import { useCountdown } from "@/components/shared/countdown";
import {
  ProductData,
  ReservationData,
  confirmReservation,
  getProducts,
  getReservations,
  releaseReservation,
  reserveInventory,
} from "@/lib/api";
import {
  answerOperationsQuestion,
  buildInventoryInsights,
  interpretInventoryQuery,
  PRODUCT_CATALOG,
  WAREHOUSE_PROFILES,
} from "@/lib/inventory-catalog";

type ViewKey = "overview" | "catalog" | "analytics" | "concurrency";

type ReserveTarget = {
  product: ProductData;
  inventory: ProductData["inventory"][number];
};

type StressResult = {
  id: number;
  status: number;
  ms: number;
  reservationId?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type VoiceState = "idle" | "listening" | "unsupported";

type Command = {
  label: string;
  description: string;
  keywords: string[];
  run: () => void;
};

function statusVariant(status: ReservationData["status"]): BadgeVariant {
  if (status === "CONFIRMED") return "success";
  if (status === "PENDING") return "warning";
  return "muted";
}

function stockVariant(available: number, total: number): BadgeVariant {
  if (total === 0 || available === 0) return "danger";
  if (available <= 10 || available / total < 0.2) return "warning";
  return "success";
}

function priorityVariant(priority: ProductData["priority"]): BadgeVariant {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "success";
  return "muted";
}

function toneClass(tone: "positive" | "warning" | "critical" | "neutral") {
  if (tone === "critical") return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  if (tone === "warning") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  if (tone === "positive") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  return "border-slate-400/20 bg-slate-400/10 text-slate-200";
}

function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.35em] text-slate-400">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
  icon,
  accent = "from-sky-400/20 to-cyan-400/5",
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={`glass-panel rounded-3xl p-4 ${accent}`}
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sky-100">
          {icon}
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-300">
          Live
        </span>
      </div>
      <div className="text-[11px] uppercase tracking-[0.35em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{sublabel}</div>
    </motion.div>
  );
}

function getReservationTimeline(reservation: ReservationData) {
  const expired = reservation.status === "PENDING" && new Date(reservation.expiresAt).getTime() <= Date.now();

  return [
    { label: "Created", at: reservation.createdAt },
    ...(reservation.status === "CONFIRMED" ? [{ label: "Confirmed", at: reservation.updatedAt }] : []),
    ...(reservation.status === "RELEASED"
      ? [{ label: expired ? "Expired" : "Released", at: reservation.updatedAt }]
      : []),
  ];
}

function ReservationRow({
  reservation,
  expanded,
  busy,
  onToggle,
  onConfirm,
  onRelease,
}: {
  reservation: ReservationData;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onConfirm: () => void;
  onRelease: () => void;
}) {
  const seconds = useCountdown(reservation.status === "PENDING" ? reservation.expiresAt : null);
  const expired = reservation.status === "PENDING" && seconds === 0;
  const productName = reservation.inventory?.product.name ?? "Unknown product";
  const warehouseName = reservation.inventory?.warehouse.name ?? "Unknown warehouse";
  const timeline = getReservationTimeline(reservation);

  return (
    <div className="border-b border-white/6 last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-white/3"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-500">{reservation.id}</span>
            <Badge variant={expired ? "danger" : statusVariant(reservation.status)}>
              {expired ? "EXPIRED" : reservation.status}
            </Badge>
          </div>
          <div className="truncate text-sm font-medium text-white">{productName}</div>
          <div className="mt-1 text-xs text-slate-400">
            {warehouseName} · {reservation.quantity} unit{reservation.quantity !== 1 ? "s" : ""}
          </div>
        </div>

        {reservation.status === "PENDING" && (
          <span className={`font-mono text-sm ${seconds < 60 ? "text-rose-300" : "text-amber-200"}`}>
            {expired ? "expired" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
          </span>
        )}
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-white/6 bg-slate-950/30 px-4 py-4">
          {reservation.status === "PENDING" && (
            <div
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${
                expired
                  ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
                  : "border-amber-400/20 bg-amber-400/10 text-amber-100"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              {expired ? "Payment window elapsed. Cleanup will release this hold." : "Held while the customer completes payment."}
            </div>
          )}

          {reservation.status === "PENDING" && !expired && (
            <div className="flex gap-2">
              <button
                onClick={onConfirm}
                disabled={busy}
                className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-400 px-4 text-xs font-medium text-slate-950 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Confirm payment
              </button>
              <button
                onClick={onRelease}
                disabled={busy}
                className="flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Release
              </button>
            </div>
          )}

          <a
            href={`/reservations/${reservation.id}`}
            className="inline-flex h-9 items-center rounded-full border border-white/10 bg-white/5 px-4 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10"
          >
            Open checkout page
          </a>

          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.3em] text-slate-500">Activity</div>
            <div className="space-y-2">
              {timeline.map((item) => (
                <div key={`${item.label}-${item.at}`} className="flex items-center gap-2 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                  <span className="flex-1 text-slate-300">{item.label}</span>
                  <span className="font-mono text-slate-500">{format(new Date(item.at), "HH:mm:ss")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommandPalette({
  open,
  query,
  setQuery,
  commands,
  onClose,
}: {
  open: boolean;
  query: string;
  setQuery: (value: string) => void;
  commands: Command[];
  onClose: () => void;
}) {
  const filtered = commands.filter((command) => {
    const haystack = `${command.label} ${command.description} ${command.keywords.join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase().trim());
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-80 flex items-start justify-center bg-slate-950/70 px-4 pt-24 backdrop-blur-xl"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ y: 24, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
            className="glass-panel w-full max-w-2xl overflow-hidden rounded-[28px]"
          >
            <div className="flex items-center gap-3 border-b border-white/8 px-4 py-4">
              <Command className="h-4 w-4 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search commands, products, or views..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
              <button onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                Esc
              </button>
            </div>
            <div className="max-h-105 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">No commands found.</div>
              ) : (
                filtered.map((command) => (
                  <button
                    key={command.label}
                    onClick={() => {
                      command.run();
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors hover:bg-white/6"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">{command.label}</div>
                      <div className="text-xs text-slate-400">{command.description}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReserveModal({
  modal,
  quantity,
  setQuantity,
  onClose,
  onSubmit,
}: {
  modal: ReserveTarget | null;
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!modal) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="reserve-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-90 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-xl"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ y: 24, scale: 0.98, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 16, scale: 0.98, opacity: 0 }}
          className="glass-panel w-full max-w-md rounded-[28px]"
        >
          <div className="flex items-start justify-between px-5 pt-5">
            <div>
              <div className="text-sm font-medium text-white">Reserve inventory</div>
              <div className="mt-1 text-xs text-slate-400">{modal.inventory.warehouse.name}</div>
            </div>
            <button onClick={onClose} className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="grid gap-3 rounded-[22px] border border-white/8 bg-white/4 p-3 text-sm">
              {[
                ["Product", modal.product.name],
                ["Category", modal.product.category],
                ["SKU", modal.product.sku],
                ["Warehouse", modal.inventory.warehouse.name],
                ["Available", `${modal.inventory.availableStock} units`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-100">{value}</span>
                </div>
              ))}
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.3em] text-slate-500">Quantity</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={modal.inventory.availableStock}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.max(1, Math.min(modal.inventory.availableStock, Number(event.target.value) || 1)))
                  }
                  className="h-10 w-20 rounded-2xl border border-white/10 bg-slate-950/50 text-center font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                />
                <button
                  onClick={() => setQuantity((current) => Math.min(modal.inventory.availableStock, current + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  +
                </button>
                <span className="ml-1 text-xs text-slate-500">of {modal.inventory.availableStock}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-sky-400/15 bg-sky-400/10 px-3 py-2 text-xs text-sky-100">
              <Clock className="h-3.5 w-3.5" />
              Held for 10 minutes with idempotency protection.
            </div>
          </div>

          <div className="flex gap-2 px-5 pb-5">
            <button
              onClick={onClose}
              className="h-10 flex-1 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-slate-200 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="h-10 flex-1 rounded-full bg-sky-400 text-xs font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
            >
              Confirm reservation
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [view, setView] = useState<ViewKey>("overview");
  const [products, setProducts] = useState<ProductData[]>([]);
  const [reservations, setReservations] = useState<ReservationData[]>([]);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedReservation, setExpandedReservation] = useState<string | null>(null);
  const [modal, setModal] = useState<ReserveTarget | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [stressInventoryId, setStressInventoryId] = useState("");
  const [stressCount, setStressCount] = useState(48);
  const [stressRunning, setStressRunning] = useState(false);
  const [stressResults, setStressResults] = useState<StressResult[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [assistantQuery, setAssistantQuery] = useState("Which warehouse is under the most pressure?");
  const [assistantThread, setAssistantThread] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "I’m watching inventory pressure, reservation flow, warehouse utilization, and concurrency health in real time.",
    },
  ]);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const refresh = useCallback(async (quiet = false) => {
    try {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      const [nextProducts, nextReservations] = await Promise.all([getProducts(), getReservations()]);
      setProducts(nextProducts);
      setReservations(nextReservations);
      setLastSync(new Date());

      if (!stressInventoryId) {
        const firstAvailable = nextProducts.flatMap((product) => product.inventory)[0];
        if (firstAvailable) setStressInventoryId(firstAvailable.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stressInventoryId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void refresh().catch(() => {
        setError("Failed to load inventory");
      });
    }, 0);

    return () => window.clearTimeout(initialLoad);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => refresh(true), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("allo-theme") as "dark" | "light" | null;
    if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("allo-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }

      if (key === "escape") {
        setCommandOpen(false);
        setAssistantOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const metrics = useMemo(() => {
    const totalStock = products.reduce(
      (sum, product) => sum + product.inventory.reduce((inner, item) => inner + item.totalStock, 0),
      0
    );
    const reservedStock = products.reduce(
      (sum, product) => sum + product.inventory.reduce((inner, item) => inner + item.reservedStock, 0),
      0
    );
    const confirmed = reservations.filter((reservation) => reservation.status === "CONFIRMED").length;
    const pending = reservations.filter((reservation) => reservation.status === "PENDING").length;
    const released = reservations.filter((reservation) => reservation.status === "RELEASED").length;
    const lowStockRows = products.flatMap((product) => product.inventory).filter((item) => item.availableStock <= 10).length;
    return {
      totalStock,
      reservedStock,
      availableStock: totalStock - reservedStock,
      confirmed,
      pending,
      released,
      lowStockRows,
      successRate: Math.round((confirmed / Math.max(1, reservations.length)) * 100),
    };
  }, [products, reservations]);

  const warehouseChartData = useMemo(() => {
    const map = new Map<string, { name: string; available: number; reserved: number }>();
    for (const product of products) {
      for (const item of product.inventory) {
        const current = map.get(item.warehouse.id) ?? {
          name: item.warehouse.name,
          available: 0,
          reserved: 0,
        };
        current.available += item.availableStock;
        current.reserved += item.reservedStock;
        map.set(item.warehouse.id, current);
      }
    }

    return Array.from(map.values());
  }, [products]);

  const categoryTrendData = useMemo(() => {
    const map = new Map<string, { category: string; available: number; reserved: number }>();
    for (const product of products) {
      const current = map.get(product.category) ?? { category: product.category, available: 0, reserved: 0 };
      current.available += product.inventory.reduce((sum, item) => sum + item.availableStock, 0);
      current.reserved += product.inventory.reduce((sum, item) => sum + item.reservedStock, 0);
      map.set(product.category, current);
    }

    return Array.from(map.values()).slice(0, 8);
  }, [products]);

  const searchInsight = useMemo(
    () => interpretInventoryQuery(deferredSearch, products, reservations),
    [deferredSearch, products, reservations]
  );

  const filteredProducts = useMemo(() => {
    if (!deferredSearch.trim()) return products;
    const names = new Set(searchInsight.productNames);
    return products.filter(
      (product) =>
        names.has(product.name) ||
        product.name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        product.category.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        product.sku.toLowerCase().includes(deferredSearch.toLowerCase())
    );
  }, [deferredSearch, products, searchInsight.productNames]);

  const productSearchResults = useMemo(() => {
    if (!deferredSearch.trim()) return products.slice(0, 6);
    return filteredProducts.slice(0, 12);
  }, [deferredSearch, filteredProducts, products]);

  const aiInsights = useMemo(() => buildInventoryInsights(products, reservations), [products, reservations]);

  const heatmapData = useMemo(() => {
    const categories = [...new Set(PRODUCT_CATALOG.map((product) => product.category))];

    return WAREHOUSE_PROFILES.map((warehouse) => ({
      warehouse: warehouse.name,
      cells: categories.map((category) => {
        const categoryProducts = products.filter((product) => product.category === category);
        const items = categoryProducts.flatMap((product) => product.inventory.filter((item) => item.warehouse.name === warehouse.name));
        const total = items.reduce((sum, item) => sum + item.totalStock, 0);
        const reserved = items.reduce((sum, item) => sum + item.reservedStock, 0);
        const pressure = total === 0 ? 0 : reserved / total;

        return {
          category,
          total,
          reserved,
          pressure,
        };
      }),
    }));
  }, [products]);

  const stressTarget = products
    .flatMap((product) =>
      product.inventory.map((inventory) => ({
        product,
        inventory,
      }))
    )
    .find((item) => item.inventory.id === stressInventoryId);

  const stressStats = stressResults
    ? {
        success: stressResults.filter((result) => result.status === 201).length,
        conflict: stressResults.filter((result) => result.status === 409).length,
        other: stressResults.filter((result) => result.status !== 201 && result.status !== 409).length,
        avgMs: Math.round(stressResults.reduce((sum, result) => sum + result.ms, 0) / stressResults.length),
      }
    : null;

  const commands = useMemo<Command[]>(() => {
    const sampleProducts = products.slice(0, 6);

    return [
      { label: "Open overview", description: "Jump to the executive summary.", keywords: ["overview", "summary", "home"], run: () => setView("overview") },
      { label: "Open catalog", description: "Browse the product and warehouse grid.", keywords: ["catalog", "products", "inventory"], run: () => setView("catalog") },
      { label: "Open analytics", description: "Inspect utilization and demand curves.", keywords: ["analytics", "charts", "metrics"], run: () => setView("analytics") },
      { label: "Open concurrency lab", description: "Launch the reservation stress simulator.", keywords: ["concurrency", "stress", "simulator"], run: () => setView("concurrency") },
      { label: "Open AI assistant", description: "Show the floating operations copilot.", keywords: ["assistant", "copilot", "ai"], run: () => setAssistantOpen(true) },
      { label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode", description: "Persist the theme preference.", keywords: ["theme", "dark", "light"], run: () => setTheme(theme === "dark" ? "light" : "dark") },
      { label: "Refresh live data", description: "Pull the latest inventory and reservation state.", keywords: ["refresh", "sync", "live"], run: () => void refresh(true) },
      { label: "Run concurrency simulator", description: "Fire the live reservation burst against the API.", keywords: ["run", "simulate", "burst"], run: () => void runStressTest() },
      { label: "Show low stock electronics", description: "Preload a focused inventory query.", keywords: ["low stock", "electronics"], run: () => {
        setSearchQuery("Show low stock electronics");
        setView("catalog");
      } },
      { label: "Show pending reservations", description: "Focus the reservation stream.", keywords: ["pending", "reservations"], run: () => {
        setSearchQuery("Show pending reservations");
        setView("overview");
      } },
      ...sampleProducts.map((product) => ({
        label: `Search ${product.name}`,
        description: `${product.category} · ${product.sku}`,
        keywords: [product.name, product.category, product.sku],
        run: () => {
          setSearchQuery(product.name);
          setView("catalog");
        },
      })),
    ];
  }, [products, refresh, theme]);

  function openReserve(product: ProductData, inventory: ProductData["inventory"][number]) {
    setModal({ product, inventory });
    setQuantity(1);
    setError(null);
    setMessage(null);
  }

  async function handleReserve() {
    if (!modal) return;
    setError(null);
    setMessage(null);

    try {
      const reservation = await reserveInventory(modal.inventory.id, quantity, crypto.randomUUID());
      setMessage("Reservation created. Complete payment within 10 minutes.");
      setModal(null);
      await refresh(true);
      router.push(`/reservations/${reservation.id}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to reserve inventory";
      setError(text === "INSUFFICIENT_STOCK" ? "That stock was just taken. Try another warehouse." : text);
      await refresh(true);
    }
  }

  async function handleConfirm(reservationId: string) {
    setBusyId(reservationId);
    setError(null);
    setMessage(null);

    try {
      await confirmReservation(reservationId);
      setMessage("Payment confirmed. Stock was permanently decremented.");
      await refresh(true);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to confirm reservation";
      setError(text === "RESERVATION_EXPIRED" ? "Reservation expired before payment completed." : text);
      await refresh(true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRelease(reservationId: string) {
    setBusyId(reservationId);
    setError(null);
    setMessage(null);

    try {
      await releaseReservation(reservationId);
      setMessage("Reservation released. Stock is available again.");
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release reservation");
      await refresh(true);
    } finally {
      setBusyId(null);
    }
  }

  async function runStressTest() {
    if (!stressTarget) return;
    setStressRunning(true);
    setStressResults(null);
    setError(null);
    setMessage(null);
    setView("concurrency");

    const payload = { inventoryId: stressTarget.inventory.id, quantity: 1 };
    const started = performance.now();

    const results = await Promise.all(
      Array.from({ length: stressCount }, async (_, index) => {
        const requestStarted = performance.now();
        const response = await fetch("/api/reservations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        return {
          id: index + 1,
          status: response.status,
          ms: Math.round(performance.now() - requestStarted),
          reservationId: typeof body.id === "string" ? body.id : undefined,
        };
      })
    );

    setStressResults(results);
    setMessage(`Stress test completed in ${Math.round(performance.now() - started)}ms.`);
    setStressRunning(false);
    await refresh(true);
  }

  function executeAssistantQuestion() {
    const answer = answerOperationsQuestion(assistantQuery, products, reservations);
    setAssistantThread((current) =>
      [...current, { role: "user" as const, content: assistantQuery }, { role: "assistant" as const, content: answer }].slice(-8)
    );
    setAssistantQuery("");
  }

  function runVoiceCommand(transcript: string) {
    const normalized = transcript.toLowerCase();
    setVoiceTranscript(transcript);

    if (normalized.includes("show warehouse inventory")) {
      setView("catalog");
      setSearchQuery("warehouse inventory");
    } else if (normalized.includes("open reservation analytics")) {
      setView("analytics");
    } else if (normalized.includes("search for low stock products") || normalized.includes("low stock")) {
      setView("catalog");
      setSearchQuery("Show low stock products");
    } else if (normalized.includes("run concurrency simulator")) {
      void runStressTest();
    } else if (normalized.includes("show pending reservations")) {
      setView("overview");
      setSearchQuery("Show pending reservations");
    }
  }

  function startVoice() {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ??
          (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setVoiceState("unsupported");
      setError("Voice control is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    setVoiceState("listening");
    setVoiceTranscript("");

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setVoiceTranscript(transcript);

      if (event.results[event.results.length - 1]?.isFinal) {
        runVoiceCommand(transcript);
      }
    };

    recognition.onerror = () => {
      setVoiceState("idle");
    };

    recognition.onend = () => {
      setVoiceState("idle");
    };

    recognition.start();
  }

  const visibleReservationFeed = useMemo(() => reservations.slice(0, 10), [reservations]);

  const reservationPressureByStatus = useMemo(
    () => [
      { name: "Pending", value: reservations.filter((item) => item.status === "PENDING").length },
      { name: "Confirmed", value: reservations.filter((item) => item.status === "CONFIRMED").length },
      { name: "Released", value: reservations.filter((item) => item.status === "RELEASED").length },
    ],
    [reservations]
  );

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="absolute inset-0 grid-noise opacity-60" />
      <div className="absolute left-[-10%] top-[-10%] h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="absolute right-[-8%] top-32 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />
      <div className="absolute bottom-[-10%] left-1/3 h-80 w-80 rounded-full bg-emerald-400/8 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-3 z-40 mb-5">
          <div className="glass-panel rounded-[28px] px-4 py-4 shadow-[0_24px_80px_rgba(1,6,20,0.4)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-sky-400 to-cyan-500 text-slate-950 shadow-lg shadow-sky-500/20">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-slate-400">
                    Allo Inventory Control Plane
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-100">Live</span>
                  </div>
                  <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">AI-powered operations for a multi-warehouse commerce network.</h1>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 lg:max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    ["overview", "Overview"],
                    ["catalog", "Catalog"],
                    ["analytics", "Analytics"],
                    ["concurrency", "Concurrency"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setView(key as ViewKey)}
                      className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                        view === key ? "bg-white text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {label}
                    </button>
                  ))}

                  <button
                    onClick={() => setCommandOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                  >
                    <Command className="h-3.5 w-3.5" />
                    Cmd + K
                  </button>

                  <button
                    onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                  >
                    {theme === "dark" ? <SunMedium className="h-3.5 w-3.5" /> : <MoonStar className="h-3.5 w-3.5" />}
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </button>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex flex-1 items-center gap-3 rounded-full border border-white/10 bg-slate-950/45 px-4 py-3">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder='Try: "Show low stock electronics" or "Which warehouse has most pending reservations?"'
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                      onClick={() => setView("catalog")}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-950"
                    >
                      Search
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={startVoice}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-xs font-medium transition-colors ${
                        voiceState === "listening"
                          ? "border-sky-400/25 bg-sky-400/10 text-sky-100"
                          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                      }`}
                    >
                      <Mic className={`h-3.5 w-3.5 ${voiceState === "listening" ? "animate-pulse" : ""}`} />
                      Voice
                    </button>

                    <button
                      onClick={() => void refresh(true)}
                      disabled={refreshing}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {lastSync ? `Synced ${format(lastSync, "HH:mm:ss")}` : "syncing"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">{products.length} products</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">{WAREHOUSE_PROFILES.length} warehouses</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">{reservations.length} reservations</span>
                  {voiceState === "listening" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sky-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-300 animate-pulse" />
                      Listening
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        )}
        {message && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {message}
          </motion.div>
        )}

        {voiceTranscript && voiceState === "idle" && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <span className="text-slate-500">Voice transcript:</span> {voiceTranscript}
          </div>
        )}

        {loading ? (
          <div className="glass-panel flex h-72 items-center justify-center rounded-[28px]">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <main className="space-y-6">
            {view === "overview" && (
              <>
                <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                  <div className="glass-panel rounded-[28px] p-5">
                    <SectionTitle
                      eyebrow="AI intelligence"
                      title="Smart inventory insights"
                      description="The assistant surfaces pressure points, hot SKUs, and warehouse imbalance without asking the user to stitch the data together manually."
                      action={
                        <button
                          onClick={() => setAssistantOpen(true)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                        >
                          <Bot className="h-3.5 w-3.5" />
                          Open assistant
                        </button>
                      }
                    />

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {aiInsights.map((insight) => (
                        <motion.div key={insight.title} whileHover={{ y: -3 }} className={`rounded-3xl border p-4 ${toneClass(insight.tone)}`}>
                          <div className="mb-2 text-[11px] uppercase tracking-[0.3em] text-white/55">{insight.title}</div>
                          <div className="text-sm leading-6 text-white/95">{insight.detail}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel rounded-[28px] p-5">
                    <SectionTitle
                      eyebrow="Natural language search"
                      title="Ask the inventory system"
                      description="Queries like low stock, high demand, pending reservations, and warehouse pressure are translated into useful operational filters."
                    />
                    <div className="mt-5 rounded-3xl border border-white/8 bg-slate-950/35 p-4">
                      <div className="flex items-center gap-2 text-sm text-white">
                        <Search className="h-4 w-4 text-sky-300" />
                        {searchInsight.label}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{searchInsight.message}</p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {searchInsight.productNames.slice(0, 4).map((name) => (
                          <Badge key={name} variant="muted">{name}</Badge>
                        ))}
                        {searchInsight.reservationIds.slice(0, 2).map((id) => (
                          <Badge key={id} variant="warning">{id.slice(0, 8)}</Badge>
                        ))}
                        {!searchInsight.productNames.length && !searchInsight.reservationIds.length && (
                          <Badge variant="muted">No direct matches</Badge>
                        )}
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <button onClick={() => { setSearchQuery("Show low stock electronics"); setView("catalog"); }} className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10">
                          Show low stock electronics
                        </button>
                        <button onClick={() => { setSearchQuery("Which warehouse has most pending reservations?"); setView("overview"); }} className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10">
                          Which warehouse has the most pending reservations?
                        </button>
                        <button onClick={() => { setSearchQuery("Find high demand products"); setView("catalog"); }} className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10">
                          Find high demand products
                        </button>
                        <button onClick={() => { setSearchQuery("Products likely to expire soon"); setView("overview"); }} className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10">
                          Products likely to expire soon
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                  <div className="glass-panel rounded-[28px] p-5">
                    <SectionTitle
                      eyebrow="Live feed"
                      title="Reservation stream"
                      description="Incoming holds, confirmations, and releases roll in as the polling loop refreshes the data layer."
                    />
                    <div className="mt-5 overflow-hidden rounded-3xl border border-white/8 bg-slate-950/35">
                      {visibleReservationFeed.map((reservation) => {
                        const productName = reservation.inventory?.product.name ?? "Unknown";
                        const warehouseName = reservation.inventory?.warehouse.name ?? "Unknown";
                        return (
                          <div key={reservation.id} className="flex items-center gap-3 border-b border-white/6 px-4 py-3 last:border-b-0">
                            {reservation.status === "CONFIRMED" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                            ) : reservation.status === "PENDING" ? (
                              <TimerReset className="h-4 w-4 text-amber-200" />
                            ) : (
                              <XCircle className="h-4 w-4 text-slate-400" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-white">{productName}</div>
                              <div className="text-xs text-slate-400">{warehouseName} · {reservation.quantity} unit{reservation.quantity !== 1 ? "s" : ""}</div>
                            </div>
                            <Badge variant={statusVariant(reservation.status)}>{reservation.status}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="glass-panel rounded-[28px] p-5">
                    <SectionTitle
                      eyebrow="Operational health"
                      title="Control metrics"
                      description="A quick scan of stock pressure, reservation flow, and throughput gives the interviewer immediate confidence this is a real system."
                    />
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <MetricCard label="Total stock" value={metrics.totalStock.toLocaleString()} sublabel={`${products.length} products`} icon={<Package className="h-5 w-5" />} />
                      <MetricCard label="Available" value={metrics.availableStock.toLocaleString()} sublabel="ready to reserve" icon={<Warehouse className="h-5 w-5" />} accent="from-emerald-400/20 to-cyan-400/5" />
                      <MetricCard label="Reserved" value={metrics.reservedStock.toLocaleString()} sublabel="pending payment" icon={<Clock className="h-5 w-5" />} accent="from-amber-400/20 to-rose-400/5" />
                      <MetricCard label="Success rate" value={`${metrics.successRate}%`} sublabel={`${metrics.confirmed} confirmed`} icon={<Gauge className="h-5 w-5" />} accent="from-fuchsia-400/20 to-sky-400/5" />
                    </div>
                  </div>
                </section>
              </>
            )}

            {view === "catalog" && (
              <section className="space-y-4">
                <SectionTitle
                  eyebrow="Catalog operations"
                  title="Premium product explorer"
                  description="This is intentionally dense: the system now feels like a real commerce operations console rather than a take-home demo."
                />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Total stock", metrics.totalStock.toLocaleString(), `${products.length} products`, <Package className="h-5 w-5" />],
                    ["Available", metrics.availableStock.toLocaleString(), "ready to reserve", <Warehouse className="h-5 w-5" />],
                    ["Low stock rows", metrics.lowStockRows.toString(), "needs replenishment", <AlertTriangle className="h-5 w-5" />],
                    ["Pending holds", metrics.pending.toString(), "payment windows active", <Clock className="h-5 w-5" />],
                  ].map(([label, value, sublabel, icon]) => (
                    <MetricCard
                      key={label as string}
                      label={label as string}
                      value={value as string}
                      sublabel={sublabel as string}
                      icon={icon as React.ReactNode}
                    />
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                  <div className="glass-panel rounded-[28px] p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Products</div>
                        <div className="mt-1 text-lg font-semibold text-white">{filteredProducts.length} visible products</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="muted">{searchQuery ? searchQuery : "All categories"}</Badge>
                        <Badge variant={metrics.lowStockRows > 0 ? "warning" : "success"}>{metrics.lowStockRows > 0 ? "Pressure detected" : "Healthy"}</Badge>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {filteredProducts.map((product) => {
                        const totalAvailable = product.inventory.reduce((sum, item) => sum + item.availableStock, 0);
                        const totalStock = product.inventory.reduce((sum, item) => sum + item.totalStock, 0);
                        const expanded = expandedProducts.has(product.id);

                        return (
                          <motion.article key={product.id} whileHover={{ y: -3 }} className="overflow-hidden rounded-[26px] border border-white/8 bg-slate-950/40">
                            <button
                              onClick={() =>
                                setExpandedProducts((current) => {
                                  const next = new Set(current);
                                  next.has(product.id) ? next.delete(product.id) : next.add(product.id);
                                  return next;
                                })
                              }
                              className="block w-full text-left"
                            >
                              <div className="relative aspect-[1.35] overflow-hidden">
                                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/15 to-transparent" />
                                <div className="absolute left-3 top-3 flex items-center gap-2">
                                  <Badge variant={priorityVariant(product.priority)}>{product.priority.toUpperCase()}</Badge>
                                  <Badge variant="muted">{product.category}</Badge>
                                </div>
                                <div className="absolute bottom-3 left-3 right-3">
                                  <div className="text-[11px] uppercase tracking-[0.3em] text-white/65">{product.sku}</div>
                                  <div className="mt-1 text-xl font-semibold text-white">{product.name}</div>
                                  <div className="mt-1 text-xs leading-5 text-slate-300">{product.story}</div>
                                </div>
                              </div>
                              <div className="space-y-3 p-4">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-slate-400">Available</span>
                                  <Badge variant={stockVariant(totalAvailable, totalStock)}>{totalAvailable} units</Badge>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-white/6">
                                  <div className="h-full rounded-full bg-linear-to-r from-sky-400 to-cyan-300" style={{ width: `${Math.min(100, (totalAvailable / Math.max(1, totalStock)) * 100)}%` }} />
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span>{product.inventory.length} warehouse slots</span>
                                  <span>{expanded ? "Hide" : "Inspect"}</span>
                                </div>
                              </div>
                            </button>

                            {expanded && (
                              <div className="border-t border-white/8 bg-slate-950/55 p-4">
                                <div className="space-y-2">
                                  {product.inventory.map((item) => {
                                    const alternative = product.inventory.find((candidate) => candidate.id !== item.id && candidate.availableStock > 0);
                                    return (
                                      <div key={item.id} className="rounded-2xl border border-white/8 bg-white/4 p-3">
                                        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                                          <span className="text-slate-300">{item.warehouse.name}</span>
                                          <Badge variant={stockVariant(item.availableStock, item.totalStock)}>{item.availableStock} available</Badge>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                                          <div>Total <span className="ml-1 font-mono text-slate-200">{item.totalStock}</span></div>
                                          <div>Reserved <span className="ml-1 font-mono text-slate-200">{item.reservedStock}</span></div>
                                          <div>Utilization <span className="ml-1 font-mono text-slate-200">{Math.round((item.reservedStock / Math.max(1, item.totalStock)) * 100)}%</span></div>
                                        </div>
                                        <div className="mt-3 flex justify-end">
                                          {item.availableStock > 0 ? (
                                            <button
                                              onClick={() => openReserve(product, item)}
                                              className="rounded-full bg-sky-400 px-3 py-1.5 text-xs font-semibold text-slate-950"
                                            >
                                              Reserve
                                            </button>
                                          ) : alternative ? (
                                            <button
                                              onClick={() => openReserve(product, alternative)}
                                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200"
                                            >
                                              Try {alternative.warehouse.name}
                                            </button>
                                          ) : (
                                            <span className="text-xs text-slate-500">No alternate warehouse</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </motion.article>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="glass-panel rounded-[28px] p-5">
                      <SectionTitle
                        eyebrow="Warehouse pressure"
                        title="Utilization heatmap"
                        description="A compact heatmap surfaces where inventory is concentrated and which nodes should get a transfer first."
                      />
                      <div className="mt-5 space-y-4">
                        {heatmapData.map((row) => (
                          <div key={row.warehouse} className="space-y-2">
                            <div className="text-sm font-medium text-white">{row.warehouse}</div>
                            <div className="grid grid-cols-5 gap-2">
                              {row.cells.map((cell) => (
                                <div
                                  key={`${row.warehouse}-${cell.category}`}
                                  className="rounded-2xl border border-white/8 px-2 py-3 text-center"
                                  style={{ backgroundColor: `rgba(56, 189, 248, ${Math.max(0.05, cell.pressure * 0.55)})` }}
                                >
                                  <div className="text-[10px] uppercase tracking-[0.28em] text-white/70">{cell.category.slice(0, 4)}</div>
                                  <div className="mt-1 text-xs font-semibold text-white">{Math.round(cell.pressure * 100)}%</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass-panel rounded-[28px] p-5">
                      <SectionTitle
                        eyebrow="AI focus"
                        title="Ask the assistant"
                        description="The floating panel can answer questions about pressure, utilization, system health, and concurrency."
                        action={<button onClick={() => setAssistantOpen((current) => !current)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/10">{assistantOpen ? "Hide assistant" : "Show assistant"}</button>}
                      />
                      <div className="mt-5 rounded-3xl border border-white/8 bg-slate-950/35 p-4 text-sm text-slate-300">
                        {searchInsight.message}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {view === "analytics" && (
              <section className="space-y-4">
                <SectionTitle
                  eyebrow="Operations analytics"
                  title="Executive-grade dashboards"
                  description="The charts expose warehouse utilization, category pressure, and reservation flow at a glance."
                />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Total inventory", metrics.totalStock.toLocaleString(), <Package className="h-5 w-5" />],
                    ["Reserved inventory", metrics.reservedStock.toLocaleString(), <Clock className="h-5 w-5" />],
                    ["Pending holds", metrics.pending.toString(), <TimerReset className="h-5 w-5" />],
                    ["Confirmed flows", metrics.confirmed.toString(), <Check className="h-5 w-5" />],
                  ].map(([label, value, icon]) => (
                    <MetricCard
                      key={label as string}
                      label={label as string}
                      value={value as string}
                      sublabel="Realtime from the API"
                      icon={icon as React.ReactNode}
                    />
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                  <div className="glass-panel rounded-[28px] p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                      <BarChart3 className="h-4 w-4 text-sky-300" />
                      Warehouse utilization
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={warehouseChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="name" stroke="rgba(226,232,240,0.55)" tick={{ fill: "rgba(226,232,240,0.55)", fontSize: 12 }} />
                        <YAxis stroke="rgba(226,232,240,0.55)" tick={{ fill: "rgba(226,232,240,0.55)", fontSize: 12 }} />
                        <Tooltip contentStyle={{ background: "rgba(2,6,23,0.92)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }} />
                        <Bar dataKey="available" stackId="stock" fill="#34d399" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="reserved" stackId="stock" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="glass-panel rounded-[28px] p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                      <Activity className="h-4 w-4 text-emerald-300" />
                      Reservation funnel
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={reservationPressureByStatus}>
                        <defs>
                          <linearGradient id="pressureFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.04} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="name" stroke="rgba(226,232,240,0.55)" tick={{ fill: "rgba(226,232,240,0.55)", fontSize: 12 }} />
                        <YAxis stroke="rgba(226,232,240,0.55)" tick={{ fill: "rgba(226,232,240,0.55)", fontSize: 12 }} />
                        <Tooltip contentStyle={{ background: "rgba(2,6,23,0.92)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }} />
                        <Area type="monotone" dataKey="value" stroke="#38bdf8" fill="url(#pressureFill)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>

                    <div className="mt-4 space-y-3 rounded-3xl border border-white/8 bg-slate-950/35 p-4 text-sm text-slate-300">
                      <div className="flex items-center justify-between"><span>Reservation success rate</span><span className="font-mono text-white">{metrics.successRate}%</span></div>
                      <div className="flex items-center justify-between"><span>Warehouse saturation</span><span className="font-mono text-white">{Math.round((metrics.reservedStock / Math.max(1, metrics.totalStock)) * 100)}%</span></div>
                      <div className="flex items-center justify-between"><span>Low stock rows</span><span className="font-mono text-white">{metrics.lowStockRows}</span></div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="glass-panel rounded-[28px] p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                      <Sparkles className="h-4 w-4 text-fuchsia-300" />
                      Category pressure
                    </div>
                    <div className="space-y-3">
                      {categoryTrendData.map((category) => {
                        const pressure = category.reserved / Math.max(1, category.available + category.reserved);
                        return (
                          <div key={category.category} className="rounded-2xl border border-white/8 bg-white/4 p-3">
                            <div className="flex items-center justify-between text-sm">
                              <span>{category.category}</span>
                              <Badge variant={pressure > 0.25 ? "warning" : "success"}>{Math.round(pressure * 100)}%</Badge>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-white/6">
                              <div className="h-full rounded-full bg-linear-to-r from-fuchsia-400 to-sky-400" style={{ width: `${Math.min(100, pressure * 100)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="glass-panel rounded-[28px] p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                      <Warehouse className="h-4 w-4 text-cyan-300" />
                      Reservation timeline
                    </div>
                    <div className="overflow-hidden rounded-3xl border border-white/8 bg-slate-950/35">
                      {reservations.slice(0, 12).map((reservation) => (
                        <div key={reservation.id} className="flex items-center gap-3 border-b border-white/6 px-4 py-3 last:border-b-0">
                          <span className={`h-2.5 w-2.5 rounded-full ${reservation.status === "CONFIRMED" ? "bg-emerald-300" : reservation.status === "PENDING" ? "bg-amber-300 animate-pulse" : "bg-slate-500"}`} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-white">{reservation.inventory?.product.name ?? "Unknown product"}</div>
                            <div className="text-xs text-slate-400">{reservation.inventory?.warehouse.name ?? "Unknown warehouse"} · {reservation.status}</div>
                          </div>
                          <span className="font-mono text-xs text-slate-500">{format(new Date(reservation.createdAt), "HH:mm")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {view === "concurrency" && (
              <section className="space-y-4">
                <SectionTitle
                  eyebrow="Concurrency lab"
                  title="Oversell prevention under load"
                  description="This simulator fires real reservation requests to show row locking, conflict handling, and throughput behavior in a way backend engineers immediately understand."
                />

                <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
                  <div className="glass-panel rounded-[28px] p-5">
                    <div className="mb-2 text-sm font-medium text-white">Concurrent reservation probe</div>
                    <p className="mb-5 max-w-2xl text-sm text-slate-400">
                      The burst below hits the live reservation API with parallel requests. Successful commits, conflicts, and latency are surfaced in the request graph.
                    </p>

                    <div className="grid gap-3 md:grid-cols-[1fr_160px_140px]">
                      <select
                        value={stressInventoryId}
                        onChange={(event) => setStressInventoryId(event.target.value)}
                        className="h-11 rounded-2xl border border-white/10 bg-slate-950/45 px-3 text-sm text-white"
                      >
                        {products.flatMap((product) =>
                          product.inventory.map((item) => (
                            <option key={item.id} value={item.id}>
                              {product.name} - {item.warehouse.name} ({item.availableStock} available)
                            </option>
                          ))
                        )}
                      </select>
                      <input
                        type="number"
                        min={2}
                        max={100}
                        value={stressCount}
                        onChange={(event) => setStressCount(Math.max(2, Math.min(100, Number(event.target.value) || 48)))}
                        className="h-11 rounded-2xl border border-white/10 bg-slate-950/45 px-3 text-sm text-white"
                      />
                      <button
                        onClick={() => void runStressTest()}
                        disabled={stressRunning || !stressInventoryId}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-sky-400 px-4 text-xs font-semibold text-slate-950 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                      >
                        {stressRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Run test
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                      {[
                        ["Success", stressStats?.success ?? 0, "text-emerald-200"],
                        ["409s", stressStats?.conflict ?? 0, "text-rose-200"],
                        ["Other", stressStats?.other ?? 0, "text-slate-200"],
                        ["Avg latency", `${stressStats?.avgMs ?? 0}ms`, "text-white"],
                      ].map(([label, value, color]) => (
                        <div key={label as string} className="rounded-3xl border border-white/8 bg-white/4 p-4">
                          <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{label}</div>
                          <div className={`mt-2 font-mono text-2xl font-semibold ${color}`}>{value as string | number}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel rounded-[28px] p-5">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                      <Lock className="h-4 w-4 text-sky-300" />
                      Lock-state visualization
                    </div>

                    <div className="space-y-3">
                      {[
                        { title: "Advisory transaction lock", detail: "A request first claims a reservation-safe path before touching stock.", tone: "positive" as const },
                        { title: "Conditional stock update", detail: "Only inventory with enough headroom can transition into a pending hold.", tone: "warning" as const },
                        { title: "Conflict path", detail: "Concurrent callers that lose the race receive a fast 409 instead of corrupting state.", tone: "critical" as const },
                      ].map((item, index) => (
                        <div key={item.title} className={`rounded-3xl border p-4 ${toneClass(item.tone)}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-white">{item.title}</div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] text-slate-200">{index + 1}</span>
                          </div>
                          <div className="mt-2 text-sm leading-6 text-white/90">{item.detail}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 overflow-hidden rounded-3xl border border-white/8 bg-slate-950/35">
                      {stressResults ? (
                        stressResults.map((result) => (
                          <div key={result.id} className="flex items-center gap-3 border-b border-white/6 px-4 py-3 text-xs last:border-b-0">
                            {result.status === 201 ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                            ) : result.status === 409 ? (
                              <XCircle className="h-3.5 w-3.5 text-rose-300" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                            )}
                            <span className="w-16 font-mono text-slate-500">REQ-{String(result.id).padStart(3, "0")}</span>
                            <span className="flex-1 text-slate-300">{result.status === 201 ? "201 Created" : result.status === 409 ? "409 Conflict" : result.status}</span>
                            <span className="font-mono text-slate-500">{result.ms}ms</span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-sm text-slate-500">Run the simulator to see live transactional behavior.</div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </main>
        )}
      </div>

      <AnimatePresence>
        {assistantOpen && (
          <motion.aside
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            className="fixed bottom-4 right-4 z-70 w-[min(92vw,420px)]"
          >
            <div className="glass-panel overflow-hidden rounded-[28px] shadow-[0_24px_80px_rgba(1,6,20,0.45)]">
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Bot className="h-4 w-4 text-sky-300" />
                  AI operations assistant
                </div>
                <button onClick={() => setAssistantOpen(false)} className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-80 space-y-3 overflow-y-auto px-4 py-4 text-sm">
                {assistantThread.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`max-w-[88%] rounded-[22px] px-4 py-3 ${
                      message.role === "assistant"
                        ? "bg-white/5 text-slate-100"
                        : "ml-auto bg-sky-400 text-slate-950"
                    }`}
                  >
                    {message.content}
                  </div>
                ))}
              </div>

              <div className="border-t border-white/8 p-4">
                <div className="flex gap-2">
                  <input
                    value={assistantQuery}
                    onChange={(event) => setAssistantQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") executeAssistantQuestion();
                    }}
                    placeholder="Ask about stock pressure, warehouses, or concurrency..."
                    className="flex-1 rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  <button
                    onClick={executeAssistantQuestion}
                    className="rounded-2xl bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950"
                  >
                    Ask
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <CommandPalette
        open={commandOpen}
        query={commandQuery}
        setQuery={setCommandQuery}
        commands={commands}
        onClose={() => {
          setCommandOpen(false);
          setCommandQuery("");
        }}
      />

      <ReserveModal
        modal={modal}
        quantity={quantity}
        setQuantity={setQuantity}
        onClose={() => setModal(null)}
        onSubmit={() => void handleReserve()}
      />
    </div>
  );
}