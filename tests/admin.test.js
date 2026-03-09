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

describe('Admin-Only Operations', () => {
  const mockAdminId = '123e4567-e89b-12d3-a456-426614174000';
  const mockOperatorId = '223e4567-e89b-12d3-a456-426614174000';
  const mockMerchantId = 'c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeEach(() => {
    jest.clearAllMocks();
    mockClientQuery.mockClear();
    mockClientRelease.mockClear();
  });

  describe('DELETE /merchants/:id - Delete Merchant', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .delete(`/merchants/${mockMerchantId}`)
        .expect(401);

      expect(res.body.error).toBe('Access token required');
    });

    it('should return 403 when non-admin operator tries to delete', async () => {
      const operatorToken = 'Bearer ' + generateToken(mockOperatorId, 2); // roleId = 2 (operator)

      mockQuery.mockResolvedValue({
        rows: [{ id: mockOperatorId, name: 'Operator', email: 'op@test.com', role_id: 2 }],
      });

      const res = await request(app)
        .delete(`/merchants/${mockMerchantId}`)
        .set('Authorization', operatorToken)
        .expect(403);

      expect(res.body.error).toBe('Admin access required');
    });

    it('should return 404 when merchant does not exist', async () => {
      const adminToken = 'Bearer ' + generateToken(mockAdminId, 1);

      mockQuery.mockResolvedValue({
        rows: [{ id: mockAdminId, name: 'Admin', email: 'admin@test.com', role_id: 1 }],
      });

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Merchant not found

      const res = await request(app)
        .delete(`/merchants/${mockMerchantId}`)
        .set('Authorization', adminToken)
        .expect(404);

      expect(res.body.error).toBe('Merchant not found');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should successfully delete merchant when admin authenticated', async () => {
      const adminToken = 'Bearer ' + generateToken(mockAdminId, 1);

      const mockMerchant = {
        id: mockMerchantId,
        name: 'Test Merchant',
        category: 'Retail',
        city: 'Casablanca',
        contact_email: 'test@merchant.com',
        status_id: 1,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValue({
        rows: [{ id: mockAdminId, name: 'Admin', email: 'admin@test.com', role_id: 1 }],
      });

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockMerchant] }) // SELECT merchant
        .mockResolvedValueOnce({}) // DELETE merchant
        .mockResolvedValueOnce({}) // INSERT audit log
        .mockResolvedValueOnce({}); // COMMIT

      const res = await request(app)
        .delete(`/merchants/${mockMerchantId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(res.body.message).toBe('Merchant deleted successfully');
      expect(res.body.merchant_id).toBe(mockMerchantId);

      // Verify transaction flow
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith(
        'SELECT * FROM merchants WHERE id = $1',
        [mockMerchantId]
      );
      expect(mockClientQuery).toHaveBeenCalledWith(
        'DELETE FROM merchants WHERE id = $1',
        [mockMerchantId]
      );
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('should log deletion in audit logs', async () => {
      const adminToken = 'Bearer ' + generateToken(mockAdminId, 1);

      const mockMerchant = {
        id: mockMerchantId,
        name: 'Test Merchant',
        category: 'Retail',
        city: 'Casablanca',
        contact_email: 'test@merchant.com',
        status_id: 1,
      };

      mockQuery.mockResolvedValue({
        rows: [{ id: mockAdminId, name: 'Admin', email: 'admin@test.com', role_id: 1 }],
      });

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockMerchant] }) // SELECT merchant
        .mockResolvedValueOnce({}) // DELETE merchant
        .mockResolvedValueOnce({}) // INSERT audit log
        .mockResolvedValueOnce({}); // COMMIT

      await request(app)
        .delete(`/merchants/${mockMerchantId}`)
        .set('Authorization', adminToken)
        .expect(200);

      // Verify audit log was created
      const auditLogCall = mockClientQuery.mock.calls.find(
        call => call[0]?.includes('INSERT INTO audit_logs')
      );
      
      expect(auditLogCall).toBeDefined();
      expect(auditLogCall[1][0]).toBe(mockMerchantId); // merchant_id
      expect(auditLogCall[1][1]).toBe(mockAdminId); // operator_id
      expect(auditLogCall[1][2]).toBe(1); // old_status_id (was Pending)
      expect(auditLogCall[1][3]).toBeNull(); // new_status_id (null = deleted)
    });

    it('should rollback on database error', async () => {
      const adminToken = 'Bearer ' + generateToken(mockAdminId, 1);

      mockQuery.mockResolvedValue({
        rows: [{ id: mockAdminId, name: 'Admin', email: 'admin@test.com', role_id: 1 }],
      });

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockMerchantId }] }) // SELECT merchant
        .mockRejectedValueOnce(new Error('Database error')); // DELETE fails

      const res = await request(app)
        .delete(`/merchants/${mockMerchantId}`)
        .set('Authorization', adminToken)
        .expect(500);

      expect(res.body.error).toBe('Failed to delete merchant');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClientRelease).toHaveBeenCalled();
    });
  });

  describe('requireAdmin middleware', () => {
    it('should allow admin to access protected routes', async () => {
      const adminToken = 'Bearer ' + generateToken(mockAdminId, 1);

      mockQuery.mockResolvedValue({
        rows: [{ id: mockAdminId, name: 'Admin', email: 'admin@test.com', role_id: 1 }],
      });

      mockClientQuery
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .delete(`/merchants/${mockMerchantId}`)
        .set('Authorization', adminToken);

      // Should reach the controller (404 because merchant doesn't exist)
      // Not 403 which would mean middleware blocked it
      expect(res.status).toBe(404);
    });

    it('should block operators from accessing admin routes', async () => {
      const operatorToken = 'Bearer ' + generateToken(mockOperatorId, 2);

      mockQuery.mockResolvedValue({
        rows: [{ id: mockOperatorId, name: 'Operator', email: 'op@test.com', role_id: 2 }],
      });

      const res = await request(app)
        .delete(`/merchants/${mockMerchantId}`)
        .set('Authorization', operatorToken)
        .expect(403);

      expect(res.body.error).toBe('Admin access required');
      
      // Should not reach the controller - blocked by middleware
      expect(mockConnect).not.toHaveBeenCalled();
    });
  });
});
