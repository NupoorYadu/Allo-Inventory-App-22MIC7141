import type { PrismaClient } from "@prisma/client";

const demoWarehouses = [
  "New York",
  "Los Angeles",
  "London",
  "Berlin",
  "Singapore",
];

const demoProducts = [
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
];

const inventoryMatrix = [
  { product: "Laptop Pro 16", warehouse: "New York", totalStock: 50 },
  { product: "Laptop Pro 16", warehouse: "Los Angeles", totalStock: 30 },
  { product: "Laptop Pro 16", warehouse: "London", totalStock: 20 },
  { product: "Wireless Headphones", warehouse: "New York", totalStock: 200 },
  { product: "Wireless Headphones", warehouse: "Los Angeles", totalStock: 150 },
  { product: "Wireless Headphones", warehouse: "London", totalStock: 100 },
  { product: "USB-C Hub", warehouse: "New York", totalStock: 500 },
  { product: "USB-C Hub", warehouse: "Los Angeles", totalStock: 400 },
  { product: "USB-C Hub", warehouse: "Berlin", totalStock: 180 },
  { product: "Mechanical Keyboard", warehouse: "New York", totalStock: 120 },
  { product: "Mechanical Keyboard", warehouse: "Berlin", totalStock: 90 },
  { product: "4K Monitor", warehouse: "Los Angeles", totalStock: 65 },
  { product: "4K Monitor", warehouse: "Singapore", totalStock: 40 },
  { product: "Ergonomic Mouse", warehouse: "New York", totalStock: 260 },
  { product: "Ergonomic Mouse", warehouse: "London", totalStock: 180 },
  { product: "Portable SSD", warehouse: "Singapore", totalStock: 140 },
  { product: "Portable SSD", warehouse: "Berlin", totalStock: 110 },
  { product: "Webcam Pro", warehouse: "New York", totalStock: 95 },
  { product: "Webcam Pro", warehouse: "Los Angeles", totalStock: 85 },
  { product: "Docking Station", warehouse: "Berlin", totalStock: 70 },
  { product: "Docking Station", warehouse: "Singapore", totalStock: 75 },
  { product: "Noise-Canceling Earbuds", warehouse: "London", totalStock: 160 },
  { product: "Noise-Canceling Earbuds", warehouse: "Singapore", totalStock: 130 },
  { product: "Thunderbolt Cable", warehouse: "New York", totalStock: 300 },
  { product: "Thunderbolt Cable", warehouse: "Los Angeles", totalStock: 240 },
  { product: "Smart Charger", warehouse: "Berlin", totalStock: 210 },
  { product: "Smart Charger", warehouse: "Singapore", totalStock: 190 },
];

const sampleReservations = [
  { product: "Laptop Pro 16", warehouse: "New York", quantity: 1, status: "CONFIRMED", expiresOffsetMinutes: 10, action: "confirm" as const },
  { product: "Wireless Headphones", warehouse: "London", quantity: 2, status: "PENDING", expiresOffsetMinutes: 7, action: "pending" as const },
  { product: "USB-C Hub", warehouse: "Berlin", quantity: 4, status: "RELEASED", expiresOffsetMinutes: 4, action: "release" as const },
  { product: "Mechanical Keyboard", warehouse: "Berlin", quantity: 1, status: "CONFIRMED", expiresOffsetMinutes: 8, action: "confirm" as const },
  { product: "Portable SSD", warehouse: "Singapore", quantity: 3, status: "PENDING", expiresOffsetMinutes: 6, action: "pending" as const },
  { product: "Docking Station", warehouse: "Singapore", quantity: 2, status: "RELEASED", expiresOffsetMinutes: 5, action: "release" as const },
  { product: "Smart Charger", warehouse: "Berlin", quantity: 5, status: "CONFIRMED", expiresOffsetMinutes: 9, action: "confirm" as const },
  { product: "Thunderbolt Cable", warehouse: "Los Angeles", quantity: 6, status: "RELEASED", expiresOffsetMinutes: 3, action: "release" as const },
];

async function ensureWarehouse(prisma: PrismaClient, name: string) {
  const existing = await prisma.warehouse.findFirst({ where: { name } });
  if (existing) return existing;

  return prisma.warehouse.create({ data: { name } });
}

async function ensureProduct(prisma: PrismaClient, name: string) {
  const existing = await prisma.product.findFirst({ where: { name } });
  if (existing) return existing;

  return prisma.product.create({ data: { name } });
}

export async function seedDemoData(prisma: PrismaClient) {
  const warehouses = new Map<string, Awaited<ReturnType<typeof ensureWarehouse>>>();
  const products = new Map<string, Awaited<ReturnType<typeof ensureProduct>>>();

  for (const warehouseName of demoWarehouses) {
    const warehouse = await ensureWarehouse(prisma, warehouseName);
    warehouses.set(warehouseName, warehouse);
  }

  for (const productName of demoProducts) {
    const product = await ensureProduct(prisma, productName);
    products.set(productName, product);
  }

  for (const item of inventoryMatrix) {
    const product = products.get(item.product)!;
    const warehouse = warehouses.get(item.warehouse)!;

    await prisma.inventory.upsert({
      where: {
        productId_warehouseId: {
          productId: product.id,
          warehouseId: warehouse.id,
        },
      },
      create: {
        productId: product.id,
        warehouseId: warehouse.id,
        totalStock: item.totalStock,
        reservedStock: 0,
      },
      update: {
        totalStock: item.totalStock,
      },
    });
  }

  const inventoryByKey = new Map<string, { id: string; totalStock: number; reservedStock: number }>();
  for (const inventory of await prisma.inventory.findMany()) {
    inventoryByKey.set(`${inventory.productId}:${inventory.warehouseId}`, inventory);
  }

  for (const reservation of sampleReservations) {
    const product = products.get(reservation.product)!;
    const warehouse = warehouses.get(reservation.warehouse)!;
    const inventory = inventoryByKey.get(`${product.id}:${warehouse.id}`)!;
    const expiresAt = new Date(Date.now() + reservation.expiresOffsetMinutes * 60 * 1000);

    if (reservation.action === "pending") {
      await prisma.$transaction(async (tx) => {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { reservedStock: { increment: reservation.quantity } },
        });

        await tx.reservation.create({
          data: {
            inventoryId: inventory.id,
            quantity: reservation.quantity,
            status: "PENDING",
            expiresAt,
          },
        });
      });
      continue;
    }

    if (reservation.action === "confirm") {
      await prisma.$transaction(async (tx) => {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            totalStock: { decrement: reservation.quantity },
          },
        });

        await tx.reservation.create({
          data: {
            inventoryId: inventory.id,
            quantity: reservation.quantity,
            status: "CONFIRMED",
            expiresAt,
          },
        });
      });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.inventory.update({
        where: { id: inventory.id },
        data: { reservedStock: { increment: reservation.quantity } },
      });

      await tx.reservation.create({
        data: {
          inventoryId: inventory.id,
          quantity: reservation.quantity,
          status: "RELEASED",
          expiresAt,
        },
      });

      await tx.inventory.update({
        where: { id: inventory.id },
        data: { reservedStock: { decrement: reservation.quantity } },
      });
    });
  }

  return {
    warehouses: await prisma.warehouse.count(),
    products: await prisma.product.count(),
    inventories: await prisma.inventory.count(),
    reservations: await prisma.reservation.count(),
  };
}