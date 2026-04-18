import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders the given status label', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('in progress')).toBeInTheDocument();
  });

  it('falls back to pending style for unknown status', () => {
    const { container } = render(<StatusBadge status="unknown_status" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-[var(--accent-amber-light)]');
    expect(screen.getByText('unknown status')).toBeInTheDocument();
  });
});
