import { jest } from '@jest/globals';
import request from 'supertest';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

const mockQuery = jest.fn();
const mockConnect = jest.fn();

jest.unstable_mockModule('../src/db/index.js', () => ({
  default: {
    query: mockQuery,
    connect: mockConnect,
  },
}));

// Mock fetch for webhook requests
global.fetch = jest.fn();

const { default: app } = await import('../src/index.js');
const { generateToken } = await import('./helpers/tokenHelper.js');

describe('Webhook Subscriptions API', () => {
  const operatorId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const subscriptionId = 'sub-uuid-1234';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /webhooks/subscriptions', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app)
        .post('/webhooks/subscriptions')
        .send({
          name: 'Test Webhook',
          url: 'https://example.com/webhook',
        })
        .expect(401);

      expect(res.body.error).toBe('Access token required');
    });

    it('creates a webhook subscription successfully', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: subscriptionId,
            name: 'Test Webhook',
            url: 'https://example.com/webhook',
            secret: crypto.randomBytes(32).toString('hex'),
            events: ['merchant.approved', 'merchant.suspended', 'merchant.reactivated'],
            is_active: true,
            created_at: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .post('/webhooks/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Webhook',
          url: 'https://example.com/webhook',
        })
        .expect(201);

      expect(res.body.message).toBe('Webhook subscription created successfully');
      expect(res.body.subscription).toBeDefined();
      expect(res.body.subscription.name).toBe('Test Webhook');
      expect(res.body.subscription.secret).toBeDefined();
    });

    it('returns 400 for invalid URL', async () => {
      const token = generateToken(operatorId);

      const res = await request(app)
        .post('/webhooks/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Webhook',
          url: 'not-a-valid-url',
        })
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
    });

    it('allows custom event selection', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: subscriptionId,
            name: 'Approval Only Webhook',
            url: 'https://example.com/webhook',
            secret: crypto.randomBytes(32).toString('hex'),
            events: ['merchant.approved'],
            is_active: true,
            created_at: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .post('/webhooks/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Approval Only Webhook',
          url: 'https://example.com/webhook',
          events: ['merchant.approved'],
        })
        .expect(201);

      expect(res.body.subscription.events).toEqual(['merchant.approved']);
    });
  });

  describe('GET /webhooks/subscriptions', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app)
        .get('/webhooks/subscriptions')
        .expect(401);

      expect(res.body.error).toBe('Access token required');
    });

    it('returns all webhook subscriptions', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: subscriptionId,
            name: 'Test Webhook',
            url: 'https://example.com/webhook',
            events: ['merchant.approved'],
            is_active: true,
            created_at: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .get('/webhooks/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.subscriptions).toHaveLength(1);
      expect(res.body.subscriptions[0].name).toBe('Test Webhook');
    });
  });

  describe('PATCH /webhooks/subscriptions/:id', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app)
        .patch(`/webhooks/subscriptions/${subscriptionId}`)
        .send({ is_active: false })
        .expect(401);

      expect(res.body.error).toBe('Access token required');
    });

    it('updates webhook subscription status', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: subscriptionId,
            name: 'Test Webhook',
            url: 'https://example.com/webhook',
            events: ['merchant.approved'],
            is_active: false,
          },
        ],
      });

      const res = await request(app)
        .patch(`/webhooks/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ is_active: false })
        .expect(200);

      expect(res.body.message).toBe('Webhook subscription updated successfully');
      expect(res.body.subscription.is_active).toBe(false);
    });

    it('returns 400 for invalid is_active value', async () => {
      const token = generateToken(operatorId);

      const res = await request(app)
        .patch(`/webhooks/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ is_active: 'invalid' })
        .expect(400);

      expect(res.body.error).toBe('is_active must be a boolean');
    });
  });

  describe('DELETE /webhooks/subscriptions/:id', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app)
        .delete(`/webhooks/subscriptions/${subscriptionId}`)
        .expect(401);

      expect(res.body.error).toBe('Access token required');
    });

    it('deletes webhook subscription', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .delete(`/webhooks/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.message).toBe('Webhook subscription deleted successfully');
    });
  });

  describe('GET /webhooks/deliveries/:merchantId', () => {
    const merchantId = 'merchant-uuid-1234';

    it('returns 401 when no token is provided', async () => {
      const res = await request(app)
        .get(`/webhooks/deliveries/${merchantId}`)
        .expect(401);

      expect(res.body.error).toBe('Access token required');
    });

    it('returns webhook deliveries for a merchant', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'delivery-1',
            merchant_id: merchantId,
            event_type: 'merchant.approved',
            target_url: 'https://example.com/webhook',
            status: 'success',
            response_code: 200,
            retry_count: 0,
            last_attempt_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .get(`/webhooks/deliveries/${merchantId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.deliveries).toHaveLength(1);
      expect(res.body.deliveries[0].event_type).toBe('merchant.approved');
      expect(res.body.deliveries[0].status).toBe('success');
    });

    it('respects limit query parameter', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get(`/webhooks/deliveries/${merchantId}?limit=10`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [merchantId, 10]
      );
    });
  });
});

describe('Webhook Signature Verification', () => {
  it('generates consistent HMAC signature', async () => {
    const crypto = await import('crypto');
    const payload = { test: 'data' };
    const secret = 'test-secret';

    const signature1 = crypto.default
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    const signature2 = crypto.default
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    expect(signature1).toBe(signature2);
  });

  it('generates different signatures for different payloads', async () => {
    const crypto = await import('crypto');
    const payload1 = { test: 'data1' };
    const payload2 = { test: 'data2' };
    const secret = 'test-secret';

    const signature1 = crypto.default
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload1))
      .digest('hex');

    const signature2 = crypto.default
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload2))
      .digest('hex');

    expect(signature1).not.toBe(signature2);
  });
});
