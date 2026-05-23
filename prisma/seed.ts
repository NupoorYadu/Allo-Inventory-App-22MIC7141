import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create warehouses
  const warehouse1 = await prisma.warehouse.create({
    data: { name: "New York" },
  });

  const warehouse2 = await prisma.warehouse.create({
    data: { name: "Los Angeles" },
  });

  const warehouse3 = await prisma.warehouse.create({
    data: { name: "London" },
  });

  // Create products
  const product1 = await prisma.product.create({
    data: { name: "Laptop Pro 16" },
  });

  const product2 = await prisma.product.create({
    data: { name: "Wireless Headphones" },
  });

  const product3 = await prisma.product.create({
    data: { name: "USB-C Hub" },
  });

  // Create inventory
  await prisma.inventory.create({
    data: {
      productId: product1.id,
      warehouseId: warehouse1.id,
      totalStock: 50,
      reservedStock: 0,
    },
  });

  await prisma.inventory.create({
    data: {
      productId: product1.id,
      warehouseId: warehouse2.id,
      totalStock: 30,
      reservedStock: 0,
    },
  });

  await prisma.inventory.create({
    data: {
      productId: product2.id,
      warehouseId: warehouse1.id,
      totalStock: 200,
      reservedStock: 0,
    },
  });

  await prisma.inventory.create({
    data: {
      productId: product2.id,
      warehouseId: warehouse2.id,
      totalStock: 150,
      reservedStock: 0,
    },
  });

  await prisma.inventory.create({
    data: {
      productId: product2.id,
      warehouseId: warehouse3.id,
      totalStock: 100,
      reservedStock: 0,
    },
  });

  await prisma.inventory.create({
    data: {
      productId: product3.id,
      warehouseId: warehouse1.id,
      totalStock: 500,
      reservedStock: 0,
    },
  });

  await prisma.inventory.create({
    data: {
      productId: product3.id,
      warehouseId: warehouse2.id,
      totalStock: 400,
      reservedStock: 0,
    },
  });

  console.log("Database seeded successfully");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
