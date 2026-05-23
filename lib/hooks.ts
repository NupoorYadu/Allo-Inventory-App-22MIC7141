import { useEffect, useState } from "react";

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

export function useProducts(pollInterval = 3000) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch("/api/products");
        if (!response.ok) throw new Error("Failed to fetch products");
        const data = await response.json();
        setProducts(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
    const interval = setInterval(fetchProducts, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);

  return { products, loading, error };
}
