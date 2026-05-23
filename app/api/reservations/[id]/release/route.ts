import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reservationId } = await params;

  try {
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

    // Release reservation in transaction
    const released = await prisma.$transaction(async (tx: any) => {
      // Decrease reservedStock to make inventory available again
      await tx.inventory.update({
        where: { id: reservation.inventoryId },
        data: {
          reservedStock: {
            decrement: reservation.quantity,
          },
        },
      });

      // Update reservation status
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
    });

    return NextResponse.json(released);
  } catch (error) {
    console.error("Error releasing reservation:", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
