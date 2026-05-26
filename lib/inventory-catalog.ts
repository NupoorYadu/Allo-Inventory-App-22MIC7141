export type InventoryPriority = "critical" | "high" | "medium" | "steady";

export interface WarehouseProfile {
  name: string;
  code: string;
  region: string;
  accent: string;
}

export interface ProductCatalogEntry {
  name: string;
  sku: string;
  category: string;
  story: string;
  demand: number;
  warehouseCount: number;
  accent: string;
  image: string;
  priority: InventoryPriority;
}

export interface InventoryBlueprint {
  productName: string;
  warehouseName: string;
  totalStock: number;
  reservedStock: number;
}

export interface ReservationBlueprint {
  productName: string;
  warehouseName: string;
  quantity: number;
  action: "pending" | "confirm" | "release";
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresOffsetMinutes: number;
}

export interface ProductInsight {
  title: string;
  detail: string;
  tone: "positive" | "warning" | "critical" | "neutral";
}

export interface SearchResultSummary {
  label: string;
  message: string;
  productNames: string[];
  reservationIds: string[];
}

export const WAREHOUSE_PROFILES: WarehouseProfile[] = [
  { name: "New York Fulfillment", code: "NYC", region: "North America", accent: "#38bdf8" },
  { name: "Dallas Supply Hub", code: "DAL", region: "North America", accent: "#fb7185" },
  { name: "London Fulfillment", code: "LON", region: "EMEA", accent: "#a78bfa" },
  { name: "Berlin Logistics Center", code: "BER", region: "EMEA", accent: "#34d399" },
  { name: "Singapore Distribution Node", code: "SIN", region: "APAC", accent: "#f59e0b" },
];

type ProductBlueprint = {
  name: string;
  sku: string;
  demand: number;
  warehouseCount: number;
  story: string;
  accent: string;
};

type CatalogGroup = {
  category: string;
  items: ProductBlueprint[];
};

