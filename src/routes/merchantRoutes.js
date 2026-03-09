import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  createMerchant,
  getAllMerchants,
  getMerchantById,
  updateMerchant,
  deleteMerchant,
  addDocument,
  getDocuments,
  updateStatus,
  getMerchantHistory,
} from '../controllers/merchantController.js';

const router = express.Router();

// All merchant routes require authentication
router.use(requireAuth);

// POST /merchants - Create new merchant
router.post('/', createMerchant);

// GET /merchants - Get all merchants (with optional filters)
router.get('/', getAllMerchants);

// GET /merchants/:id - Get single merchant by ID
router.get('/:id', getMerchantById);

// PATCH /merchants/:id - Update merchant by ID
router.patch('/:id', updateMerchant);

// POST /merchants/:id/documents - Add/update KYB document
router.post('/:id/documents', addDocument);

// GET /merchants/:id/documents - Get all KYB documents for a merchant
router.get('/:id/documents', getDocuments);

// GET /merchants/:id/history - Get full audit history for a merchant
router.get('/:id/history', getMerchantHistory);

// PATCH /merchants/:id/status - Update merchant status
router.patch('/:id/status', updateStatus);

// DELETE /merchants/:id - Delete merchant (Admin only)
router.delete('/:id', requireAdmin, deleteMerchant);

export default router;
