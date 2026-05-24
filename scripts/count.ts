import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main(){
  const productCount = await prisma.product.count();
  const warehouseCount = await prisma.warehouse.count();
  const inventoryCount = await prisma.inventory.count();
  const reservationCount = await prisma.reservation.count();
  console.log({ productCount, warehouseCount, inventoryCount, reservationCount });
  await prisma.$disconnect();
}
main().catch(async (e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
