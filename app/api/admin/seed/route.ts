import { prisma } from "@/lib/prisma";
import { seedDemoData } from "@/lib/seed-demo-data";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const internalSeedHeader = request.headers.get("x-seed-demo");

  if (internalSeedHeader !== "allo-inventory-seed" && secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await seedDemoData(prisma);
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("Error seeding demo data:", error);
    return NextResponse.json({ error: "Failed to seed demo data" }, { status: 500 });
  }
}