const CATALOG_BLUEPRINTS: CatalogGroup[] = [
  {
    category: "Electronics",
    items: [
      { name: "Laptop Pro 16", sku: "ELC-LPX-016", demand: 0.96, warehouseCount: 4, story: "Flagship workstation for field teams and creators.", accent: "#38bdf8" },
      { name: "Wireless Headphones", sku: "ELC-WHP-214", demand: 0.88, warehouseCount: 4, story: "High-velocity audio accessory with repeat demand.", accent: "#60a5fa" },
      { name: "USB-C Hub", sku: "ELC-HUB-108", demand: 0.72, warehouseCount: 5, story: "Desk essential for hybrid teams and peripherals.", accent: "#a78bfa" },
      { name: "4K Monitor", sku: "ELC-MON-409", demand: 0.77, warehouseCount: 3, story: "Premium display for engineering and design squads.", accent: "#22d3ee" },
    ],
  },
  {
    category: "Fashion",
    items: [
      { name: "Studio Overshirt", sku: "FAS-SHT-301", demand: 0.52, warehouseCount: 3, story: "Seasonless apparel with broad size coverage.", accent: "#f472b6" },
      { name: "Everyday Sneakers", sku: "FAS-SNK-842", demand: 0.84, warehouseCount: 4, story: "Fast-moving core style with strong repeat orders.", accent: "#fb7185" },
      { name: "Tailored Denim Jacket", sku: "FAS-DNM-114", demand: 0.61, warehouseCount: 3, story: "Premium layer for launch-week merchandising.", accent: "#818cf8" },
      { name: "Merino Travel Tee", sku: "FAS-TEE-087", demand: 0.79, warehouseCount: 4, story: "High-conversion wardrobe staple with low return risk.", accent: "#f9a8d4" },
    ],
  },
  {
    category: "Groceries",
    items: [
      { name: "Organic Coffee Beans", sku: "GRO-COF-044", demand: 0.91, warehouseCount: 4, story: "High-frequency replenishment item for office kitchens.", accent: "#f59e0b" },
      { name: "Sparkling Mineral Water", sku: "GRO-WAT-118", demand: 0.69, warehouseCount: 5, story: "Baseline pantry stock with broad warehouse spread.", accent: "#38bdf8" },
      { name: "Protein Oat Granola", sku: "GRO-GRA-209", demand: 0.64, warehouseCount: 3, story: "Healthy snack line that spikes around mornings.", accent: "#84cc16" },
      { name: "Cold Brew Concentrate", sku: "GRO-BRE-067", demand: 0.86, warehouseCount: 3, story: "Trending office beverage with strong weekend dips.", accent: "#d97706" },
    ],
  },
  {
    category: "Beauty",
    items: [
      { name: "Hydrating Cleanser", sku: "BEA-CLE-126", demand: 0.58, warehouseCount: 4, story: "Stable skincare staple with low spoilage risk.", accent: "#fb7185" },
      { name: "Vitamin C Serum", sku: "BEA-SER-513", demand: 0.89, warehouseCount: 3, story: "Fast-moving hero SKU with premium margin.", accent: "#f59e0b" },
      { name: "Retinol Night Cream", sku: "BEA-CRM-092", demand: 0.74, warehouseCount: 3, story: "High-demand treatment with replenishment alerts.", accent: "#f472b6" },
      { name: "Silk Hair Oil", sku: "BEA-OIL-334", demand: 0.47, warehouseCount: 4, story: "Accessory product with gentle seasonal lift.", accent: "#a78bfa" },
    ],
  },
  {
    category: "Home Essentials",
    items: [
      { name: "Microfiber Towel Set", sku: "HOM-TWL-421", demand: 0.54, warehouseCount: 5, story: "Volume mover for workplace and household bundles.", accent: "#34d399" },
      { name: "Smart Lamp", sku: "HOM-LMP-077", demand: 0.81, warehouseCount: 4, story: "Connected home product with strong add-on demand.", accent: "#38bdf8" },
      { name: "Modular Storage Bins", sku: "HOM-BIN-262", demand: 0.68, warehouseCount: 5, story: "Reliable utility item used for fulfillment bundles.", accent: "#f59e0b" },
      { name: "Air Purifier Filter Pack", sku: "HOM-FLT-190", demand: 0.93, warehouseCount: 3, story: "Critical replenishment SKU with recurring orders.", accent: "#22d3ee" },
    ],
  },
  {
    category: "Gaming",
    items: [
      { name: "Gaming Console", sku: "GAM-CON-901", demand: 0.97, warehouseCount: 3, story: "Traffic-driving hero SKU with immediate stock pressure.", accent: "#8b5cf6" },
      { name: "Pro Controller", sku: "GAM-CTL-311", demand: 0.85, warehouseCount: 4, story: "Accessory with high attach rate and strong turns.", accent: "#ec4899" },
      { name: "Mechanical Keypad", sku: "GAM-KPD-229", demand: 0.67, warehouseCount: 3, story: "Niche but stable SKU for competitive players.", accent: "#22c55e" },
      { name: "Capture Card 4K", sku: "GAM-CAP-408", demand: 0.71, warehouseCount: 3, story: "Creator-focused SKU with bursty demand patterns.", accent: "#38bdf8" },
    ],
  },
  {
    category: "Smart Devices",
    items: [
      { name: "Smart Speaker Max", sku: "SMD-SPK-582", demand: 0.83, warehouseCount: 4, story: "Voice-controlled device with regular promotional spikes.", accent: "#38bdf8" },
      { name: "Video Doorbell", sku: "SMD-DRB-204", demand: 0.79, warehouseCount: 3, story: "Security SKU with strong home-improvement demand.", accent: "#34d399" },
      { name: "Smart Thermostat", sku: "SMD-THM-516", demand: 0.76, warehouseCount: 3, story: "Energy-saving device with enterprise pilot interest.", accent: "#f97316" },
      { name: "Motion Sensor Pack", sku: "SMD-SNS-143", demand: 0.55, warehouseCount: 5, story: "Bundled add-on sold across support channels.", accent: "#a78bfa" },
    ],
  },
  {
    category: "Fitness",
    items: [
      { name: "Adjustable Dumbbells", sku: "FIT-DBL-618", demand: 0.87, warehouseCount: 4, story: "High-ticket equipment with strong home-gym demand.", accent: "#22d3ee" },
      { name: "Smart Scale", sku: "FIT-SCL-232", demand: 0.64, warehouseCount: 4, story: "Connected wellness SKU with steady turns.", accent: "#34d399" },
      { name: "Performance Yoga Mat", sku: "FIT-MAT-095", demand: 0.57, warehouseCount: 5, story: "Portable fitness product with broad audience.", accent: "#f472b6" },
      { name: "Recovery Resistance Bands", sku: "FIT-BND-407", demand: 0.73, warehouseCount: 4, story: "Accessory bundle item for wellness kits.", accent: "#f59e0b" },
    ],
  },
  {
    category: "Kitchen",
    items: [
      { name: "Air Fryer XL", sku: "KIT-AFR-661", demand: 0.9, warehouseCount: 3, story: "Demand-heavy appliance with tight availability.", accent: "#fb7185" },
      { name: "Stainless Pan Set", sku: "KIT-PAN-315", demand: 0.62, warehouseCount: 4, story: "Giftable cookware set with steady replenishment.", accent: "#38bdf8" },
      { name: "High-Speed Blender", sku: "KIT-BLD-188", demand: 0.78, warehouseCount: 3, story: "Premium kitchen SKU with recurring promotions.", accent: "#22c55e" },
      { name: "Knife Block Set", sku: "KIT-KNF-229", demand: 0.56, warehouseCount: 4, story: "Core kitchen assortment item with broad appeal.", accent: "#a78bfa" },
    ],
  },
  {
    category: "Books",
    items: [
      { name: "Systems Thinking for Builders", sku: "BKS-SYS-501", demand: 0.71, warehouseCount: 4, story: "Mindset title with strong interview-season resonance.", accent: "#38bdf8" },
      { name: "Deep Work Hardcover", sku: "BKS-DWK-102", demand: 0.82, warehouseCount: 4, story: "Popular productivity title with steady turnover.", accent: "#f59e0b" },
      { name: "Designing Data Products", sku: "BKS-DAT-344", demand: 0.59, warehouseCount: 3, story: "Technical nonfiction for analytics-heavy teams.", accent: "#a78bfa" },
      { name: "The Modern Operations Playbook", sku: "BKS-OPS-776", demand: 0.77, warehouseCount: 3, story: "Relevant ops title for engineering leaders.", accent: "#34d399" },
    ],
  },
];

