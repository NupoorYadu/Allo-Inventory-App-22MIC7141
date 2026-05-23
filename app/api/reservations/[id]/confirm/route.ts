import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const reservationId = params.id;

  try {
    // Check reservation exists and is still valid
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (reservation.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `Reservation is already ${reservation.status.toLowerCase()}`,
        },
        { status: 400 }
      );
    }

    if (new Date() > reservation.expiresAt) {
      return NextResponse.json(
        { error: "Reservation has expired" },
        { status: 410 }
      );
    }

    // Confirm reservation in transaction
    const confirmed = await prisma.$transaction(async (tx) => {
      // Lock inventory row
      const inventory = await tx.$queryRaw<
        Array<{ id: string; totalStock: number; reservedStock: number }>
      >`SELECT id, "totalStock", "reservedStock" FROM "Inventory" WHERE id = ${reservation.inventoryId} FOR UPDATE`;

      if (inventory.length === 0) {
        throw new Error("INVENTORY_NOT_FOUND");
      }

      // Decrease both totalStock and reservedStock
      // totalStock decreases because we're confirming the purchase
      // reservedStock decreases because it's no longer reserved (it's now confirmed)
      await tx.inventory.update({
        where: { id: reservation.inventoryId },
        data: {
          totalStock: {
            decrement: reservation.quantity,
          },
          reservedStock: {
            decrement: reservation.quantity,
          },
        },
      });

      // Update reservation status
      return tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: "CONFIRMED",
        },
        include: {
          inventory: {
            include: {
              product: true,
              warehouse: true,
            },
          },
        },
      });
    });

    return NextResponse.json(confirmed);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage === "INVENTORY_NOT_FOUND") {
      return NextResponse.json(
        { error: "Inventory not found" },
        { status: 404 }
      );
    }

    console.error("Error confirming reservation:", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}
