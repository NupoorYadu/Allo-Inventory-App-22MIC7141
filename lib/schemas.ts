import { z } from "zod";

export const reserveInventorySchema = z.object({
  inventoryId: z.string().cuid(),
  quantity: z.number().int().positive(),
  idempotencyKey: z.string().optional(),
});

export const confirmReservationSchema = z.object({
  reservationId: z.string().cuid(),
});

export const releaseReservationSchema = z.object({
  reservationId: z.string().cuid(),
});
