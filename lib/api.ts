'use client';

// API client for the frontend
// Communicates with Next.js backend API routes

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export interface InventoryData {
  id: string;
  name: string;
  productId: string;
  warehouseId: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  warehouse: {
    id: string;
    name: string;
  };
}

export interface ProductData {
  id: string;
  name: string;
  createdAt: string;
  inventory: InventoryData[];
}

export interface ReservationData {
  id: string;
  inventoryId: string;
  quantity: number;
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED';
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  inventory?: {
    id: string;
    product: {
      id: string;
      name: string;
    };
    warehouse: {
      id: string;
      name: string;
    };
  };
}

export async function getProducts(): Promise<ProductData[]> {
  const res = await fetch(`${API_BASE}/api/products`);
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  return res.json();
}

export async function getWarehouses() {
  const res = await fetch(`${API_BASE}/api/warehouses`);
  if (!res.ok) throw new Error(`Failed to fetch warehouses: ${res.status}`);
  return res.json();
}

export async function getReservations(): Promise<ReservationData[]> {
  const res = await fetch(`${API_BASE}/api/reservations`);
  if (!res.ok) throw new Error(`Failed to fetch reservations: ${res.status}`);
  return res.json();
}

export async function reserveInventory(
  inventoryId: string,
  quantity: number,
  idempotencyKey?: string,
): Promise<ReservationData> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`${API_BASE}/api/reservations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ inventoryId, quantity, idempotencyKey }),
  });

  if (res.status === 409) throw new Error('INSUFFICIENT_STOCK');
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to reserve: ${res.status}`);
  }

  return res.json();
}

export async function confirmReservation(reservationId: string): Promise<ReservationData> {
  const res = await fetch(`${API_BASE}/api/reservations/${reservationId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status === 410) throw new Error('RESERVATION_EXPIRED');
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to confirm: ${res.status}`);
  }

  return res.json();
}

export async function releaseReservation(reservationId: string): Promise<ReservationData> {
  const res = await fetch(`${API_BASE}/api/reservations/${reservationId}/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to release: ${res.status}`);
  }

  return res.json();
}
