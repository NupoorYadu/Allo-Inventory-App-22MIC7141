import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const released = await prisma.$transaction(
      async (tx: any) => {
        const expiredReservations = await tx.$queryRaw<
          Array<{
            id: string;
            inventoryId: string;
            quantity: number;
          }>
        >`SELECT id, "inventoryId", quantity FROM "Reservation" WHERE status = 'PENDING' AND "expiresAt" < ${now} FOR UPDATE`;

        for (const reservation of expiredReservations) {
          await tx.inventory.update({
            where: { id: reservation.inventoryId },
            data: {
              reservedStock: {
                decrement: reservation.quantity,
              },
            },
          });

          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: "RELEASED" },
          });
        }

        return expiredReservations.length;
      },
      { maxWait: 30000, timeout: 60000 }
    );

    return NextResponse.json({
      success: true,
      released,
      message:
        released === 0
          ? "No expired reservations found"
          : `Released ${released} expired reservations`,
    });
  } catch (error) {
    console.error("Error in cleanup cron:", error);
    return NextResponse.json(
      { error: "Failed to cleanup expired reservations" },
      { status: 500 }
    );
  }
}
