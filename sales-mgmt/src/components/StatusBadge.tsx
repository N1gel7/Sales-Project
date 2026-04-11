import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

export type StatusBadgeStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'paid'
  | 'overdue'
  | 'sent'
  | 'draft'
  | 'cancelled';

const styles: Record<string, string> = {
  pending: 'bg-[var(--accent-amber-light)] text-[var(--accent-amber)] border border-[var(--accent-amber)]/25',
  in_progress: 'bg-[var(--accent-blue-light)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/25',
  completed: 'bg-[var(--brand-green-light)] text-[var(--brand-green-dark)] border border-[var(--brand-green)]/30',
  paid: 'bg-[var(--brand-green-light)] text-[var(--brand-green-dark)] border border-[var(--brand-green)]/30',
  overdue: 'bg-[var(--accent-red-light)] text-[var(--accent-red)] border border-[var(--accent-red)]/25',
  sent: 'bg-[var(--accent-blue-light)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/25',
  draft: 'bg-muted text-muted-foreground border border-border',
  cancelled: 'bg-muted text-muted-foreground border border-border',
};

function labelFor(s: string): string {
  return s.replace(/_/g, ' ');
}

export function StatusBadge({
  status,
  className,
}: {
  status: StatusBadgeStatus | string;
  className?: string;
}): ReactElement {
  const key = status in styles ? status : 'pending';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
        styles[key] ?? styles.pending,
        className
      )}
    >
      {labelFor(String(status))}
    </span>
  );
}
