import { vi } from 'vitest';

export function createMockResponse() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

export function createMockRequest(options = {}) {
  return {
    method: 'GET',
    body: {},
    query: {},
    headers: {},
    ...options,
  };
}
