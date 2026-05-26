import { prisma } from "@/lib/prisma";
import { getProductCatalogEntry } from "@/lib/inventory-catalog";
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

    const productsWithAvailableStock = products.map((product) => {
      const catalog = getProductCatalogEntry(product.name);

      return {
        ...product,
        sku: catalog?.sku ?? product.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 12),
        category: catalog?.category ?? "Operations",
        image: catalog?.image ?? "",
        story: catalog?.story ?? "Core catalog item.",
        priority: catalog?.priority ?? "steady",
        demand: catalog?.demand ?? 0.5,
        inventory: product.inventory.map((inv) => ({
          ...inv,
          availableStock: inv.totalStock - inv.reservedStock,
        })),
      };
    });

    return NextResponse.json(productsWithAvailableStock);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
