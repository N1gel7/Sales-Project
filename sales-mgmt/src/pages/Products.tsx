import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function Products(): React.ReactElement {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.listProducts();
        setItems(data as any[]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not load products.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-5"
          >
            <Skeleton className="mb-3 h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-tertiary)] bg-[var(--surface)] py-16 text-center">
        <Package className="mb-4 h-14 w-14 text-muted-foreground/35" />
        <p className="text-sm text-muted-foreground">No products in the catalog yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => {
        const catName =
          typeof p.category === 'object' && p.category?.name
            ? p.category.name
            : p.category ?? '—';
        return (
          <div
            key={p._id}
            className={cn(
              'rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-5 shadow-sm',
              'transition-shadow hover:border-[var(--color-border-primary)] hover:shadow-md'
            )}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-green-light)] text-[var(--brand-green-dark)]">
                <Package className="h-4 w-4" />
              </div>
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Product
              </span>
            </div>
            <h2 className="text-[15px] font-semibold leading-snug text-foreground">{p.name}</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              {catName}
              <span className="mx-1.5 text-[var(--color-border-tertiary)]">·</span>
              <span className="font-medium text-[var(--brand-green-dark)]">
                {new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(Number(p.price) || 0)}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
