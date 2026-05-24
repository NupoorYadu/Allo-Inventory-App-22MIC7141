import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reservationId } = await params;

  try {
    const released = await prisma.$transaction(
      async (tx: any) => {
        const [reservation] = await tx.$queryRaw<
          Array<{
            id: string;
            inventoryId: string;
            quantity: number;
            status: string;
          }>
        >`SELECT id, "inventoryId", quantity, status FROM "Reservation" WHERE id = ${reservationId} FOR UPDATE`;

        if (!reservation) {
          throw new Error("RESERVATION_NOT_FOUND");
        }

        if (reservation.status !== "PENDING") {
          throw new Error(`RESERVATION_${reservation.status}`);
        }

        await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM "Inventory" WHERE id = ${reservation.inventoryId} FOR UPDATE`;

        await tx.inventory.update({
          where: { id: reservation.inventoryId },
          data: {
            reservedStock: {
              decrement: reservation.quantity,
            },
          },
        });

        return tx.reservation.update({
          where: { id: reservationId },
          data: {
            status: "RELEASED",
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
      { maxWait: 10000, timeout: 15000 }
    );

    return NextResponse.json(released);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage === "RESERVATION_NOT_FOUND") {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (errorMessage.startsWith("RESERVATION_")) {
      return NextResponse.json(
        { error: "Reservation is no longer pending" },
        { status: 400 }
      );
    }

    console.error("Error releasing reservation:", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
