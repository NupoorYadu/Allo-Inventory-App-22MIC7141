import { prisma, fallbackWarehouses } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { name: "asc" },
    });

    if (warehouses.length > 0) {
      return NextResponse.json(warehouses);
    }

    const fallback = await fallbackWarehouses();
    return NextResponse.json(fallback);
  } catch (error) {
    console.error("Error fetching warehouses:", error);
    try {
      const warehouses = await fallbackWarehouses();
      return NextResponse.json(warehouses);
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch warehouses" },
        { status: 500 }
      );
    }
  }
}
