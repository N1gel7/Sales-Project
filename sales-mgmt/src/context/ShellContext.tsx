import React, { createContext, useContext, useMemo, useState } from 'react';

export type DateRangePreset = '7d' | '30d' | '90d';

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function computeRangeForPreset(preset: DateRangePreset): { start: string; end: string } {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  start.setDate(start.getDate() - (days - 1));
  return { start: toYMD(start), end: toYMD(end) };
}

type ShellValue = {
  datePreset: DateRangePreset;
  setDatePreset: (p: DateRangePreset) => void;
  dateRange: { start: string; end: string };
};

const ShellContext = createContext<ShellValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [datePreset, setDatePreset] = useState<DateRangePreset>('30d');
  const dateRange = useMemo(() => computeRangeForPreset(datePreset), [datePreset]);
  const value = useMemo(
    () => ({ datePreset, setDatePreset, dateRange }),
    [datePreset, dateRange]
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellValue {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error('useShell must be used within ShellProvider');
  }
  return ctx;
}
