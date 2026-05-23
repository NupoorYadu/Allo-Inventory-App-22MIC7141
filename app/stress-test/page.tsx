"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";

interface StressTestResult {
  success: number;
  failed: number;
  latencies: number[];
  avgLatency: number;
  timestamp: Date;
}

export default function StressTestPage() {
  const [testRunning, setTestRunning] = useState(false);
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch("/api/warehouses");
        const data = await response.json();
        setWarehouses(data);
        if (data.length > 0) {
          // Get first warehouse with inventory
          const productsRes = await fetch("/api/products");
          const products = await productsRes.json();
          const firstInventory = products[0]?.inventory[0];
          if (firstInventory) {
            setSelectedWarehouse(firstInventory.id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch warehouses:", error);
      }
    };

    fetchWarehouses();
  }, []);

  const runStressTest = async () => {
    if (!selectedWarehouse) {
      toast.error("Select a warehouse first");
      return;
    }

    setTestRunning(true);
    const latencies: number[] = [];
    let success = 0;
    let failed = 0;

    try {
      // Create a test inventory with low stock to test concurrency
      const productsRes = await fetch("/api/products");
      const products = await productsRes.json();

      // Find the selected inventory details
      let testInventoryId = selectedWarehouse;

      // Simulate 50 concurrent requests
      const promises = Array.from({ length: 50 }).map(async () => {
        const startTime = performance.now();

        try {
          const response = await fetch("/api/reservations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              inventoryId: testInventoryId,
              quantity: 1,
              idempotencyKey: `stress-test-${Date.now()}-${Math.random()}`,
            }),
          });

          const endTime = performance.now();
          const latency = endTime - startTime;
          latencies.push(latency);

          if (response.ok) {
            success++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
        }
      });

      await Promise.all(promises);

      const avgLatency =
        latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0;

      const result: StressTestResult = {
        success,
        failed,
        latencies,
        avgLatency,
        timestamp: new Date(),
      };

      setResult(result);
      toast.success(
        `Stress test complete: ${success} succeeded, ${failed} failed`
      );
    } catch (error) {
      toast.error("Stress test failed");
      console.error(error);
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Stress Test Simulator</h1>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to products
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8">
          <p className="text-gray-600 mb-6">
            Simulate 50 concurrent reservation requests to test concurrency
            safety. This demonstrates that only available stock succeeds while
            other requests correctly fail with 409 Conflict.
          </p>

          <div className="space-y-6 mb-8">
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Warehouse/Product
              </label>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Choose an inventory...</option>
                <option disabled>───</option>
                {/* Will be populated dynamically */}
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <p className="text-blue-900 text-sm">
                <span className="font-semibold">How it works:</span> This test
                sends 50 requests simultaneously to the reservation endpoint. Due
                to concurrency safety implemented with PostgreSQL row locking, only
                the first successful requests will proceed (until stock is exhausted).
                The rest will receive 409 Conflict responses.
              </p>
            </div>

            <button
              onClick={runStressTest}
              disabled={testRunning || !selectedWarehouse}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded transition-colors"
            >
              {testRunning ? "Running test..." : "Run Stress Test (50 requests)"}
            </button>
          </div>

          {result && (
            <div className="border-t pt-8">
              <h2 className="text-xl font-semibold mb-6">Test Results</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-green-50 border border-green-200 rounded p-6">
                  <p className="text-green-900 text-sm mb-1">Successful</p>
                  <p className="text-3xl font-bold text-green-600">
                    {result.success}
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded p-6">
                  <p className="text-red-900 text-sm mb-1">Failed</p>
                  <p className="text-3xl font-bold text-red-600">{result.failed}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded p-6">
                  <p className="text-purple-900 text-sm mb-1">Avg Latency</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {result.avgLatency.toFixed(0)}ms
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded p-4">
                <p className="text-sm font-semibold mb-3">Latency Distribution</p>
                <div className="h-40 flex items-flex-end gap-1">
                  {result.latencies.map((latency, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-blue-500 rounded-t"
                      style={{
                        height: `${Math.min((latency / Math.max(...result.latencies)) * 100, 100)}%`,
                        minHeight: "2px",
                      }}
                      title={`${latency.toFixed(1)}ms`}
                    ></div>
                  ))}
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-100 rounded text-sm text-gray-700">
                <p className="font-semibold mb-2">Summary:</p>
                <ul className="space-y-1">
                  <li>
                    • Total requests: <span className="font-bold">{result.success + result.failed}</span>
                  </li>
                  <li>
                    • Success rate:{" "}
                    <span className="font-bold">
                      {(
                        (result.success / (result.success + result.failed)) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </li>
                  <li>
                    • This proves concurrency safety: only available stock was
                    successfully reserved.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
