'use client';

function getApiBase() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

export interface InventoryData {
  id: string;
  name: string;
  sku: string;
  category: string;
  image: string;
  story: string;
  priority: "critical" | "high" | "medium" | "steady";
  demand: number;
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
  sku: string;
  category: string;
  image: string;
  story: string;
  priority: "critical" | "high" | "medium" | "steady";
  demand: number;
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
      sku: string;
      category: string;
      image: string;
      story: string;
      priority: "critical" | "high" | "medium" | "steady";
      demand: number;
    };
    warehouse: {
      id: string;
      name: string;
    };
  };
}

export async function getProducts(): Promise<ProductData[]> {
  const res = await fetch(`${getApiBase()}/api/products`);
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  return res.json();
}

export async function getReservations(): Promise<ReservationData[]> {
  const res = await fetch(`${getApiBase()}/api/reservations`);
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

  const res = await fetch(`${getApiBase()}/api/reservations`, {
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
  const res = await fetch(`${getApiBase()}/api/reservations/${reservationId}/confirm`, {
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
  const res = await fetch(`${getApiBase()}/api/reservations/${reservationId}/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Failed to release: ${res.status}`);
  }

  return res.json();
}
