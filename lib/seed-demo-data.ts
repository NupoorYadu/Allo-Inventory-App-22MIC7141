import type { PrismaClient } from "@prisma/client";

const demoWarehouses = ["New York", "Los Angeles", "London"];
const demoProducts = ["Laptop Pro 16", "Wireless Headphones", "USB-C Hub"];

const inventoryMatrix = [
  { product: "Laptop Pro 16", warehouse: "New York", totalStock: 50 },
  { product: "Laptop Pro 16", warehouse: "Los Angeles", totalStock: 30 },
  { product: "Wireless Headphones", warehouse: "New York", totalStock: 200 },
  { product: "Wireless Headphones", warehouse: "Los Angeles", totalStock: 150 },
  { product: "Wireless Headphones", warehouse: "London", totalStock: 100 },
  { product: "USB-C Hub", warehouse: "New York", totalStock: 500 },
  { product: "USB-C Hub", warehouse: "Los Angeles", totalStock: 400 },
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

  return {
    warehouses: await prisma.warehouse.count(),
    products: await prisma.product.count(),
    inventories: await prisma.inventory.count(),
  };
}