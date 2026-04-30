import { describe, it, expect, vi, beforeEach } from 'vitest';
import invoicesHandler from '../api/invoices.js';
import { createMockRequest, createMockResponse } from './testUtils.js';

const mockQuery = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn()
};

vi.mock('../api/_lib/db.js', () => ({
  supabase: {
    from: vi.fn(() => mockQuery)
  }
}));

vi.mock('../api/_lib/authMiddleware.js', () => ({
  withAuth: (handler) => handler,
  withRole: () => (handler) => handler
}));

import { supabase } from '../api/_lib/db.js';

describe('Invoices API Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch invoices for GET requests', async () => {
    const req = createMockRequest({ method: 'GET', user: { id: 1, role: 'admin' } });
    const res = createMockResponse();

    supabase.from().order.mockResolvedValue({
      data: [{ id: 1, total_amount: 100 }],
      error: null
    });

    await invoicesHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });

  it('should return 400 if required fields are missing on POST', async () => {
    const req = createMockRequest({
      method: 'POST',
      user: { id: 1, role: 'admin' },
      body: { customer_name: 'Test' } // Missing items, etc.
    });
    const res = createMockResponse();

    await invoicesHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Client and product/items are required' });
  });
});
