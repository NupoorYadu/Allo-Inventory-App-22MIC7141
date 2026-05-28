import { fallbackProducts, prisma } from "@/lib/prisma";
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

    const productsWithAvailableStock = products.map((product) => ({
      ...product,
      inventory: product.inventory.map((inv) => ({
        ...inv,
        availableStock: inv.totalStock - inv.reservedStock,
      })),
    }));

    if (productsWithAvailableStock.length > 0) {
      return NextResponse.json(productsWithAvailableStock);
    }

    const fallback = await fallbackProducts();
    return NextResponse.json(fallback);
  } catch (error) {
    console.error("Error fetching products:", error);
    try {
      const products = await fallbackProducts();
      return NextResponse.json(products);
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch products" },
        { status: 500 }
      );
    }
  }
}
