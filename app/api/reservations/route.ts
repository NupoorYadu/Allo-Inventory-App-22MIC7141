import { prisma } from "@/lib/prisma";
import { reserveInventorySchema } from "@/lib/schemas";
import { addMinutes } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = reserveInventorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { inventoryId, quantity } = validation.data;
    const idempotencyKey =
      request.headers.get("Idempotency-Key") || validation.data.idempotencyKey;

    // Lock inventory row to prevent overselling during concurrent reservations.
    const result = await prisma.$transaction(
      async (tx: any) => {
        if (idempotencyKey) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${idempotencyKey}))`;

          const existing = await tx.idempotencyKey.findUnique({
            where: { key: idempotencyKey },
          });

          if (existing) {
            return JSON.parse(existing.result);
          }
        }

        const [inventory] = await tx.$queryRaw<
          Array<{ id: string; totalStock: number; reservedStock: number }>
        >`SELECT id, "totalStock", "reservedStock" FROM "Inventory" WHERE id = ${inventoryId} FOR UPDATE`;

        if (!inventory) {
          const response = {
            status: 404,
            data: { error: "Inventory not found" },
          };

          if (idempotencyKey) {
            await tx.idempotencyKey.create({
              data: {
                key: idempotencyKey,
                result: JSON.stringify(response),
              },
            });
          }

          return response;
        }

        const availableStock = inventory.totalStock - inventory.reservedStock;

        if (availableStock < quantity) {
          const response = {
            status: 409,
            data: { error: "Insufficient stock available" },
          };

          if (idempotencyKey) {
            await tx.idempotencyKey.create({
              data: {
                key: idempotencyKey,
                result: JSON.stringify(response),
              },
            });
          }

          return response;
        }

        const newReservation = await tx.reservation.create({
          data: {
            inventoryId,
            quantity,
            status: "PENDING",
            expiresAt: addMinutes(new Date(), 10),
          },
        });

        await tx.inventory.update({
          where: { id: inventoryId },
          data: {
            reservedStock: {
              increment: quantity,
            },
          },
        });

        const response = {
          status: 201,
          data: newReservation,
        };

        if (idempotencyKey) {
          await tx.idempotencyKey.create({
            data: {
              key: idempotencyKey,
              result: JSON.stringify(response),
            },
          });
        }

        return response;
      },
      { maxWait: 10000, timeout: 15000 }
    );

    return NextResponse.json(result.data, { status: result.status });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (errorMessage === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        { error: "Insufficient stock available" },
        { status: 409 }
      );
    }

    if (errorMessage === "INVENTORY_NOT_FOUND") {
      return NextResponse.json(
        { error: "Inventory not found" },
        { status: 404 }
      );
    }

    console.error("Error creating reservation:", error);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        inventory: {
          include: {
            product: true,
            warehouse: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error("Error fetching reservations:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservations" },
      { status: 500 }
    );
  }
}
