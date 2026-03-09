import jwt from 'jsonwebtoken';

/**
 * Helper function to generate valid JWT token for testing
 * @param {string} operatorId - UUID of the operator
 * @param {number} roleId - Role ID (1 = admin, 2 = operator)
 * @returns {string} JWT token
 */
export function generateToken(operatorId, roleId = 1) {
  return jwt.sign(
    { sub: operatorId, roleId, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}
