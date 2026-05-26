import type { PrismaClient } from "@prisma/client";
import {
  buildInventoryMatrix,
  buildReservationBlueprints,
  PRODUCT_CATALOG,
  WAREHOUSE_PROFILES,
} from "@/lib/inventory-catalog";

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

  for (const warehouse of WAREHOUSE_PROFILES) {
    const ensuredWarehouse = await ensureWarehouse(prisma, warehouse.name);
    warehouses.set(warehouse.name, ensuredWarehouse);
  }

  for (const product of PRODUCT_CATALOG) {
    const ensuredProduct = await ensureProduct(prisma, product.name);
    products.set(product.name, ensuredProduct);
  }

  for (const item of buildInventoryMatrix()) {
    const product = products.get(item.productName)!;
    const warehouse = warehouses.get(item.warehouseName)!;

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
        reservedStock: item.reservedStock,
      },
      update: {
        totalStock: item.totalStock,
        reservedStock: item.reservedStock,
      },
    });
  }

  const inventoryByKey = new Map<string, { id: string; totalStock: number; reservedStock: number }>();
  for (const inventory of await prisma.inventory.findMany()) {
    inventoryByKey.set(`${inventory.productId}:${inventory.warehouseId}`, inventory);
  }

  for (const reservation of buildReservationBlueprints()) {
    const product = products.get(reservation.productName)!;
    const warehouse = warehouses.get(reservation.warehouseName)!;
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
          data: { totalStock: { decrement: reservation.quantity } },
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