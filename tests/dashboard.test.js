import { describe, it, expect, vi, beforeEach } from 'vitest';
import dashboardHandler from '../api/dashboard.js';
import { createMockRequest, createMockResponse } from './testUtils.js';

const mockQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis()
};

vi.mock('../api/_lib/db.js', () => ({
  supabase: {
    from: vi.fn(() => mockQuery)
  }
}));

vi.mock('../api/_lib/authMiddleware.js', () => ({
  withAuth: (handler) => handler
}));

vi.mock('../api/_lib/analytics.js', () => ({
  getDailySalesSQL: vi.fn().mockResolvedValue([]),
  getMonthlySalesSQL: vi.fn().mockResolvedValue([]),
  getTaskCompletionRatesSQL: vi.fn().mockResolvedValue({ overall: { rate: 100 }, byUser: [] }),
  getProductPerformanceSQL: vi.fn().mockResolvedValue([])
}));

import { supabase } from '../api/_lib/db.js';

describe('Dashboard API Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return health status for health view', async () => {
    const req = createMockRequest({ method: 'GET', query: { view: 'health' } });
    const res = createMockResponse();

    await dashboardHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'healthy'
    }));
  });

  it('should fetch stats for default view', async () => {
    const req = createMockRequest({ method: 'GET', user: { id: 1, role: 'admin' } });
    const res = createMockResponse();

    supabase.from().select.mockResolvedValue({ data: [], error: null });

    await dashboardHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      taskStats: expect.any(Object),
      salesStats: expect.any(Object)
    }));
  });
});
