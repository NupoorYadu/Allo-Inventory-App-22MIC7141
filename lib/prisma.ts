import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

type DemoWarehouse = {
  id: string;
  name: string;
};

type DemoInventory = {
  id: string;
  productId: string;
  warehouseId: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  warehouse: DemoWarehouse;
};

type DemoProduct = {
  id: string;
  name: string;
  createdAt: string;
  inventory: DemoInventory[];
};

type DemoReservation = {
  id: string;
  inventoryId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  inventory: {
    id: string;
    product: {
      id: string;
      name: string;
    };
    warehouse: DemoWarehouse;
  };
};

type DemoReservationSeed = {
  id: string;
  productName: string;
  warehouseName: string;
  quantity: number;
  status: DemoReservation["status"];
  createdMinutesAgo: number;
  expiresMinutesAhead: number;
};

type DemoSnapshot = {
  warehouses: DemoWarehouse[];
  products: DemoProduct[];
  reservations: DemoReservation[];
};

const warehouseNames = ["Chennai", "Bangalore", "Hyderabad", "Mumbai", "Pune"] as const;
const productNames = [
  "Laptop Pro 16",
  "Wireless Headphones",
  "USB-C Hub",
  "Mechanical Keyboard",
  "4K Monitor",
  "Ergonomic Mouse",
  "Portable SSD",
  "Webcam Pro",
  "Docking Station",
  "Noise-Canceling Earbuds",
  "Thunderbolt Cable",
  "Smart Charger",
] as const;

const stockMatrix = [
  [120, 99, 80, 75, 88],
  [440, 448, 320, 300, 360],
  [260, 280, 240, 250, 270],
  [210, 205, 195, 188, 202],
  [110, 105, 115, 98, 108],
  [390, 440, 410, 398, 412],
  [240, 247, 220, 210, 232],
  [180, 190, 165, 172, 176],
  [150, 145, 138, 142, 148],
  [280, 290, 260, 275, 268],
  [560, 540, 520, 505, 518],
  [380, 395, 360, 352, 368],
] as const;

const reservationSeeds: DemoReservationSeed[] = [
  { id: "demo-reservation-1", productName: "Wireless Headphones", warehouseName: "Bangalore", quantity: 2, status: "PENDING", createdMinutesAgo: 14, expiresMinutesAhead: 6 },
  { id: "demo-reservation-2", productName: "Laptop Pro 16", warehouseName: "Chennai", quantity: 1, status: "CONFIRMED", createdMinutesAgo: 88, expiresMinutesAhead: 0 },
  { id: "demo-reservation-3", productName: "USB-C Hub", warehouseName: "Mumbai", quantity: 3, status: "RELEASED", createdMinutesAgo: 52, expiresMinutesAhead: 0 },
  { id: "demo-reservation-4", productName: "Mechanical Keyboard", warehouseName: "Hyderabad", quantity: 1, status: "CONFIRMED", createdMinutesAgo: 26, expiresMinutesAhead: 0 },
  { id: "demo-reservation-5", productName: "Portable SSD", warehouseName: "Pune", quantity: 2, status: "PENDING", createdMinutesAgo: 9, expiresMinutesAhead: 11 },
  { id: "demo-reservation-6", productName: "4K Monitor", warehouseName: "Chennai", quantity: 1, status: "RELEASED", createdMinutesAgo: 41, expiresMinutesAhead: 0 },
  { id: "demo-reservation-7", productName: "Noise-Canceling Earbuds", warehouseName: "Bangalore", quantity: 1, status: "CONFIRMED", createdMinutesAgo: 70, expiresMinutesAhead: 0 },
  { id: "demo-reservation-8", productName: "Smart Charger", warehouseName: "Mumbai", quantity: 2, status: "PENDING", createdMinutesAgo: 19, expiresMinutesAhead: 8 },
];

const demoState = createDemoState();
const demoIdempotencyResults = new Map<string, { status: number; data: DemoReservation | { error: string } }>();
let nextDemoReservationNumber = 1000 + reservationSeeds.length + 1;

function makeDemoCuid(index: number) {
  return `c${String(index).padStart(24, "0")}`;
}

function createDemoState(): DemoSnapshot {
  const warehouses = warehouseNames.map((name, index) => ({
    id: `demo-warehouse-${index + 1}`,
    name,
  }));

  const products = productNames.map((name, index) => ({
    id: `demo-product-${index + 1}`,
    name,
    createdAt: new Date(Date.now() - (index + 1) * 60_000).toISOString(),
    inventory: [] as DemoInventory[],
  }));

  products.forEach((product, productIndex) => {
    product.inventory = warehouses.map((warehouse, warehouseIndex) => {
      const totalStock = stockMatrix[productIndex]?.[warehouseIndex] ?? 100;
      const reservedStock =
        (productIndex % 4 === 0 && warehouseIndex === 0 ? 1 : 0) +
        (productIndex % 5 === 0 && warehouseIndex === 1 ? 2 : 0) +
        (productIndex % 6 === 0 && warehouseIndex === 2 ? 1 : 0) +
        (productIndex % 7 === 0 && warehouseIndex === 3 ? 1 : 0) +
        (productIndex % 3 === 0 && warehouseIndex === 4 ? 1 : 0);

      return {
        id: makeDemoCuid(productIndex * 10 + warehouseIndex + 1),
        productId: product.id,
        warehouseId: warehouse.id,
        totalStock,
        reservedStock,
        availableStock: totalStock - reservedStock,
        warehouse,
      };
    });
  });

  const reservations = reservationSeeds
    .map((reservationSeed, index) => {
      const product = products.find((item) => item.name === reservationSeed.productName);
      if (!product) return null;

      const inventory = product.inventory.find((item) => item.warehouse.name === reservationSeed.warehouseName);
      if (!inventory) return null;

      const createdAt = new Date(Date.now() - reservationSeed.createdMinutesAgo * 60_000);
      const updatedAt = reservationSeed.status === "PENDING" ? createdAt : new Date(createdAt.getTime() + 5 * 60_000);
      const expiresAt = new Date(createdAt.getTime() + (reservationSeed.expiresMinutesAhead || 10) * 60_000);

      return {
        id: makeDemoCuid(1000 + index + 1),
        inventoryId: inventory.id,
        quantity: reservationSeed.quantity,
        status: reservationSeed.status,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        inventory: {
          id: inventory.id,
          product: {
            id: product.id,
            name: product.name,
          },
          warehouse: inventory.warehouse,
        },
      };
    })
    .filter(Boolean) as DemoReservation[];

  return { warehouses, products, reservations };
}

