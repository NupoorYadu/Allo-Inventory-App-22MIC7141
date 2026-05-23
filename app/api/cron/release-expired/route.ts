import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Verify cron secret
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }

    // Find all expired pending reservations
    const now = new Date();
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: {
          lt: now,
        },
      },
    });

    if (expiredReservations.length === 0) {
      return NextResponse.json({
        success: true,
        released: 0,
        message: "No expired reservations found",
      });
    }

    // Release all expired reservations in a single transaction
    const operations = expiredReservations.flatMap(
      (reservation: typeof expiredReservations[0]) => [
        // Decrease reservedStock
        prisma.inventory.update({
          where: { id: reservation.inventoryId },
          data: {
            reservedStock: {
              decrement: reservation.quantity,
            },
          },
        }),
        // Update reservation status
        prisma.reservation.update({
          where: { id: reservation.id },
          data: { status: "RELEASED" },
        }),
      ]
    );

    await prisma.$transaction(operations);

    return NextResponse.json({
      success: true,
      released: expiredReservations.length,
      message: `Released ${expiredReservations.length} expired reservations`,
    });
  } catch (error) {
    console.error("Error in cleanup cron:", error);
    return NextResponse.json(
      { error: "Failed to cleanup expired reservations" },
      { status: 500 }
    );
  }
}
