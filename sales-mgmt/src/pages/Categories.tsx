import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { FolderTree, Trash2, Plus } from 'lucide-react';
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

type Category = {
  _id: string;
  name: string;
  fields: Array<{ key: string; type: string; options?: string[] }>;
};

export default function Categories(): React.ReactElement {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.listCategories();
      setItems(data as Category[]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load categories.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCategory() {
    if (!name.trim()) {
      toast.error('Enter a category name.');
      return;
    }
    try {
      await api.createCategory({
        name: name.trim(),
        fields: fieldKey ? [{ key: fieldKey.trim(), type: fieldType }] : [],
      });
      setName('');
      setFieldKey('');
      setFieldType('text');
      await load();
      toast.success('Category created.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not create category.');
    }
  }

  async function confirmRemove() {
    if (!deleteId) return;
    try {
      await api.deleteCategory(deleteId);
      setDeleteId(null);
      await load();
      toast.success('Category removed.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not delete category.');
    }
  }

  const toDelete = items.find((c) => c._id === deleteId);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="w-full shrink-0 rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-5 lg:w-[360px] lg:border-r lg:pr-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">New category</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Beverages"
              className="shadow-[0_0_0_3px_rgba(99,153,34,0.06)] focus-visible:shadow-[0_0_0_3px_rgba(99,153,34,0.12)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Optional field</label>
            <Input
              value={fieldKey}
              onChange={(e) => setFieldKey(e.target.value)}
              placeholder="Field key"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Field type</label>
            <select
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-green)]"
            >
              <option value="text">text</option>
              <option value="number">number</option>
              <option value="price">price</option>
              <option value="dropdown">dropdown</option>
            </select>
          </div>
          <Button
            type="button"
            className="w-full bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-dark)]"
            onClick={() => void createCategory()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create category
          </Button>
        </div>
      </div>

      <div className="min-w-0 flex-1 rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface-2)] p-4">
        <div className="mb-4 flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-[var(--brand-green)]" />
          <h2 className="text-sm font-semibold text-foreground">All categories</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <FolderTree className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No categories yet. Create one on the left.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--color-border-tertiary)] bg-[var(--surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-tertiary)] bg-[var(--surface-2)] text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Fields</th>
                  <th className="w-[100px] px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr
                    key={c._id}
                    className="border-b border-[var(--color-border-tertiary)] last:border-0 hover:bg-[var(--surface-2)]/50"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.fields?.map((f) => f.key).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Delete ${c.name}`}
                        onClick={() => setDeleteId(c._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
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
