import { describe, it, expect, vi, beforeEach } from 'vitest';
import tasksHandler from '../api/tasks.js';
import { createMockRequest, createMockResponse } from './testUtils.js';

const mockQuery = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
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

describe('Tasks API Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch tasks for GET requests', async () => {
    const req = createMockRequest({ method: 'GET', user: { id: 1, role: 'admin' } });
    const res = createMockResponse();

    supabase.from().order.mockResolvedValue({
      data: [{ id: 1, title: 'Test Task' }],
      error: null
    });

    await tasksHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
  });

  it('should create a task on POST request', async () => {
    const req = createMockRequest({
      method: 'POST',
      user: { id: 1, role: 'admin' },
      body: { title: 'New Task', description: 'Desc', due_date: '2023-12-31' }
    });
    const res = createMockResponse();

    supabase.from().single.mockResolvedValue({
      data: { id: 2, title: 'New Task' },
      error: null
    });

    await tasksHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();
  });
});
