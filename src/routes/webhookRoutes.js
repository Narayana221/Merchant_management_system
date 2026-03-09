import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createSubscription,
  getSubscriptions,
  updateSubscription,
  deleteSubscription,
  getDeliveries,
} from '../controllers/webhookController.js';

const router = express.Router();

// All webhook routes require authentication
router.use(requireAuth);

// POST /webhooks/subscriptions - Create new webhook subscription
router.post('/subscriptions', createSubscription);

// GET /webhooks/subscriptions - Get all webhook subscriptions
router.get('/subscriptions', getSubscriptions);

// PATCH /webhooks/subscriptions/:id - Update webhook subscription
router.patch('/subscriptions/:id', updateSubscription);

// DELETE /webhooks/subscriptions/:id - Delete webhook subscription
router.delete('/subscriptions/:id', deleteSubscription);

// GET /webhooks/deliveries/:merchantId - Get webhook deliveries for a merchant
router.get('/deliveries/:merchantId', getDeliveries);

export default router;
