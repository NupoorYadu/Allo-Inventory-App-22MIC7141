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
        { error: "Invalid request", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { inventoryId, quantity, idempotencyKey } = validation.data;

    // Check for existing idempotency key
    if (idempotencyKey) {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });

      if (existing) {
        const result = JSON.parse(existing.result);
        return NextResponse.json(result.data, { status: result.status });
      }
    }

    // Lock inventory row and reserve stock in a transaction
    const reservation = await prisma.$transaction(async (tx) => {
      // Lock the inventory row to prevent race conditions
      // This ensures no concurrent requests can modify this row until transaction commits
      const inventory = await tx.$queryRaw<
        Array<{ id: string; totalStock: number; reservedStock: number }>
      >`SELECT id, "totalStock", "reservedStock" FROM "Inventory" WHERE id = ${inventoryId} FOR UPDATE`;

      if (inventory.length === 0) {
        throw new Error("INVENTORY_NOT_FOUND");
      }

      const { totalStock, reservedStock } = inventory[0];
      const availableStock = totalStock - reservedStock;

      if (availableStock < quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      // Create reservation
      const newReservation = await tx.reservation.create({
        data: {
          inventoryId,
          quantity,
          status: "PENDING",
          expiresAt: addMinutes(new Date(), 10),
        },
      });

      // Update inventory to track reserved stock
      await tx.inventory.update({
        where: { id: inventoryId },
        data: {
          reservedStock: {
            increment: quantity,
          },
        },
      });

      return newReservation;
    });

    // Store idempotency key if provided
    if (idempotencyKey) {
      await prisma.idempotencyKey.create({
        data: {
          key: idempotencyKey,
          result: JSON.stringify({
            status: 201,
            data: reservation,
          }),
        },
      });
    }

    return NextResponse.json(reservation, { status: 201 });
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
