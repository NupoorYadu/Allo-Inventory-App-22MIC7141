import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        inventory: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productsWithAvailableStock = products.map((product: any) => ({
      ...product,
      inventory: product.inventory.map((inv: any) => ({
        ...inv,
        availableStock: inv.totalStock - inv.reservedStock,
      })),
    }));

    return NextResponse.json(productsWithAvailableStock);
  } catch (error: unknown) {
    // Temporary verbose debug for runtime error diagnosis in production.
    // This will be reverted once root cause is identified.
    console.error("Error fetching products:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to fetch products", message: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}
