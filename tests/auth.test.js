import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

const mockQuery = jest.fn();

jest.unstable_mockModule('../src/db/index.js', () => ({
  default: {
    query: mockQuery,
  },
}));

const { default: app } = await import('../src/index.js');

describe('POST /auth/login', () => {
  const validEmail = 'operator@test.com';
  const validPassword = 'SecurePass123';
  const operatorId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    it('returns 400 with details when email is invalid', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'something' })
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 400 when email is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ password: 'something' })
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 400 when password is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'valid@test.com' })
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  it('returns 200 and JWT for valid login', async () => {
    const passwordHash = await bcrypt.hash(validPassword, 10);
    const operator = {
      id: operatorId,
      email: validEmail,
      password_hash: passwordHash,
      role_id: 1,
      login_attempts: 0,
      lock_until: null,
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [operator] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: validEmail, password: validPassword })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.expiresIn).toBe(900);
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('returns 401 for invalid password', async () => {
    const passwordHash = await bcrypt.hash(validPassword, 10);
    const operator = {
      id: operatorId,
      email: validEmail,
      password_hash: passwordHash,
      role_id: 1,
      login_attempts: 0,
      lock_until: null,
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [operator] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: validEmail, password: 'WrongPassword' })
      .expect(401);

    expect(res.body.error).toBe('Invalid email or password');
  });

  it('returns 423 Locked after 5 failed logins; 6th attempt also returns 423', async () => {
    const passwordHash = await bcrypt.hash(validPassword, 10);
    const operator = {
      id: operatorId,
      email: validEmail,
      password_hash: passwordHash,
      role_id: 1,
      login_attempts: 0,
      lock_until: null,
    };

    for (let i = 0; i < 4; i++) {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ ...operator, login_attempts: i }],
        })
        .mockResolvedValueOnce({ rows: [] });
    }

    mockQuery
      .mockResolvedValueOnce({ rows: [{ ...operator, login_attempts: 4 }] })
      .mockResolvedValueOnce({ rows: [] });

    const lockedOperator = {
      ...operator,
      login_attempts: 5,
      lock_until: new Date(Date.now() + 15 * 60 * 1000),
    };

    mockQuery.mockResolvedValueOnce({ rows: [lockedOperator] });

    for (let i = 0; i < 4; i++) {
      await request(app)
        .post('/auth/login')
        .send({ email: validEmail, password: 'WrongPassword' })
        .expect(401);
    }

    const resFifth = await request(app)
      .post('/auth/login')
      .send({ email: validEmail, password: 'WrongPassword' })
      .expect(423);

    expect(resFifth.body.error).toMatch(/locked|too many/i);

    const resSixth = await request(app)
      .post('/auth/login')
      .send({ email: validEmail, password: validPassword })
      .expect(423);

    expect(resSixth.body.error).toMatch(/locked/i);
  });
});
