import type { ProductData, ReservationData } from "./api";

export type DashboardTab = "products" | "reservations" | "analytics" | "stress";

export type StressResult = {
  id: number;
  status: number;
  ms: number;
  reservationId?: string;
};

export type OperationsSnapshot = {
  products: ProductData[];
  reservations: ReservationData[];
  stressResults: StressResult[] | null;
  lastSync: Date | null;
  refreshMs: number | null;
  loading: boolean;
  error: string | null;
};

export type OperationsInsight = {
  title: string;
  summary: string;
  tone: "success" | "warning" | "danger" | "info";
};

export type AssistantResult = {
  title: string;
  summary: string;
  detail: string;
  focus: DashboardTab;
  suggestedQuery: string;
  productMatches: ProductData[];
  reservationMatches: ReservationData[];
  highlights: string[];
};

export type VoiceCommandResult =
  | { type: "none" }
  | { type: "search"; query: string; focus?: DashboardTab; speak?: string }
  | { type: "navigate"; tab: DashboardTab; speak?: string }
  | { type: "stress"; speak?: string }
  | { type: "action"; speak?: string };

type WarehouseSignal = {
  id: string;
  name: string;
  total: number;
  available: number;
  reserved: number;
  confirmed: number;
  released: number;
  expiringSoon: number;
  activeReservations: number;
  failureProxy: number;
};

