import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reservationId } = await params;

  try {
    const confirmed = await prisma.$transaction(
      async (tx: any) => {
        const [reservation] = await tx.$queryRaw<
          Array<{
            id: string;
            inventoryId: string;
            quantity: number;
            status: string;
            expiresAt: Date;
          }>
        >`SELECT id, "inventoryId", quantity, status, "expiresAt" FROM "Reservation" WHERE id = ${reservationId} FOR UPDATE`;

        if (!reservation) {
          throw new Error("RESERVATION_NOT_FOUND");
        }

        if (reservation.status !== "PENDING") {
          throw new Error(`RESERVATION_${reservation.status}`);
        }

        if (new Date() > reservation.expiresAt) {
          throw new Error("RESERVATION_EXPIRED");
        }

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
      },
      { maxWait: 30000, timeout: 60000 }
    );

    return NextResponse.json(confirmed);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage === "RESERVATION_NOT_FOUND") {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (errorMessage.startsWith("RESERVATION_") && errorMessage !== "RESERVATION_EXPIRED") {
      return NextResponse.json(
        { error: "Reservation is no longer pending" },
        { status: 400 }
      );
    }

    if (errorMessage === "RESERVATION_EXPIRED") {
      return NextResponse.json(
        { error: "Reservation has expired" },
        { status: 410 }
      );
    }

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
