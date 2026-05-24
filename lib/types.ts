import { differenceInSeconds } from 'date-fns';

export type Status = 'PENDING' | 'CONFIRMED' | 'RELEASED';

export interface Inventory {
  id: string;
  name: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
}

export interface Product {
  id: string;
  name: string;
  inventory: Inventory[];
}

export interface TimelineEvent {
  label: string;
  at: Date;
}

export interface Reservation {
  id: string;
  productId: string;
  productName: string;
  inventoryId: string;
  warehouseName: string;
  quantity: number;
  status: Status;
  expiresAt: Date;
  createdAt: Date;
  timeline: TimelineEvent[];
}

export interface StressResult {
  id: number;
  success: boolean;
  ms: number;
  error?: string;
}

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'muted';

// Utilities
export const getAvailableStock = (inv: Inventory) => inv.availableStock;
export const getTotalAvailable = (p: Product) =>
  p.inventory.reduce((s, inv) => s + getAvailableStock(inv), 0);

export const getStockVariant = (available: number, total: number): BadgeVariant => {
  if (total === 0 || available === 0) return 'danger';
  if (available <= 5) return 'warning';
  if (available / total < 0.2) return 'warning';
  return 'success';
};

export const getStatusVariant = (status: Status): BadgeVariant => {
  return status === 'CONFIRMED' ? 'success' : status === 'PENDING' ? 'warning' : 'muted';
};

export const generateReservationId = () => 'RES-' + Math.random().toString(36).slice(2, 9).toUpperCase();

export const secondsRemaining = (expiresAt: Date): number =>
  Math.max(0, differenceInSeconds(expiresAt, new Date()));
