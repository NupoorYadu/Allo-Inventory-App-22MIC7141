import { prisma } from "@/lib/prisma";
import { seedDemoData } from "@/lib/seed-demo-data";
import { NextRequest, NextResponse } from "next/server";

const BOOTSTRAP_TOKEN = "allo-inventory-seed";

export async function POST(request: NextRequest) {
  if (request.headers.get("x-seed-demo") !== BOOTSTRAP_TOKEN) {
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