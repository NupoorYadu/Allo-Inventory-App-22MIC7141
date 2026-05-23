"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow, formatDistance } from "date-fns";
import { toast } from "react-hot-toast";
import Link from "next/link";

interface ReservationData {
  id: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
  inventory: {
    id: string;
    totalStock: number;
    reservedStock: number;
    product: { name: string };
    warehouse: { name: string };
  };
}

export default function ReservationPage({
  params,
}: {
  params: { id: string };
}) {
  const [reservation, setReservation] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const fetchReservation = async () => {
      try {
        const response = await fetch("/api/reservations");
        if (!response.ok) throw new Error("Failed to fetch");
        const reservations: ReservationData[] = await response.json();
        const found = reservations.find((r) => r.id === params.id);
        if (!found) throw new Error("Reservation not found");
        setReservation(found);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        setLoading(false);
      }
    };

    fetchReservation();
  }, [params.id]);

  useEffect(() => {
    if (!reservation) return;

    const timer = setInterval(() => {
      const now = new Date();
      const expiresAt = new Date(reservation.expiresAt);

      if (now >= expiresAt) {
        setIsExpired(true);
        setTimeLeft("Expired");
        clearInterval(timer);
      } else {
        setTimeLeft(formatDistance(expiresAt, now, { addSuffix: true }));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [reservation]);

  const handleConfirm = async () => {
    if (!reservation) return;

    setConfirming(true);
    try {
      const response = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 410) {
          toast.error("Reservation has expired");
          setIsExpired(true);
        } else {
          toast.error(error.error || "Failed to confirm");
        }
        return;
      }

      const updated = await response.json();
      setReservation(updated);
      toast.success("Reservation confirmed!");
    } catch (error) {
      toast.error("Error confirming reservation");
      console.error(error);
    } finally {
      setConfirming(false);
    }
  };

  const handleRelease = async () => {
    if (!reservation) return;

    setReleasing(true);
    try {
      const response = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to release");
        return;
      }

      const updated = await response.json();
      setReservation(updated);
      toast.success("Reservation released");
    } catch (error) {
      toast.error("Error releasing reservation");
      console.error(error);
    } finally {
      setReleasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Reservation not found"}</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to products
          </Link>
        </div>
      </div>
    );
  }

  const statusColor = {
    PENDING: "bg-yellow-50 text-yellow-800 border-yellow-200",
    CONFIRMED: "bg-green-50 text-green-800 border-green-200",
    RELEASED: "bg-gray-50 text-gray-800 border-gray-200",
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to products
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {reservation.inventory.product.name}
              </h1>
              <p className="text-gray-600">
                Reservation ID: <span className="font-mono">{reservation.id}</span>
              </p>
            </div>
            <div
              className={`rounded-full px-4 py-2 border text-sm font-semibold ${
                statusColor[reservation.status]
              }`}
            >
              {reservation.status}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-gray-600 text-sm mb-1">Warehouse</p>
              <p className="text-lg font-semibold">
                {reservation.inventory.warehouse.name}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">Quantity</p>
              <p className="text-lg font-semibold">{reservation.quantity} unit(s)</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">Created</p>
              <p className="text-lg font-semibold">
                {formatDistanceToNow(new Date(reservation.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">Expires</p>
              <p
                className={`text-lg font-semibold ${
                  isExpired ? "text-red-600" : "text-green-600"
                }`}
              >
                {timeLeft}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-8">
            <p className="text-blue-900 text-sm">
              <span className="font-semibold">Note:</span> This reservation is
              temporarily holding {reservation.quantity} unit(s) for 10 minutes.
              Complete payment to confirm, or it will be automatically released.
            </p>
          </div>

          <div className="flex gap-4 mb-8">
            <button
              onClick={handleConfirm}
              disabled={
                confirming ||
                isExpired ||
                reservation.status !== "PENDING"
              }
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded transition-colors"
            >
              {confirming ? "Confirming..." : "Confirm Reservation"}
            </button>
            <button
              onClick={handleRelease}
              disabled={
                releasing ||
                reservation.status !== "PENDING"
              }
              className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded transition-colors"
            >
              {releasing ? "Releasing..." : "Cancel Reservation"}
            </button>
          </div>

          {/* Activity Timeline */}
          <div className="border-t pt-8">
            <h2 className="text-xl font-semibold mb-6">Timeline</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                  <div className="w-0.5 h-12 bg-gray-300"></div>
                </div>
                <div>
                  <p className="font-semibold">Created</p>
                  <p className="text-gray-600 text-sm">
                    {new Date(reservation.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {reservation.status === "CONFIRMED" && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                  </div>
                  <div>
                    <p className="font-semibold">Confirmed</p>
                    <p className="text-gray-600 text-sm">
                      Payment successful. Stock permanently deducted.
                    </p>
                  </div>
                </div>
              )}

              {reservation.status === "RELEASED" && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  </div>
                  <div>
                    <p className="font-semibold">Released</p>
                    <p className="text-gray-600 text-sm">
                      Reservation cancelled or expired. Stock returned.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
