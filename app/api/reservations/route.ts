import { fallbackReserveInventory, fallbackReservations, prisma } from "@/lib/prisma";
import { reserveInventorySchema } from "@/lib/schemas";
import { addMinutes } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let inventoryId: string | undefined;
  let quantity: number | undefined;
  let idempotencyKey: string | null | undefined;

  try {
    const body = await request.json();
    const validation = reserveInventorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    ({ inventoryId, quantity } = validation.data);
    idempotencyKey = request.headers.get("Idempotency-Key") || validation.data.idempotencyKey;

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
        >`UPDATE "Inventory"
          SET "reservedStock" = "reservedStock" + ${quantity}
          WHERE id = ${inventoryId}
            AND ("totalStock" - "reservedStock") >= ${quantity}
          RETURNING id, "totalStock", "reservedStock"`;

        if (!inventory) {
          const inventoryExists = await tx.inventory.findUnique({
            where: { id: inventoryId },
            select: { id: true },
          });

          const response = {
            status: inventoryExists ? 409 : 404,
            data: {
              error: inventoryExists
                ? "Insufficient stock available"
                : "Inventory not found",
            },
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
      { maxWait: 30000, timeout: 60000 }
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
    if (process.env.NODE_ENV !== "production") {
      try {
        const fallback = await fallbackReserveInventory(inventoryId as string, quantity as number, idempotencyKey as string | undefined);
        return NextResponse.json(fallback.data, { status: fallback.status });
      } catch {
        // fall through to generic error below
      }
    }

    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
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

    if (reservations.length > 0) {
      return NextResponse.json(reservations);
    }

    const fallback = await fallbackReservations();
    return NextResponse.json(fallback);
  } catch (error) {
    console.error("Error fetching reservations:", error);
    try {
      const reservations = await fallbackReservations();
      return NextResponse.json(reservations);
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch reservations" },
        { status: 500 }
      );
    }
  }
}
