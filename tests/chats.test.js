import { describe, it, expect, vi, beforeEach } from 'vitest';
import chatsHandler from '../api/chats.js';
import { createMockRequest, createMockResponse } from './testUtils.js';

const mockQuery = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn()
};

vi.mock('../api/_lib/db.js', () => ({
  supabase: {
    from: vi.fn(() => mockQuery)
  }
}));

vi.mock('../api/_lib/authMiddleware.js', () => ({
  withAuth: (handler) => handler
}));

import { supabase } from '../api/_lib/db.js';

describe('Chats API Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch chats for GET requests', async () => {
    const req = createMockRequest({ method: 'GET', user: { id: 1 } });
    const res = createMockResponse();

    supabase.from().order.mockResolvedValueOnce({
      data: [{ id: 'chat1', participants: [{ user: 1 }, { user: 2 }] }],
      error: null
    });
    supabase.from().select.mockResolvedValueOnce({
      data: [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }],
      error: null
    });

    await chatsHandler(req, res);

    expect(res.json).toHaveBeenCalled();
  });
});
