import { describe, it, expect, vi, beforeEach } from 'vitest';
import authHandler from '../api/auth.js';
import { createMockRequest, createMockResponse } from './testUtils.js';


const mockQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  update: vi.fn().mockReturnThis()
};

vi.mock('../api/_lib/supabase.js', () => ({
  default: {
    from: vi.fn(() => mockQuery)
  }
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
    genSalt: vi.fn()
  }
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'mock-jwt-token'),
    verify: vi.fn()
  }
}));

import supabase from '../api/_lib/supabase.js';
import bcrypt from 'bcryptjs';

describe('Auth API Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if login fields are missing', async () => {
    const req = createMockRequest({
      method: 'POST',
      query: { action: 'login' },
      body: { email: 'test@example.com' } // missing password
    });
    const res = createMockResponse();

    await authHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Fill in all required fields' });
  });

  it('should login successfully with valid credentials', async () => {
    const req = createMockRequest({
      method: 'POST',
      query: { action: 'login' },
      body: { email: 'test@example.com', password: 'password123' }
    });
    const res = createMockResponse();

    // Mock Supabase to return a valid user
    supabase.from().single.mockResolvedValue({
      data: {
        id: 1,
        email: 'test@example.com',
        password_hash: 'hashed_password',
        active: true,
        has_changed_initial_password: true,
        role: 'admin',
        name: 'Test User'
      },
      error: null
    });

    // Mock bcrypt to return true for password match
    bcrypt.compare.mockResolvedValue(true);

    await authHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Login successful',
      token: 'mock-jwt-token',
      requiresPasswordChange: false
    }));
  });

  it('should return 401 for incorrect credentials', async () => {
    const req = createMockRequest({
      method: 'POST',
      query: { action: 'login' },
      body: { email: 'test@example.com', password: 'wrongpassword' }
    });
    const res = createMockResponse();

    supabase.from().single.mockResolvedValue({
      data: { id: 1, email: 'test@example.com', password_hash: 'hashed', active: true },
      error: null
    });

    bcrypt.compare.mockResolvedValue(false); // Password mismatch

    await authHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Incorrect email or password' });
  });
});