function createProductImage(name: string, category: string, accent: string) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 3)
    .toUpperCase();

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="${name}">
      <defs>
        <linearGradient id="grad-${name.replace(/[^a-z0-9]/gi, "")}" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${accent}"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect rx="42" width="320" height="320" fill="url(#grad-${name.replace(/[^a-z0-9]/gi, "")})"/>
      <circle cx="248" cy="70" r="72" fill="rgba(255,255,255,0.14)"/>
      <circle cx="82" cy="244" r="94" fill="rgba(255,255,255,0.12)"/>
      <text x="32" y="58" fill="rgba(255,255,255,0.78)" font-family="Inter, Arial, sans-serif" font-size="22" letter-spacing="4">${category.toUpperCase()}</text>
      <text x="32" y="198" fill="white" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="700" letter-spacing="-4">${initials}</text>
      <text x="32" y="244" fill="rgba(255,255,255,0.75)" font-family="Inter, Arial, sans-serif" font-size="22">${name}</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function priorityForDemand(demand: number): InventoryPriority {
  if (demand >= 0.9) return "critical";
  if (demand >= 0.8) return "high";
  if (demand >= 0.65) return "medium";
  return "steady";
}

export const PRODUCT_CATALOG: ProductCatalogEntry[] = CATALOG_BLUEPRINTS.flatMap((group) =>
  group.items.map((item) => ({
    name: item.name,
    sku: item.sku,
    category: group.category,
    story: item.story,
    demand: item.demand,
    warehouseCount: item.warehouseCount,
    accent: item.accent,
    image: createProductImage(item.name, group.category, item.accent),
    priority: priorityForDemand(item.demand),
  }))
);

export function getProductCatalogEntry(name: string) {
  return PRODUCT_CATALOG.find((entry) => entry.name === name);
}

function weightDistribution(count: number, demand: number) {
  const startingPoint = demand > 0.8 ? 0.42 : demand > 0.65 ? 0.38 : 0.34;
  const spread = demand > 0.8 ? 0.18 : 0.14;
  return Array.from({ length: count }, (_, index) => Math.max(0.12, startingPoint - index * spread));
}

function normalizeShares(total: number, count: number, demand: number) {
  const weights = weightDistribution(count, demand);
  const weightSum = weights.reduce((sum, current) => sum + current, 0);
  const raw = weights.map((weight) => Math.max(6, Math.round((total * weight) / weightSum)));
  const diff = total - raw.reduce((sum, current) => sum + current, 0);
  raw[0] += diff;
  return raw.map((value) => Math.max(4, value));
}

export function buildInventoryMatrix(
  catalog: ProductCatalogEntry[] = PRODUCT_CATALOG,
  warehouses: WarehouseProfile[] = WAREHOUSE_PROFILES
): InventoryBlueprint[] {
  const rows: InventoryBlueprint[] = [];

  catalog.forEach((product, index) => {
    const activeCount = Math.min(product.warehouseCount, warehouses.length);
    const startIndex = index % warehouses.length;
    const activeWarehouses = Array.from({ length: activeCount }, (_, offset) => warehouses[(startIndex + offset) % warehouses.length]);

    const categoryBoost =
      product.category === "Electronics" || product.category === "Gaming" || product.category === "Smart Devices"
        ? 48
        : product.category === "Groceries" || product.category === "Home Essentials"
          ? 58
          : 34;

    const totalStock = Math.max(24, Math.round(categoryBoost + product.demand * 132 + (index % 4) * 6));
    const shares = normalizeShares(totalStock, activeWarehouses.length, product.demand);

    shares.forEach((share, shareIndex) => {
      const reservedRatio = product.demand >= 0.9 ? 0.36 : product.demand >= 0.8 ? 0.27 : product.demand >= 0.65 ? 0.18 : 0.1;
      const reservedStock = Math.min(share - 1, Math.max(0, Math.round(share * reservedRatio) + (shareIndex === 0 && product.priority !== "steady" ? 2 : 0)));

      rows.push({
        productName: product.name,
        warehouseName: activeWarehouses[shareIndex].name,
        totalStock: share,
        reservedStock,
      });
    });
  });

  return rows;
}

export function buildReservationBlueprints() {
  const selected = PRODUCT_CATALOG.filter((entry) => entry.priority !== "steady").slice(0, 12);

  return [
    { productName: selected[0].name, warehouseName: WAREHOUSE_PROFILES[0].name, quantity: 2, action: "pending", status: "PENDING", expiresOffsetMinutes: 11 },
    { productName: selected[1].name, warehouseName: WAREHOUSE_PROFILES[1].name, quantity: 1, action: "confirm", status: "CONFIRMED", expiresOffsetMinutes: 9 },
    { productName: selected[2].name, warehouseName: WAREHOUSE_PROFILES[2].name, quantity: 3, action: "release", status: "RELEASED", expiresOffsetMinutes: 6 },
    { productName: selected[3].name, warehouseName: WAREHOUSE_PROFILES[3].name, quantity: 2, action: "pending", status: "PENDING", expiresOffsetMinutes: 8 },
    { productName: selected[4].name, warehouseName: WAREHOUSE_PROFILES[4].name, quantity: 4, action: "confirm", status: "CONFIRMED", expiresOffsetMinutes: 10 },
    { productName: selected[5].name, warehouseName: WAREHOUSE_PROFILES[0].name, quantity: 1, action: "release", status: "RELEASED", expiresOffsetMinutes: 5 },
    { productName: selected[6].name, warehouseName: WAREHOUSE_PROFILES[2].name, quantity: 2, action: "pending", status: "PENDING", expiresOffsetMinutes: 7 },
    { productName: selected[7].name, warehouseName: WAREHOUSE_PROFILES[3].name, quantity: 5, action: "confirm", status: "CONFIRMED", expiresOffsetMinutes: 12 },
    { productName: selected[8].name, warehouseName: WAREHOUSE_PROFILES[4].name, quantity: 1, action: "release", status: "RELEASED", expiresOffsetMinutes: 4 },
    { productName: selected[9].name, warehouseName: WAREHOUSE_PROFILES[1].name, quantity: 3, action: "pending", status: "PENDING", expiresOffsetMinutes: 6 },
    { productName: selected[10].name, warehouseName: WAREHOUSE_PROFILES[2].name, quantity: 2, action: "confirm", status: "CONFIRMED", expiresOffsetMinutes: 9 },
    { productName: selected[11].name, warehouseName: WAREHOUSE_PROFILES[3].name, quantity: 2, action: "release", status: "RELEASED", expiresOffsetMinutes: 5 },
  ] satisfies ReservationBlueprint[];
}

export function buildInventoryInsights(products: Array<{ name: string; category?: string; inventory: Array<{ availableStock: number; totalStock: number; reservedStock: number; warehouse: { name: string } }> }>, reservations: Array<{ id: string; status: string; inventory?: { product: { name: string }; warehouse: { name: string } }; createdAt: string; expiresAt: string }>): ProductInsight[] {
  const lowStock = products
    .flatMap((product) =>
      product.inventory.map((item) => ({
        productName: product.name,
        available: item.availableStock,
        total: item.totalStock,
        warehouse: item.warehouse.name,
      }))
    )
    .filter((item) => item.available / Math.max(1, item.total) <= 0.2)
    .sort((a, b) => a.available - b.available)
    .slice(0, 3);

  const hotProduct = products
    .map((product) => {
      const inventory = product.inventory.reduce(
        (sum, item) => ({
          available: sum.available + item.availableStock,
          reserved: sum.reserved + item.reservedStock,
          total: sum.total + item.totalStock,
        }),
        { available: 0, reserved: 0, total: 0 }
      );

      return {
        productName: product.name,
        pressure: inventory.reserved / Math.max(1, inventory.total),
        available: inventory.available,
        total: inventory.total,
      };
    })
    .sort((a, b) => b.pressure - a.pressure)[0];

  const warehousePressure = new Map<string, number>();
  for (const product of products) {
    for (const item of product.inventory) {
      const pressure = item.reservedStock / Math.max(1, item.totalStock);
      warehousePressure.set(item.warehouse.name, (warehousePressure.get(item.warehouse.name) ?? 0) + pressure);
    }
  }

  const hotWarehouse = Array.from(warehousePressure.entries()).sort((a, b) => b[1] - a[1])[0];
  const pendingReservations = reservations.filter((reservation) => reservation.status === "PENDING").length;

  return [
    {
      title: "Stock pressure",
      detail: lowStock.length
        ? `${lowStock.map((item) => `${item.productName} in ${item.warehouse}`).join(", ")} are hovering at reorder thresholds.`
        : "Inventory is comfortably above reorder thresholds across the catalog.",
      tone: lowStock.length ? "warning" : "positive",
    },
    {
      title: "Demand concentration",
      detail: hotProduct
        ? `${hotProduct.productName} is carrying the highest stock pressure with ${(hotProduct.pressure * 100).toFixed(0)}% of inventory reserved.`
        : "Demand is evenly distributed across the active catalog.",
      tone: hotProduct && hotProduct.pressure > 0.3 ? "critical" : "neutral",
    },
    {
      title: "Warehouse focus",
      detail: hotWarehouse
        ? `${hotWarehouse[0]} is the most constrained node right now and should get the next transfer cycle.`
        : "Warehouse pressure is balanced.",
      tone: hotWarehouse ? "warning" : "neutral",
    },
    {
      title: "Checkout flow",
      detail: `${pendingReservations} reservations are still awaiting payment confirmation, which keeps the checkout stream active.`,
      tone: pendingReservations > 4 ? "warning" : "positive",
    },
  ];
}

export function interpretInventoryQuery(
  query: string,
  products: Array<{ name: string; category?: string; sku?: string; inventory: Array<{ availableStock: number; reservedStock: number; totalStock: number; warehouse: { name: string } }> }>,
  reservations: Array<{ id: string; status: string; inventory?: { product: { name: string }; warehouse: { name: string } } }>
): SearchResultSummary {
  const normalized = query.trim().toLowerCase();

  const matchedProducts = products.filter((product) => {
    const available = product.inventory.reduce((sum, item) => sum + item.availableStock, 0);
    const reserved = product.inventory.reduce((sum, item) => sum + item.reservedStock, 0);

    if (normalized.includes("low stock")) {
      return product.inventory.some((item) => item.availableStock <= 10 || item.availableStock / Math.max(1, item.totalStock) <= 0.2);
    }

    if (normalized.includes("high demand") || normalized.includes("trending")) {
      return reserved / Math.max(1, available + reserved) >= 0.15;
    }

    if (normalized.includes("electronics")) return product.category === "Electronics";
    if (normalized.includes("fashion")) return product.category === "Fashion";
    if (normalized.includes("groceries")) return product.category === "Groceries";
    if (normalized.includes("beauty")) return product.category === "Beauty";
    if (normalized.includes("home")) return product.category === "Home Essentials";
    if (normalized.includes("gaming")) return product.category === "Gaming";
    if (normalized.includes("smart")) return product.category === "Smart Devices";
    if (normalized.includes("fitness")) return product.category === "Fitness";
    if (normalized.includes("kitchen")) return product.category === "Kitchen";
    if (normalized.includes("books")) return product.category === "Books";

    return product.name.toLowerCase().includes(normalized);
  });

  const matchedReservations = reservations.filter((reservation) => {
    if (normalized.includes("pending")) return reservation.status === "PENDING";
    if (normalized.includes("confirmed")) return reservation.status === "CONFIRMED";
    if (normalized.includes("released")) return reservation.status === "RELEASED";
    if (normalized.includes("warehouse")) return Boolean(reservation.inventory?.warehouse.name.toLowerCase().includes(normalized.replace("which ", "")));
    return false;
  });

  if (!normalized) {
    return {
      label: "Browse mode",
      message: "The platform is ready for natural-language inventory exploration.",
      productNames: matchedProducts.slice(0, 8).map((product) => product.name),
      reservationIds: matchedReservations.slice(0, 6).map((reservation) => reservation.id),
    };
  }

  if (normalized.includes("pending reservations")) {
    return {
      label: "Reservation queue",
      message: `There are ${matchedReservations.length} pending reservations in the current stream.`,
      productNames: matchedProducts.slice(0, 6).map((product) => product.name),
      reservationIds: matchedReservations.slice(0, 8).map((reservation) => reservation.id),
    };
  }

  if (normalized.includes("low stock")) {
    return {
      label: "Low stock view",
      message: `${matchedProducts.length} products match the low-stock threshold and need attention.`,
      productNames: matchedProducts.slice(0, 10).map((product) => product.name),
      reservationIds: matchedReservations.slice(0, 6).map((reservation) => reservation.id),
    };
  }

  return {
    label: "Smart search",
    message: matchedProducts.length
      ? `Found ${matchedProducts.length} products matching your request.`
      : `I translated that query into a warehouse or reservation focus, but no products matched directly.`,
    productNames: matchedProducts.slice(0, 8).map((product) => product.name),
    reservationIds: matchedReservations.slice(0, 6).map((reservation) => reservation.id),
  };
}

export function answerOperationsQuestion(
  query: string,
  products: Array<{ name: string; category?: string; inventory: Array<{ availableStock: number; reservedStock: number; totalStock: number; warehouse: { name: string } }> }>,
  reservations: Array<{ status: string; inventory?: { product: { name: string }; warehouse: { name: string } } }>
) {
  const normalized = query.trim().toLowerCase();
  const pending = reservations.filter((reservation) => reservation.status === "PENDING").length;
  const available = products.reduce((sum, product) => sum + product.inventory.reduce((inner, item) => inner + item.availableStock, 0), 0);

  if (normalized.includes("low stock")) {
    const scarce = products
      .flatMap((product) => product.inventory.map((item) => ({ product: product.name, warehouse: item.warehouse.name, available: item.availableStock })))
      .filter((item) => item.available <= 10)
      .slice(0, 3);
    return scarce.length
      ? `${scarce.map((item) => `${item.product} in ${item.warehouse}`).join(", ")} are the most urgent replenishment candidates.`
      : "No inventory is currently below the operational threshold.";
  }

  if (normalized.includes("most pending reservations")) {
    const byWarehouse = new Map<string, number>();
    for (const reservation of reservations) {
      if (reservation.status !== "PENDING" || !reservation.inventory) continue;
      byWarehouse.set(reservation.inventory.warehouse.name, (byWarehouse.get(reservation.inventory.warehouse.name) ?? 0) + 1);
    }
    const leader = Array.from(byWarehouse.entries()).sort((a, b) => b[1] - a[1])[0];
    return leader ? `${leader[0]} currently has the largest pending reservation queue with ${leader[1]} open holds.` : "Pending reservations are evenly distributed right now.";
  }

  if (normalized.includes("warehouse")) {
    return `There are ${WAREHOUSE_PROFILES.length} live warehouse nodes and ${pending} pending checkout holds across the network.`;
  }

  if (normalized.includes("concurrency") || normalized.includes("stress")) {
    return "The reservation flow uses transactional stock locking, so concurrent requests either commit cleanly or fail fast with a 409 conflict.";
  }

  return `Operations are healthy: ${available.toLocaleString()} units are available and ${pending} reservations are still in the checkout window.`;
}
