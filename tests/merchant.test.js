import { jest } from '@jest/globals';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockClient = {
  query: mockClientQuery,
  release: mockClientRelease,
};
const mockConnect = jest.fn().mockResolvedValue(mockClient);

jest.unstable_mockModule('../src/db/index.js', () => ({
  default: {
    query: mockQuery,
    connect: mockConnect,
  },
}));

const { default: app } = await import('../src/index.js');
const { generateToken } = await import('./helpers/tokenHelper.js');

describe('Merchant API', () => {
  const operatorId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const merchantId = 'b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /merchants', () => {
    const validMerchantData = {
      name: 'Test Merchant',
      category: 'Retail',
      city: 'Casablanca',
      contact_email: 'merchant@test.com',
    };

    it('returns 401 when JWT token is missing', async () => {
      const res = await request(app)
        .post('/merchants')
        .send(validMerchantData)
        .expect(401);

      expect(res.body.error).toBe('Access token required');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 401 when JWT token is invalid', async () => {
      const res = await request(app)
        .post('/merchants')
        .set('Authorization', 'Bearer invalid-token')
        .send(validMerchantData)
        .expect(401);

      expect(res.body.error).toBe('Invalid access token');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('creates merchant with valid token and logs to audit_logs', async () => {
      const token = generateToken(operatorId);

      // Mock transaction BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock INSERT merchant query
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: validMerchantData.name,
            category: validMerchantData.category,
            city: validMerchantData.city,
            contact_email: validMerchantData.contact_email,
            status_id: 1,
          },
        ],
      });

      // Mock INSERT audit_logs query
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock transaction COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/merchants')
        .set('Authorization', `Bearer ${token}`)
        .send(validMerchantData)
        .expect(201);

      expect(res.body.message).toBe('Merchant created successfully');
      expect(res.body.merchant.status_id).toBe(1);
      expect(res.body.merchant.name).toBe(validMerchantData.name);

      // Verify transaction was used
      expect(mockConnect).toHaveBeenCalled();
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO merchants'),
        [
          validMerchantData.name,
          validMerchantData.category,
          validMerchantData.city,
          validMerchantData.contact_email,
        ]
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        [merchantId, operatorId]
      );
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('returns 400 when required fields are missing', async () => {
      const token = generateToken(operatorId);

      const res = await request(app)
        .post('/merchants')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test' })
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 400 when email is invalid', async () => {
      const token = generateToken(operatorId);

      const res = await request(app)
        .post('/merchants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validMerchantData,
          contact_email: 'not-an-email',
        })
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('GET /merchants', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/merchants').expect(401);

      expect(res.body.error).toBe('Access token required');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns all merchants with status labels', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Test Merchant',
            category: 'Retail',
            city: 'Casablanca',
            contact_email: 'merchant@test.com',
            status_id: 2,
            status_label: 'Active',
          },
        ],
      });

      const res = await request(app)
        .get('/merchants')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.merchants).toHaveLength(1);
      expect(res.body.merchants[0].status_label).toBe('Active');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN merchant_statuses'),
        []
      );
    });

    it('filters merchants by city=Casablanca', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Casa Merchant',
            category: 'Retail',
            city: 'Casablanca',
            contact_email: 'casa@test.com',
            status_id: 2,
            status_label: 'Active',
          },
        ],
      });

      const res = await request(app)
        .get('/merchants?city=Casablanca')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.merchants).toHaveLength(1);
      expect(res.body.merchants[0].city).toBe('Casablanca');

      // Verify query contains city filter
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND m.city = $1'),
        ['Casablanca']
      );
    });

    it('filters merchants by status_id', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Active Merchant',
            category: 'Retail',
            city: 'Rabat',
            contact_email: 'active@test.com',
            status_id: 2,
            status_label: 'Active',
          },
        ],
      });

      const res = await request(app)
        .get('/merchants?status_id=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.merchants).toHaveLength(1);
      expect(res.body.merchants[0].status_id).toBe(2);

      // Verify query contains status filter
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND m.status_id = $1'),
        [2]
      );
    });

    it('filters by both status_id and city', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Active Casa Merchant',
            category: 'Retail',
            city: 'Casablanca',
            contact_email: 'activecasa@test.com',
            status_id: 2,
            status_label: 'Active',
          },
        ],
      });

      const res = await request(app)
        .get('/merchants?status_id=2&city=Casablanca')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.merchants).toHaveLength(1);
      expect(res.body.merchants[0].city).toBe('Casablanca');
      expect(res.body.merchants[0].status_id).toBe(2);

      // Verify query contains both filters
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringMatching(/AND m\.status_id = \$1.*AND m\.city = \$2/s),
        [2, 'Casablanca']
      );
    });
  });

  describe('GET /merchants/:id', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get(`/merchants/${merchantId}`).expect(401);

      expect(res.body.error).toBe('Access token required');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns merchant by ID with status label', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Test Merchant',
            category: 'Retail',
            city: 'Casablanca',
            contact_email: 'merchant@test.com',
            status_id: 2,
            status_label: 'Active',
          },
        ],
      });

      const res = await request(app)
        .get(`/merchants/${merchantId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.merchant.id).toBe(merchantId);
      expect(res.body.merchant.status_label).toBe('Active');
    });

    it('returns 404 when merchant not found', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/merchants/${merchantId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(res.body.error).toBe('Merchant not found');
    });
  });

  describe('PATCH /merchants/:id', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app)
        .patch(`/merchants/${merchantId}`)
        .send({ name: 'Updated Name' })
        .expect(401);

      expect(res.body.error).toBe('Access token required');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('updates merchant and logs to audit_logs', async () => {
      const token = generateToken(operatorId);

      // Mock transaction BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock SELECT current merchant
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Old Name',
            category: 'Retail',
            city: 'Casablanca',
            contact_email: 'merchant@test.com',
            status_id: 1,
          },
        ],
      });

      // Mock UPDATE merchant
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Updated Name',
            category: 'Retail',
            city: 'Casablanca',
            contact_email: 'merchant@test.com',
            status_id: 2,
          },
        ],
      });

      // Mock INSERT audit_logs
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock transaction COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch(`/merchants/${merchantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', status_id: 2 })
        .expect(200);

      expect(res.body.message).toBe('Merchant updated successfully');
      expect(res.body.merchant.name).toBe('Updated Name');

      // Verify transaction was used
      expect(mockConnect).toHaveBeenCalled();
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith(
        'SELECT * FROM merchants WHERE id = $1',
        [merchantId]
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        [merchantId, operatorId, 1, 2]
      );
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('returns 404 when merchant not found', async () => {
      const token = generateToken(operatorId);

      // Mock transaction BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock SELECT current merchant - empty result
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock transaction ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch(`/merchants/${merchantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(res.body.error).toBe('Merchant not found');
    });

    it('returns 400 when no valid fields provided', async () => {
      const token = generateToken(operatorId);

      const res = await request(app)
        .patch(`/merchants/${merchantId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.error).toBe('No valid fields to update');
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });
});