function cloneDemoSnapshot(): DemoSnapshot {
  return {
    warehouses: demoState.warehouses.map((warehouse) => ({ ...warehouse })),
    products: demoState.products.map((product) => ({
      ...product,
      inventory: product.inventory.map((inventory) => ({
        ...inventory,
        warehouse: { ...inventory.warehouse },
      })),
    })),
    reservations: demoState.reservations.map((reservation) => ({
      ...reservation,
      inventory: {
        ...reservation.inventory,
        product: { ...reservation.inventory.product },
        warehouse: { ...reservation.inventory.warehouse },
      },
    })),
  };
}

function findDemoInventory(inventoryId: string) {
  for (const product of demoState.products) {
    const inventory = product.inventory.find((item) => item.id === inventoryId);
    if (inventory) return { product, inventory };
  }

  return null;
}

function cloneDemoReservation(reservation: DemoReservation): DemoReservation {
  return {
    ...reservation,
    inventory: {
      ...reservation.inventory,
      product: { ...reservation.inventory.product },
      warehouse: { ...reservation.inventory.warehouse },
    },
  };
}

export async function fallbackProducts() {
  return cloneDemoSnapshot().products;
}

export async function fallbackReservations() {
  return cloneDemoSnapshot().reservations;
}

export async function fallbackWarehouses() {
  return cloneDemoSnapshot().warehouses;
}

export async function fallbackReserveInventory(
  inventoryId: string,
  quantity: number,
  idempotencyKey?: string
) {
  if (idempotencyKey) {
    const cached = demoIdempotencyResults.get(idempotencyKey);
    if (cached) return cached;
  }

  const found = findDemoInventory(inventoryId);
  if (!found) {
    const response = { status: 404, data: { error: "Inventory not found" } };
    if (idempotencyKey) demoIdempotencyResults.set(idempotencyKey, response);
    return response;
  }

  const { product, inventory } = found;
  const availableStock = inventory.totalStock - inventory.reservedStock;
  if (availableStock < quantity) {
    const response = { status: 409, data: { error: "Insufficient stock available" } };
    if (idempotencyKey) demoIdempotencyResults.set(idempotencyKey, response);
    return response;
  }

  inventory.reservedStock += quantity;
  const now = new Date();
  const reservation: DemoReservation = {
    id: makeDemoCuid(nextDemoReservationNumber++),
    inventoryId,
    quantity,
    status: "PENDING",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    inventory: {
      id: inventory.id,
      product: {
        id: product.id,
        name: product.name,
      },
      warehouse: { ...inventory.warehouse },
    },
  };

  demoState.reservations.unshift(reservation);
  const response = { status: 201, data: cloneDemoReservation(reservation) };
  if (idempotencyKey) demoIdempotencyResults.set(idempotencyKey, response);
  return response;
}

export async function fallbackConfirmReservation(reservationId: string) {
  const reservation = demoState.reservations.find((item) => item.id === reservationId);
  if (!reservation) return { status: 404, data: { error: "Reservation not found" } };
  if (reservation.status !== "PENDING") return { status: 400, data: { error: "Reservation is no longer pending" } };
  if (new Date() > new Date(reservation.expiresAt)) return { status: 410, data: { error: "Reservation has expired" } };

  const found = findDemoInventory(reservation.inventoryId);
  if (!found) return { status: 404, data: { error: "Inventory not found" } };

  found.inventory.totalStock -= reservation.quantity;
  found.inventory.reservedStock -= reservation.quantity;
  found.inventory.availableStock = found.inventory.totalStock - found.inventory.reservedStock;
  reservation.status = "CONFIRMED";
  reservation.updatedAt = new Date().toISOString();

  return { status: 200, data: cloneDemoReservation(reservation) };
}

export async function fallbackReleaseReservation(reservationId: string) {
  const reservation = demoState.reservations.find((item) => item.id === reservationId);
  if (!reservation) return { status: 404, data: { error: "Reservation not found" } };
  if (reservation.status !== "PENDING") return { status: 400, data: { error: "Reservation is no longer pending" } };

  const found = findDemoInventory(reservation.inventoryId);
  if (!found) return { status: 404, data: { error: "Inventory not found" } };

  found.inventory.reservedStock -= reservation.quantity;
  found.inventory.availableStock = found.inventory.totalStock - found.inventory.reservedStock;
  reservation.status = "RELEASED";
  reservation.updatedAt = new Date().toISOString();

  return { status: 200, data: cloneDemoReservation(reservation) };
}
