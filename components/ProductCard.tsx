"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";

interface Inventory {
  id: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  warehouse: {
    id: string;
    name: string;
  };
}

interface Product {
  id: string;
  name: string;
  inventory: Inventory[];
}

export function ProductCard({ product }: { product: Product }) {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(
    product.inventory[0]?.id || ""
  );
  const [loading, setLoading] = useState(false);

  const selectedInventory = product.inventory.find(
    (inv) => inv.id === selectedWarehouse
  );

  const handleReserve = async () => {
    if (!selectedInventory) {
      toast.error("Select a warehouse");
      return;
    }

    if (selectedInventory.availableStock <= 0) {
      toast.error("Out of stock");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryId: selectedInventory.id,
          quantity: 1,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to reserve");
        return;
      }

      const reservation = await response.json();
      toast.success("Reservation created!");
      window.location.href = `/reservations/${reservation.id}`;
    } catch (error) {
      toast.error("Error creating reservation");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
      <h3 className="text-lg font-semibold mb-4">{product.name}</h3>

      <div className="space-y-3 mb-6">
        <label className="block text-sm font-medium">Warehouse</label>
        <select
          value={selectedWarehouse}
          onChange={(e) => setSelectedWarehouse(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          {product.inventory.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.warehouse.name} ({inv.availableStock} available)
            </option>
          ))}
        </select>
      </div>

      {selectedInventory && (
        <div className="bg-gray-50 rounded p-3 mb-6 text-sm space-y-1">
          <div>
            <span className="text-gray-600">Available: </span>
            <span className="font-semibold text-green-600">
              {selectedInventory.availableStock}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total: </span>
            <span className="font-semibold">{selectedInventory.totalStock}</span>
          </div>
          <div>
            <span className="text-gray-600">Reserved: </span>
            <span className="font-semibold text-orange-600">
              {selectedInventory.reservedStock}
            </span>
          </div>
        </div>
      )}

      <button
        onClick={handleReserve}
        disabled={
          loading || !selectedInventory || selectedInventory.availableStock <= 0
        }
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2 rounded transition-colors"
      >
        {loading ? "Reserving..." : "Reserve"}
      </button>
    </div>
  );
}
