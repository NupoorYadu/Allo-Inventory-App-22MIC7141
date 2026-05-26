import { PrismaClient } from "@prisma/client";

import { seedDemoData } from "@/lib/seed-demo-data";

const prisma = new PrismaClient();

async function main() {
  const summary = await seedDemoData(prisma);
  console.log("Database seeded successfully", summary);
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
