import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Package, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Products(): React.ReactElement {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    try {
      const [prods, cats] = await Promise.all([
        api.listProducts() as Promise<any[]>,
        api.listCategories() as Promise<any[]>
      ]);
      setItems(prods as any[]);
      setCategories(cats as any[]);
      if (cats && cats.length > 0 && !categoryId) {
        setCategoryId(cats[0].name); // Use category name directly
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load products.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createProduct() {
    if (!name.trim()) {
      toast.error('Enter a product name.');
      return;
    }
    try {
      await api.createProduct({
        name: name.trim(),
        category: categoryId,
        price: parseFloat(price) || 0,
      });
      setName('');
      setPrice('');
      await load();
      toast.success('Product created.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not create product.');
    }
  }

  async function confirmRemove() {
    if (!deleteId) return;
    try {
      await api.deleteProduct(deleteId);
      setDeleteId(null);
      await load();
      toast.success('Product removed.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not delete product.');
    }
  }

  const toDelete = items.find((p) => p._id === deleteId);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="w-full shrink-0 rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-5 lg:w-[360px] lg:border-r lg:pr-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">New product</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Orange Juice"
              className="shadow-[0_0_0_3px_rgba(99,153,34,0.06)] focus-visible:shadow-[0_0_0_3px_rgba(99,153,34,0.12)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-green)]"
            >
              <option value="" disabled>Select category</option>
              {categories.map(c => (
                <option key={c._id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Price (GHS)</label>
            <Input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <Button
            type="button"
            className="w-full bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-dark)]"
            onClick={() => void createProduct()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create product
          </Button>
        </div>
      </div>

      <div className="min-w-0 flex-1 rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface-2)] p-4">
        <div className="mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-[var(--brand-green)]" />
          <h2 className="text-sm font-semibold text-foreground">All products</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-5">
                <Skeleton className="mb-3 h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-tertiary)] bg-[var(--surface)] py-14 text-center">
            <Package className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No products yet. Create one on the left.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => {
              const catName = typeof p.category === 'object' && p.category?.name ? p.category.name : p.category ?? '—';
              return (
                <div
                  key={p._id}
                  className="relative rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-5 shadow-sm transition-shadow hover:border-[var(--color-border-primary)] hover:shadow-md group"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 h-8 w-8 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => setDeleteId(p._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="mb-2 flex items-start justify-between gap-2 pr-8">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-green-light)] text-[var(--brand-green-dark)]">
                      <Package className="h-4 w-4" />
                    </div>
                  </div>
                  <h2 className="text-[15px] font-semibold leading-snug text-foreground pr-8">{p.name}</h2>
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
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `This will remove “${toDelete.name}” and cannot be undone.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmRemove()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
