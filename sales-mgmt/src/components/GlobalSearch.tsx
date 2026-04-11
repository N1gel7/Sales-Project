import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

type SearchRow = { id: string; label: string; sub?: string; type: string; path: string };

export function GlobalSearchTrigger({ className }: { className?: string }): React.ReactElement {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [rows, setRows] = React.useState<SearchRow[]>([]);

  const load = React.useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const next: SearchRow[] = [];
    try {
      const [tasks, users, invoices, reports] = await Promise.all([
        fetch('/api/tasks', { headers })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch('/api/users', { headers })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch('/api/invoices', { headers })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch('/api/reports', { headers })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ]);
      (Array.isArray(tasks) ? tasks : []).forEach((t: { _id: string; title?: string }) =>
        next.push({
          id: `task-${t._id}`,
          label: t.title || 'Task',
          type: 'Task',
          path: '/tasks',
        })
      );
      (Array.isArray(users) ? users : []).forEach((u: { _id: string; name?: string; email?: string }) =>
        next.push({
          id: `user-${u._id}`,
          label: u.name || 'User',
          sub: u.email,
          type: 'User',
          path: '/users',
        })
      );
      (Array.isArray(invoices) ? invoices : []).forEach(
        (inv: { _id: string; client?: string; product?: string }) =>
          next.push({
            id: `inv-${inv._id}`,
            label: inv.client ? `Invoice — ${inv.client}` : `Invoice ${inv._id.slice(-6)}`,
            sub: inv.product,
            type: 'Invoice',
            path: '/invoices',
          })
      );
      (Array.isArray(reports) ? reports : []).forEach((r: { _id: string; title?: string }) =>
        next.push({
          id: `rep-${r._id}`,
          label: r.title || 'Report',
          type: 'Report',
          path: '/reports',
        })
      );
    } catch {
      /* ignore */
    }
    setRows(next);
  }, []);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const navigate = useNavigate();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4 opacity-70" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Find tasks, people, invoices, reports">
        <Command shouldFilter>
          <CommandInput placeholder="Type to filter…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Results">
              {rows.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.type} ${r.label} ${r.sub ?? ''}`}
                  onSelect={() => {
                    setOpen(false);
                    navigate(r.path);
                  }}
                >
                  <span className="font-medium">{r.label}</span>
                  <span className="ml-2 text-[10px] uppercase text-muted-foreground">{r.type}</span>
                  {r.sub ? <span className="ml-auto truncate text-xs text-muted-foreground">{r.sub}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