type ProductSignal = {
  product: ProductData;
  total: number;
  available: number;
  reserved: number;
  activity: number;
  riskScore: number;
  category: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function words(value: string) {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function includesAny(source: string, candidates: string[]) {
  return candidates.some((candidate) => source.includes(candidate));
}

function isToday(dateValue: string) {
  const input = new Date(dateValue);
  const now = new Date();
  return (
    input.getFullYear() === now.getFullYear() &&
    input.getMonth() === now.getMonth() &&
    input.getDate() === now.getDate()
  );
}

function hoursFromNow(dateValue: string) {
  return (new Date(dateValue).getTime() - Date.now()) / (1000 * 60 * 60);
}

function productCategory(name: string) {
  const lower = name.toLowerCase();
  if (includesAny(lower, ["headphone", "earbud", "monitor", "mouse", "keyboard", "webcam", "dock", "hub", "ssd", "charger", "cable", "laptop"])) {
    return "electronics";
  }
  if (includesAny(lower, ["console", "game", "controller", "arcade"])) {
    return "gaming";
  }
  if (includesAny(lower, ["station", "bag", "case", "cover", "adapter"])) {
    return "accessories";
  }
  return "general";
}

function warehouseSignals(products: ProductData[], reservations: ReservationData[]) {
  const map = new Map<string, WarehouseSignal>();

  for (const product of products) {
    for (const inventory of product.inventory) {
      const current = map.get(inventory.warehouse.id) ?? {
        id: inventory.warehouse.id,
        name: inventory.warehouse.name,
        total: 0,
        available: 0,
        reserved: 0,
        confirmed: 0,
        released: 0,
        expiringSoon: 0,
        activeReservations: 0,
        failureProxy: 0,
      };

      current.total += inventory.totalStock;
      current.available += inventory.availableStock;
      current.reserved += inventory.reservedStock;
      map.set(inventory.warehouse.id, current);
    }
  }

  for (const reservation of reservations) {
    if (!reservation.inventory) continue;

    const current = map.get(reservation.inventory.warehouse.id);
    if (!current) continue;

    if (reservation.status === "CONFIRMED") current.confirmed += 1;
    if (reservation.status === "RELEASED") current.released += 1;
    if (reservation.status === "PENDING") {
      current.activeReservations += 1;
      if (hoursFromNow(reservation.expiresAt) <= 0.5) {
        current.expiringSoon += 1;
      }
    }

    current.failureProxy = current.released + current.expiringSoon;
  }

  return Array.from(map.values()).sort((left, right) => {
    const leftLoad = left.reserved / Math.max(1, left.total) + left.activeReservations * 0.06 + left.failureProxy * 0.08;
    const rightLoad = right.reserved / Math.max(1, right.total) + right.activeReservations * 0.06 + right.failureProxy * 0.08;
    return rightLoad - leftLoad;
  });
}

function productSignals(products: ProductData[], reservations: ReservationData[]) {
  const reservationCounts = new Map<string, number>();
  for (const reservation of reservations) {
    if (!reservation.inventory) continue;
    reservationCounts.set(reservation.inventory.product.id, (reservationCounts.get(reservation.inventory.product.id) ?? 0) + 1);
  }

  const signals: ProductSignal[] = [];

  for (const product of products) {
    const total = product.inventory.reduce((sum, item) => sum + item.totalStock, 0);
    const available = product.inventory.reduce((sum, item) => sum + item.availableStock, 0);
    const reserved = product.inventory.reduce((sum, item) => sum + item.reservedStock, 0);
    const activity = reservationCounts.get(product.id) ?? 0;
    const category = productCategory(product.name);
    const riskScore = (available <= 5 ? 3 : available <= 20 ? 2 : 0) + (reserved / Math.max(1, total)) + activity * 0.15;

    signals.push({ product, total, available, reserved, activity, riskScore, category });
  }

  return signals.sort((left, right) => right.riskScore - left.riskScore);
}

function expiringReservations(reservations: ReservationData[]) {
  return reservations
    .filter((reservation) => reservation.status === "PENDING")
    .map((reservation) => ({ reservation, remainingHours: hoursFromNow(reservation.expiresAt) }))
    .filter(({ remainingHours }) => remainingHours <= 2)
    .sort((left, right) => left.remainingHours - right.remainingHours);
}

function buildSearchTokens(query: string) {
  return words(query);
}

function matchesProduct(product: ProductData, query: string) {
  const productText = normalize(product.name);
  const warehouseText = normalize(product.inventory.map((item) => item.warehouse.name).join(" "));
  const categoryText = productCategory(product.name);
  const queryText = normalize(query);
  const tokens = buildSearchTokens(query);

  if (!queryText) return true;

  return (
    productText.includes(queryText) ||
    warehouseText.includes(queryText) ||
    categoryText.includes(queryText) ||
    tokens.some((token) => productText.includes(token) || warehouseText.includes(token) || categoryText.includes(token))
  );
}

function matchesReservation(reservation: ReservationData, query: string) {
  const queryText = normalize(query);
  const tokens = buildSearchTokens(query);
  const productText = normalize(reservation.inventory?.product.name ?? "");
  const warehouseText = normalize(reservation.inventory?.warehouse.name ?? "");
  const statusText = normalize(reservation.status);
  const idText = normalize(reservation.id);

  if (!queryText) return true;

  return (
    productText.includes(queryText) ||
    warehouseText.includes(queryText) ||
    statusText.includes(queryText) ||
    idText.includes(queryText) ||
    tokens.some((token) => productText.includes(token) || warehouseText.includes(token) || statusText.includes(token) || idText.includes(token))
  );
}

function queryIntent(query: string) {
  const normalized = normalize(query);

  if (includesAny(normalized, ["low stock", "out of stock", "low availability", "critically low", "risk of stockout", "likely to go out of stock"])) {
    return "low-stock";
  }
  if (includesAny(normalized, ["highest reservation activity", "most reserved", "trending", "reservation activity", "most active", "trend" ])) {
    return "activity";
  }
  if (includesAny(normalized, ["expiring", "expire", "expiry", "soon"])) {
    return "expiring";
  }
  if (includesAny(normalized, ["warehouse", "load", "failures", "failure", "overloaded", "heavy load"])) {
    return "warehouse";
  }
  if (includesAny(normalized, ["concurrency", "stress", "lock", "oversell", "failed concurrency", "request failures"])) {
    return "concurrency";
  }
  if (includesAny(normalized, ["health", "cron", "latency", "sync", "subscription", "realtime"])) {
    return "health";
  }

  return "search";
}

export function buildOperationsInsights(snapshot: OperationsSnapshot): OperationsInsight[] {
  const products = productSignals(snapshot.products, snapshot.reservations);
  const warehouses = warehouseSignals(snapshot.products, snapshot.reservations);
  const expiring = expiringReservations(snapshot.reservations);
  const todayReservations = snapshot.reservations.filter((reservation) => isToday(reservation.createdAt));
  const topToday = productSignals(snapshot.products, todayReservations)[0];
  const lowStock = products.filter((signal) => signal.available <= 20);

  const insights: OperationsInsight[] = [];

  if (lowStock[0]) {
    insights.push({
      title: "Stock risk",
      summary: `${lowStock[0].product.name} is the most supply-sensitive item right now with ${lowStock[0].available} units available and ${lowStock[0].reserved} reserved.`,
      tone: lowStock[0].available <= 5 ? "danger" : "warning",
    });
  }

  if (warehouses[0]) {
    insights.push({
      title: "Warehouse load",
      summary: `${warehouses[0].name} is carrying the highest load signal with ${warehouses[0].activeReservations} active holds and ${warehouses[0].failureProxy} release/expiry events.`,
      tone: warehouses[0].failureProxy > 2 ? "warning" : "info",
    });
  }

  if (expiring[0]) {
    insights.push({
      title: "Expiry pressure",
      summary: `${expiring.length} pending reservations are within two hours of expiry; the next one expires in about ${Math.max(0, Math.round(expiring[0].remainingHours * 60))} minutes.`,
      tone: "warning",
    });
  }

  if (topToday) {
    insights.push({
      title: "Today’s demand",
      summary: `${topToday.product.name} leads today’s reservation activity with ${topToday.activity} reservation events, which is a good signal for active demand.`,
      tone: "success",
    });
  }

  const refreshAgeSeconds = snapshot.lastSync ? Math.round((Date.now() - snapshot.lastSync.getTime()) / 1000) : null;
  insights.push({
    title: "Sync health",
    summary: snapshot.error
      ? `The latest refresh reported an error, so the dashboard is using the last known good snapshot.`
      : `Live polling is healthy. The current snapshot is ${refreshAgeSeconds === null ? "fresh" : `${Math.max(0, refreshAgeSeconds)}s old`} with a ${snapshot.refreshMs ?? 0}ms refresh time.`,
    tone: snapshot.error ? "danger" : "success",
  });

  return insights.slice(0, 5);
}

export function buildReservationAnalysis(snapshot: OperationsSnapshot) {
  const warehouseStats = warehouseSignals(snapshot.products, snapshot.reservations)[0];
  const productStats = productSignals(snapshot.products, snapshot.reservations);
  const pending = snapshot.reservations.filter((reservation) => reservation.status === "PENDING");
  const confirmed = snapshot.reservations.filter((reservation) => reservation.status === "CONFIRMED");
  const released = snapshot.reservations.filter((reservation) => reservation.status === "RELEASED");
  const peakHour = new Map<number, number>();

  for (const reservation of snapshot.reservations) {
    const hour = new Date(reservation.createdAt).getHours();
    peakHour.set(hour, (peakHour.get(hour) ?? 0) + 1);
  }

  const busiestHour = Array.from(peakHour.entries()).sort((left, right) => right[1] - left[1])[0];
  const strongestProduct = productStats[0];

  return [
    `${confirmed.length} reservations are already paid and ${pending.length} are still in the hold window.`,
    released.length
      ? `${released.length} reservations were released or expired, which is the main failure proxy used by the operations layer.`
      : "No released reservations are currently skewing the inventory signal.",
    busiestHour
      ? `Peak reservation traffic is clustering around ${String(busiestHour[0]).padStart(2, "0")}:00 with ${busiestHour[1]} events.`
      : "The current sample is too small to infer a peak reservation hour.",
    warehouseStats
      ? `${warehouseStats.name} is the busiest warehouse signal, so concurrency risk is highest there.`
      : "Warehouse load is currently balanced.",
    strongestProduct
      ? `${strongestProduct.product.name} is the strongest demand signal with ${strongestProduct.activity} reservation events and ${strongestProduct.available} units still available.`
      : "No product stands out as unusually active yet.",
  ];
}

export function buildSystemHealthAnalysis(snapshot: OperationsSnapshot) {
  const expired = snapshot.reservations.filter((reservation) => reservation.status === "PENDING" && hoursFromNow(reservation.expiresAt) <= 0);
  const pendingSoon = snapshot.reservations.filter((reservation) => reservation.status === "PENDING" && hoursFromNow(reservation.expiresAt) <= 2);
  const avgLatency = snapshot.refreshMs ?? 0;
  const freshness = snapshot.lastSync ? Math.round((Date.now() - snapshot.lastSync.getTime()) / 1000) : null;

  return {
    headline: snapshot.error ? "System health needs attention" : "System health is stable",
    summary: snapshot.error
      ? `The latest snapshot hit an error, but the last known inventory state is still available for operations review.`
      : `Average refresh latency is ${avgLatency}ms and the current snapshot is ${freshness === null ? "fresh" : `${Math.max(0, freshness)}s old`}.`,
    details: [
      `Cron cleanup pressure is ${expired.length ? "active" : "calm"} with ${expired.length} expired holds currently visible in the live snapshot.`,
      `Reservation cleanup has ${pendingSoon.length} near-expiry holds to watch.`,
      `Realtime sync is operating in lightweight polling mode and is currently ${freshness !== null && freshness < 10 ? "fresh" : "slightly stale"}.`,
    ],
  };
}

export function buildConcurrencyExplainer(snapshot: OperationsSnapshot) {
  const stressResults = snapshot.stressResults ?? [];
  if (!stressResults.length) {
    return {
      headline: "Run the concurrency probe to see the locking story",
      summary: "The simulator will explain how the reservation endpoint prevents overselling under pressure.",
      details: [
        "Successful requests will decrement stock inside a transaction.",
        "Conflicting requests are rejected with 409 responses rather than corrupting inventory.",
        "The explanation panel will turn the raw request log into a backend-friendly narrative.",
      ],
    };
  }

  const success = stressResults.filter((result) => result.status === 201).length;
  const conflicts = stressResults.filter((result) => result.status === 409).length;
  const other = stressResults.length - success - conflicts;
  const avgLatency = Math.round(stressResults.reduce((sum, result) => sum + result.ms, 0) / stressResults.length);

  return {
    headline: "Concurrency behavior explained",
    summary: `${success} requests succeeded and ${conflicts} were rejected by the reservation lock, so overselling was prevented by design.`,
    details: [
      `The average response time during the probe was ${avgLatency}ms.`,
      `${conflicts} requests returned 409 Conflict, which is the expected signal when competing updates hit the same stock row.`,
      other ? `${other} additional requests returned non-standard responses and should be reviewed.` : "All non-winning requests were cleanly rejected or resolved.",
    ],
  };
}

export function answerOperationalQuery(query: string, snapshot: OperationsSnapshot): AssistantResult {
  const intent = queryIntent(query);
  const productRank = productSignals(snapshot.products, snapshot.reservations);
  const warehouses = warehouseSignals(snapshot.products, snapshot.reservations);
  const expiring = expiringReservations(snapshot.reservations);

  if (!query.trim()) {
    return {
      title: "Ask a question about inventory operations",
      summary: "Try: low stock electronics, reservations expiring soon, warehouse with highest failures, or show concurrency issues.",
      detail: "The assistant reads the live operational snapshot, not a canned FAQ.",
      focus: "analytics",
      suggestedQuery: "show low stock products",
      productMatches: productRank.slice(0, 3).map((signal) => signal.product),
      reservationMatches: snapshot.reservations.slice(0, 3),
      highlights: buildOperationsInsights(snapshot).map((insight) => `${insight.title}: ${insight.summary}`),
    };
  }

  if (intent === "low-stock") {
    const queryText = normalize(query);
    const category = includesAny(queryText, ["electronics", "gaming", "accessories"])
      ? words(queryText).find((word) => ["electronics", "gaming", "accessories"].includes(word)) ?? null
      : null;
    const matches = productRank.filter((signal) => signal.available <= 20 && (!category || signal.category === category));

    return {
      title: "Low stock signal",
      summary: matches.length
        ? `${matches.length} products fit the request, and ${matches[0].product.name} is the most constrained item with ${matches[0].available} available units.`
        : "No products currently match that low-stock pattern.",
      detail: matches.length
        ? `The assistant prioritized products with the smallest available buffer and the highest reservation pressure.`
        : "The inventory snapshot does not currently show a critical shortage for that filter.",
      focus: "products",
      suggestedQuery: "show products likely to go out of stock",
      productMatches: matches.slice(0, 5).map((signal) => signal.product),
      reservationMatches: snapshot.reservations.filter((reservation) => matches.some((signal) => reservation.inventory?.product.id === signal.product.id)).slice(0, 5),
      highlights: matches.slice(0, 3).map((signal) => `${signal.product.name}: ${signal.available} available, ${signal.reserved} reserved.`),
    };
  }

  if (intent === "activity") {
    const matches = productRank.filter((signal) => signal.activity > 0).slice(0, 5);
    return {
      title: "Reservation activity",
      summary: matches.length
        ? `${matches[0].product.name} is the busiest product right now with ${matches[0].activity} reservation events.`
        : "No reservation activity has been captured yet.",
      detail: "The ranking blends live reservation counts with current inventory pressure, which is useful for demand forecasting.",
      focus: "reservations",
      suggestedQuery: "show expiring reservations",
      productMatches: matches.map((signal) => signal.product),
      reservationMatches: snapshot.reservations.filter((reservation) => matches.some((signal) => reservation.inventory?.product.id === signal.product.id)).slice(0, 6),
      highlights: matches.map((signal) => `${signal.product.name} → ${signal.activity} reservations, ${signal.available} available.`),
    };
  }

  if (intent === "expiring") {
    const matches = expiring.map(({ reservation }) => reservation);
    return {
      title: "Expiring reservations",
      summary: matches.length
        ? `${matches.length} reservations are close to expiry, with the next one due in under ${Math.max(1, Math.round(expiring[0].remainingHours * 60))} minutes.`
        : "No reservations are near expiry right now.",
      detail: "This is the operational queue that usually drives cleanup automation and payment reminder workflows.",
      focus: "reservations",
      suggestedQuery: "show reservation analytics",
      productMatches: snapshot.products.filter((product) => matches.some((reservation) => reservation.inventory?.product.id === product.id)).slice(0, 5),
      reservationMatches: matches.slice(0, 8),
      highlights: matches.slice(0, 4).map((reservation) => {
        const productName = reservation.inventory?.product.name ?? "Unknown product";
        const minutes = Math.max(0, Math.round(hoursFromNow(reservation.expiresAt) * 60));
        return `${productName} expires in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
      }),
    };
  }

  if (intent === "warehouse") {
    const matches = warehouses.slice(0, 5);
    return {
      title: "Warehouse load",
      summary: matches.length
        ? `${matches[0].name} currently has the highest operational load signal.`
        : "No warehouse load data is currently available.",
      detail: "The load score considers reserved stock, active holds, and release pressure as a proxy for operational stress.",
      focus: "analytics",
      suggestedQuery: "open warehouse utilization",
      productMatches: snapshot.products.filter((product) => matches.some((warehouse) => product.inventory.some((item) => item.warehouse.name === warehouse.name))).slice(0, 5),
      reservationMatches: snapshot.reservations.filter((reservation) => reservation.inventory && matches.some((warehouse) => reservation.inventory?.warehouse.name === warehouse.name)).slice(0, 8),
      highlights: matches.map((warehouse) => `${warehouse.name}: ${warehouse.activeReservations} active holds, ${warehouse.failureProxy} failure-proxy events.`),
    };
  }

  if (intent === "concurrency") {
    return {
      title: "Concurrency and oversell protection",
      summary: buildConcurrencyExplainer(snapshot).summary,
      detail: buildConcurrencyExplainer(snapshot).details.join(" "),
      focus: "stress",
      suggestedQuery: "run concurrency simulator",
      productMatches: productRank.slice(0, 3).map((signal) => signal.product),
      reservationMatches: snapshot.reservations.slice(0, 5),
      highlights: buildConcurrencyExplainer(snapshot).details,
    };
  }

  if (intent === "health") {
    const health = buildSystemHealthAnalysis(snapshot);
    return {
      title: health.headline,
      summary: health.summary,
      detail: health.details.join(" "),
      focus: "analytics",
      suggestedQuery: "show system health",
      productMatches: productRank.slice(0, 3).map((signal) => signal.product),
      reservationMatches: snapshot.reservations.slice(0, 3),
      highlights: health.details,
    };
  }

  const productMatches = snapshot.products.filter((product) => matchesProduct(product, query)).slice(0, 6);
  const reservationMatches = snapshot.reservations.filter((reservation) => matchesReservation(reservation, query)).slice(0, 8);
  const maybeWarehouse = warehouses.find((warehouse) => normalize(query).includes(normalize(warehouse.name)));

  return {
    title: productMatches.length || reservationMatches.length ? "Natural language search" : "No direct match found",
    summary: productMatches.length
      ? `${productMatches.length} product${productMatches.length === 1 ? "" : "s"} matched the request.`
      : reservationMatches.length
        ? `${reservationMatches.length} reservation${reservationMatches.length === 1 ? "" : "s"} matched the request.`
        : "I could not find a direct match, but the command can be refined with product, warehouse, or status keywords.",
    detail: maybeWarehouse
      ? `The query appears to target ${maybeWarehouse.name}, so I aligned the results with that warehouse.`
      : "The assistant used semantic inventory matching across products, reservations, and warehouses.",
    focus: productMatches.length ? "products" : reservationMatches.length ? "reservations" : "analytics",
    suggestedQuery: productMatches.length ? "show low stock products" : reservationMatches.length ? "show expiring reservations" : "which warehouse has highest reservation failures",
    productMatches,
    reservationMatches,
    highlights: [
      ...productMatches.slice(0, 3).map((product) => `${product.name} matches the request.`),
      ...reservationMatches.slice(0, 3).map((reservation) => `${reservation.inventory?.product.name ?? "Unknown product"} in ${reservation.inventory?.warehouse.name ?? "Unknown warehouse"} matched.`),
    ],
  };
}

export function resolveVoiceCommand(transcript: string): VoiceCommandResult {
  const text = normalize(transcript);

  if (!text) return { type: "none" };

  if (includesAny(text, ["open inventory dashboard", "open dashboard", "go to dashboard", "show inventory dashboard"])) {
    return { type: "navigate", tab: "products", speak: "Opening the inventory dashboard." };
  }
  if (includesAny(text, ["show low stock", "low stock products", "out of stock", "likely to go out of stock"])) {
    return { type: "search", query: transcript, focus: "products", speak: "Searching low stock products." };
  }
  if (includesAny(text, ["show reservation analytics", "reservation analytics", "warehouse utilization", "open warehouse utilization"])) {
    return { type: "navigate", tab: "analytics", speak: "Opening reservation analytics." };
  }
  if (includesAny(text, ["run concurrency simulator", "run concurrency test", "stress test", "concurrency probe"])) {
    return { type: "stress", speak: "Running the concurrency simulator." };
  }
  if (includesAny(text, ["show expiring reservations", "expiring reservations", "reserved expiring soon"])) {
    return { type: "search", query: transcript, focus: "reservations", speak: "Showing expiring reservations." };
  }
  if (includesAny(text, ["search", "find", "show", "which", "what", "open warehouse"])) {
    return { type: "search", query: transcript, speak: `Searching for ${transcript}.` };
  }

  return { type: "search", query: transcript, speak: `I heard ${transcript}.` };
}
