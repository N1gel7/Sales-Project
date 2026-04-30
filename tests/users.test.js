import { describe, it, expect, vi, beforeEach } from 'vitest';
import usersHandler from '../api/users.js';
import { createMockRequest, createMockResponse } from './testUtils.js';

const mockQuery = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn()
};

vi.mock('../api/_lib/db.js', () => ({
  supabase: {
    from: vi.fn(() => mockQuery)
  }
}));

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({ toString: () => 'randomHex' }))
  }
}));

vi.mock('bcryptjs', () => ({
  default: {
    genSalt: vi.fn().mockResolvedValue('salt'),
    hash: vi.fn().mockResolvedValue('hashedPassword')
  }
}));

vi.mock('../api/_lib/authMiddleware.js', () => ({
  withAuth: (handler) => handler
}));

vi.mock('../api/_lib/mailer.js', () => ({
  sendUserWelcomeEmail: vi.fn()
}));

import { supabase } from '../api/_lib/db.js';

describe('Users API Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch users for GET requests', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();

    supabase.from().order.mockResolvedValue({
      data: [{ id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin', active: true }],
      error: null
    });

    await usersHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ _id: 1, name: 'John Doe' })
    ]);
  });

  it('should allow admin to create a user', async () => {
    const req = createMockRequest({
      method: 'POST',
      user: { role: 'admin' },
      body: { name: 'New User', email: 'new@example.com', role: 'rep' }
    });
    const res = createMockResponse();

    supabase.from().single.mockResolvedValue({
      data: { id: 2, created_at: '2023-01-01T00:00:00Z' },
      error: null
    });

    await usersHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      _id: 2,
      name: 'New User',
      email: 'new@example.com'
    }));
  });

  it('should block non-admins from creating a user', async () => {
    const req = createMockRequest({
      method: 'POST',
      user: { role: 'rep' },
      body: { name: 'New User', email: 'new@example.com', role: 'rep' }
    });
    const res = createMockResponse();

    await usersHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Permission denied: Only administrators and managers can create users' });
  });

  it('should block creating an admin user', async () => {
    const req = createMockRequest({
      method: 'POST',
      user: { role: 'admin' },
      body: { name: 'New Admin', email: 'admin@example.com', role: 'admin' }
    });
    const res = createMockResponse();

    await usersHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Creation of administrative accounts is prohibited' });
  });
});
