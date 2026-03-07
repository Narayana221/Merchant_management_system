import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import pool from '../db/index.js';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

/**
 * Hash a password for storage (use when creating operators)
 */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

/**
 * Compare plain password with stored hash
 */
async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Generate access and refresh tokens for an operator
 */
function generateTokens(operator) {
  const accessToken = jwt.sign(
    { sub: operator.id, roleId: operator.role_id, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { sub: operator.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

/**
 * POST /auth/login
 */
export async function login(req, res) {
  try {
    const parseResult = loginSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parseResult.data;

    const result = await pool.query(
      `SELECT o.id, o.email, o.password_hash, o.role_id, o.login_attempts, o.lock_until
       FROM operators o
       WHERE LOWER(o.email) = LOWER($1)`,
      [email.trim()]
    );

    const operator = result.rows[0];

    if (!operator) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (operator.lock_until && new Date(operator.lock_until) > new Date()) {
      return res.status(423).json({
        error: 'Account is locked. Try again after ' + operator.lock_until,
      });
    }

    const passwordValid = await comparePassword(password, operator.password_hash);

    if (!passwordValid) {
      const newAttempts = (operator.login_attempts || 0) + 1;
      const lockUntil = newAttempts >= MAX_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
        : null;

      await pool.query(
        `UPDATE operators SET login_attempts = $1, lock_until = $2 WHERE id = $3`,
        [newAttempts, lockUntil, operator.id]
      );

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        return res.status(423).json({
          error: `Too many failed attempts. Account locked for ${LOCK_DURATION_MINUTES} minutes.`,
        });
      }

      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await pool.query(
      `UPDATE operators SET login_attempts = 0, lock_until = NULL WHERE id = $1`,
      [operator.id]
    );

    const { accessToken, refreshToken } = generateTokens(operator);

    return res.status(200).json({
      accessToken,
      refreshToken,
      expiresIn: 900,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * POST /auth/refresh
 */
export async function refresh(req, res) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.body?.refreshToken;

    if (!token) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const result = await pool.query(
      `SELECT id, role_id, lock_until FROM operators WHERE id = $1`,
      [decoded.sub]
    );

    const operator = result.rows[0];
    if (!operator) {
      return res.status(401).json({ error: 'Operator not found' });
    }

    if (operator.lock_until && new Date(operator.lock_until) > new Date()) {
      return res.status(423).json({ error: 'Account is locked' });
    }

    const accessToken = jwt.sign(
      { sub: operator.id, roleId: operator.role_id, type: 'access' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    return res.status(200).json({
      accessToken,
      expiresIn: 900,
    });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
}
