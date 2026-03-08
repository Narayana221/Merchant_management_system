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
const jwt = (await import('jsonwebtoken')).default;

// Helper function to generate valid JWT token
function generateToken(operatorId, roleId = 1) {
  return jwt.sign(
    { sub: operatorId, roleId, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

describe('KYB Document Management', () => {
  const operatorId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const merchantId = 'b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /merchants/:id/documents', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app)
        .post(`/merchants/${merchantId}/documents`)
        .send({ document_type_id: 1 })
        .expect(401);

      expect(res.body.error).toBe('Access token required');
    });

    it('adds a KYB document successfully', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'doc-uuid',
            merchant_id: merchantId,
            document_type_id: 1,
            is_verified: false,
          },
        ],
      });

      const res = await request(app)
        .post(`/merchants/${merchantId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ document_type_id: 1, is_verified: false })
        .expect(201);

      expect(res.body.message).toBe('Document added successfully');
      expect(res.body.document.document_type_id).toBe(1);
    });

    it('returns 400 for invalid document_type_id', async () => {
      const token = generateToken(operatorId);

      const res = await request(app)
        .post(`/merchants/${merchantId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ document_type_id: 99 })
        .expect(400);

      expect(res.body.error).toContain('Invalid document_type_id');
    });
  });

  describe('GET /merchants/:id/documents', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app)
        .get(`/merchants/${merchantId}/documents`)
        .expect(401);

      expect(res.body.error).toBe('Access token required');
    });

    it('returns all KYB documents for a merchant', async () => {
      const token = generateToken(operatorId);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'doc1',
            merchant_id: merchantId,
            document_type_id: 1,
            document_type_name: 'business_registration',
            is_verified: true,
          },
          {
            id: 'doc2',
            merchant_id: merchantId,
            document_type_id: 2,
            document_type_name: 'owner_identity',
            is_verified: true,
          },
        ],
      });

      const res = await request(app)
        .get(`/merchants/${merchantId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.documents).toHaveLength(2);
      expect(res.body.documents[0].document_type_name).toBe('business_registration');
    });
  });
});

describe('Merchant Status Updates with KYB', () => {
  const operatorId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const merchantId = 'b1ffcd99-9c0b-4ef8-bb6d-6bb9bd380a22';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PATCH /merchants/:id/status', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app)
        .patch(`/merchants/${merchantId}/status`)
        .send({ status_id: 2 })
        .expect(401);

      expect(res.body.error).toBe('Access token required');
    });

    it('returns 400 for invalid status_id', async () => {
      const token = generateToken(operatorId);

      const res = await request(app)
        .patch(`/merchants/${merchantId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status_id: 99 })
        .expect(400);

      expect(res.body.error).toContain('Invalid status_id');
    });

    it('prevents Pending -> Active without 3 verified documents', async () => {
      const token = generateToken(operatorId);

      // Mock transaction BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock SELECT merchant (status = 1, Pending)
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Test Merchant',
            status_id: 1,
          },
        ],
      });

      // Mock KYB check - only 2 verified documents
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ verified_count: '2' }],
      });

      // Mock transaction ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch(`/merchants/${merchantId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status_id: 2 })
        .expect(400);

      expect(res.body.error).toBe('KYB Incomplete: 3 verified documents required for approval');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('allows Pending -> Active with 3 verified documents', async () => {
      const token = generateToken(operatorId);

      // Mock transaction BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock SELECT merchant (status = 1, Pending)
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Test Merchant',
            status_id: 1,
          },
        ],
      });

      // Mock KYB check - 3 verified documents
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ verified_count: '3' }],
      });

      // Mock UPDATE merchant status
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Test Merchant',
            status_id: 2,
          },
        ],
      });

      // Mock INSERT audit_logs
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock transaction COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch(`/merchants/${merchantId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status_id: 2 })
        .expect(200);

      expect(res.body.message).toBe('Merchant status updated successfully');
      expect(res.body.merchant.status_id).toBe(2);
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    });

    it('allows Active -> Suspended without KYB check', async () => {
      const token = generateToken(operatorId);

      // Mock transaction BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock SELECT merchant (status = 2, Active)
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Test Merchant',
            status_id: 2,
          },
        ],
      });

      // Mock UPDATE merchant status
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Test Merchant',
            status_id: 3,
          },
        ],
      });

      // Mock INSERT audit_logs
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock transaction COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch(`/merchants/${merchantId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status_id: 3 })
        .expect(200);

      expect(res.body.message).toBe('Merchant status updated successfully');
      expect(res.body.merchant.status_id).toBe(3);
    });

    it('allows Suspended -> Active without KYB check', async () => {
      const token = generateToken(operatorId);

      // Mock transaction BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock SELECT merchant (status = 3, Suspended)
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Test Merchant',
            status_id: 3,
          },
        ],
      });

      // Mock UPDATE merchant status
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Test Merchant',
            status_id: 2,
          },
        ],
      });

      // Mock INSERT audit_logs
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock transaction COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch(`/merchants/${merchantId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status_id: 2 })
        .expect(200);

      expect(res.body.message).toBe('Merchant status updated successfully');
      expect(res.body.merchant.status_id).toBe(2);
    });

    it('prevents invalid status transitions', async () => {
      const token = generateToken(operatorId);

      // Mock transaction BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock SELECT merchant (status = 2, Active)
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          {
            id: merchantId,
            name: 'Test Merchant',
            status_id: 2,
          },
        ],
      });

      // Mock transaction ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch(`/merchants/${merchantId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status_id: 1 }) // Active -> Pending not allowed
        .expect(400);

      expect(res.body.error).toContain('Invalid status transition');
    });

    it('returns 404 when merchant not found', async () => {
      const token = generateToken(operatorId);

      // Mock transaction BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock SELECT merchant - not found
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Mock transaction ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch(`/merchants/${merchantId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status_id: 2 })
        .expect(404);

      expect(res.body.error).toBe('Merchant not found');
    });
  });
});
