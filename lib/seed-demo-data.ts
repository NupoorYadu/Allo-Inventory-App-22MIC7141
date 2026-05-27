import type { PrismaClient } from "@prisma/client";
import { addMinutes, subMinutes } from "date-fns";

type SeedSummary = {
  warehouses: number;
  products: number;
  inventories: number;
  reservations: number;
};

export async function seedDemoData(prisma: PrismaClient): Promise<SeedSummary> {
  await prisma.$transaction(async (tx) => {
    await tx.reservation.deleteMany();
    await tx.inventory.deleteMany();
    await tx.product.deleteMany();
    await tx.warehouse.deleteMany();
    await tx.idempotencyKey.deleteMany();

    await tx.warehouse.createMany({
      data: [
        { name: "Chennai" },
        { name: "Bangalore" },
        { name: "Hyderabad" },
        { name: "Mumbai" },
        { name: "Pune" },
      ],
    });

    const createdWarehouses = await tx.warehouse.findMany({ orderBy: { name: "asc" } });

    await tx.product.createMany({
      data: [
        { name: "Laptop Pro 16" },
        { name: "Wireless Headphones" },
        { name: "USB-C Hub" },
        { name: "Mechanical Keyboard" },
        { name: "4K Monitor" },
        { name: "Ergonomic Mouse" },
        { name: "Portable SSD" },
        { name: "Webcam Pro" },
        { name: "Docking Station" },
        { name: "Noise-Canceling Earbuds" },
        { name: "Thunderbolt Cable" },
        { name: "Smart Charger" },
      ],
    });

    const createdProducts = await tx.product.findMany({ orderBy: { name: "asc" } });

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
    ];

    const inventories = [] as Array<{ id: string; productId: string; warehouseId: string; totalStock: number; reservedStock: number }>;

    for (const [productIndex, product] of createdProducts.entries()) {
      for (const [warehouseIndex, warehouse] of createdWarehouses.entries()) {
        const totalStock = stockMatrix[productIndex]?.[warehouseIndex] ?? 100;
        const reservedStock =
          productIndex % 4 === 0 && warehouseIndex === 0 ? 1 :
          productIndex % 5 === 0 && warehouseIndex === 1 ? 2 :
          productIndex % 6 === 0 && warehouseIndex === 2 ? 1 :
          productIndex % 7 === 0 && warehouseIndex === 3 ? 1 :
          productIndex % 3 === 0 && warehouseIndex === 4 ? 1 : 0;

        const inventory = await tx.inventory.create({
          data: {
            productId: product.id,
            warehouseId: warehouse.id,
            totalStock,
            reservedStock,
          },
        });

        inventories.push(inventory);
      }
    }

    const seedReservations = [
      { productName: "Wireless Headphones", warehouseName: "Bangalore", quantity: 2, status: "PENDING", createdMinutesAgo: 14, expiresMinutesAhead: 6 },
      { productName: "Laptop Pro 16", warehouseName: "Chennai", quantity: 1, status: "CONFIRMED", createdMinutesAgo: 88, expiresMinutesAhead: 0 },
      { productName: "USB-C Hub", warehouseName: "Mumbai", quantity: 3, status: "RELEASED", createdMinutesAgo: 52, expiresMinutesAhead: 0 },
      { productName: "Mechanical Keyboard", warehouseName: "Hyderabad", quantity: 1, status: "CONFIRMED", createdMinutesAgo: 26, expiresMinutesAhead: 0 },
      { productName: "Portable SSD", warehouseName: "Pune", quantity: 2, status: "PENDING", createdMinutesAgo: 9, expiresMinutesAhead: 11 },
      { productName: "4K Monitor", warehouseName: "Chennai", quantity: 1, status: "RELEASED", createdMinutesAgo: 41, expiresMinutesAhead: 0 },
      { productName: "Noise-Canceling Earbuds", warehouseName: "Bangalore", quantity: 1, status: "CONFIRMED", createdMinutesAgo: 70, expiresMinutesAhead: 0 },
      { productName: "Smart Charger", warehouseName: "Mumbai", quantity: 2, status: "PENDING", createdMinutesAgo: 19, expiresMinutesAhead: 8 },
    ] as const;

    for (const reservationSeed of seedReservations) {
      const product = createdProducts.find((item) => item.name === reservationSeed.productName);
      const inventory = inventories.find((item) => item.productId === product?.id && createdWarehouses.find((warehouse) => warehouse.id === item.warehouseId)?.name === reservationSeed.warehouseName);

      if (!product || !inventory) continue;

      const createdAt = subMinutes(new Date(), reservationSeed.createdMinutesAgo);
      const updatedAt = reservationSeed.status === "PENDING" ? createdAt : addMinutes(createdAt, 5);
      const expiresAt = addMinutes(createdAt, reservationSeed.expiresMinutesAhead || 10);

      await tx.reservation.create({
        data: {
          inventoryId: inventory.id,
          quantity: reservationSeed.quantity,
          status: reservationSeed.status,
          createdAt,
          updatedAt,
          expiresAt,
        },
      });
    }
  });

  const [warehouseCount, productCount, inventoryCount, reservationCount] = await Promise.all([
    prisma.warehouse.count(),
    prisma.product.count(),
    prisma.inventory.count(),
    prisma.reservation.count(),
  ]);

  return {
    warehouses: warehouseCount,
    products: productCount,
    inventories: inventoryCount,
    reservations: reservationCount,
  };
}