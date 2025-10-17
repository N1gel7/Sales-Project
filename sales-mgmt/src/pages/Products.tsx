import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Products(): React.ReactElement {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.listProducts();
        setItems(data as any[]);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">Products</div>
        <div className="card-body">
          {loading && <div className="text-sm text-gray-500">Loading...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {!loading && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((p) => (
                <div key={p._id} className="card">
                  <div className="card-body">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.category} • GHS {p.price}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


