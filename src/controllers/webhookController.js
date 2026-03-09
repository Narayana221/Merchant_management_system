import { z } from 'zod';
import * as webhookService from '../services/webhookService.js';

// Validation schema for webhook subscription creation
const createWebhookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL is required'),
  events: z.array(z.enum(['merchant.approved', 'merchant.suspended', 'merchant.reactivated'])).optional(),
});

/**
 * Create a new webhook subscription
 * POST /webhooks/subscriptions
 */
export async function createSubscription(req, res) {
  try {
    const validatedData = createWebhookSchema.parse(req.body);

    const subscription = await webhookService.createWebhookSubscription(
      validatedData.name,
      validatedData.url,
      validatedData.events
    );

    res.status(201).json({
      message: 'Webhook subscription created successfully',
      subscription,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: err.errors,
      });
    }
    console.error('Error creating webhook subscription:', err);
    res.status(500).json({ error: 'Failed to create webhook subscription' });
  }
}

/**
 * Get all webhook subscriptions
 * GET /webhooks/subscriptions
 */
export async function getSubscriptions(req, res) {
  try {
    const subscriptions = await webhookService.getWebhookSubscriptions();

    res.json({
      subscriptions,
      count: subscriptions.length,
    });
  } catch (err) {
    console.error('Error fetching webhook subscriptions:', err);
    res.status(500).json({ error: 'Failed to fetch webhook subscriptions' });
  }
}

/**
 * Update webhook subscription status
 * PATCH /webhooks/subscriptions/:id
 */
export async function updateSubscription(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        error: 'is_active must be a boolean',
      });
    }

    const subscription = await webhookService.updateWebhookSubscription(id, is_active);

    if (!subscription) {
      return res.status(404).json({ error: 'Webhook subscription not found' });
    }

    res.json({
      message: 'Webhook subscription updated successfully',
      subscription,
    });
  } catch (err) {
    console.error('Error updating webhook subscription:', err);
    res.status(500).json({ error: 'Failed to update webhook subscription' });
  }
}

/**
 * Delete webhook subscription
 * DELETE /webhooks/subscriptions/:id
 */
export async function deleteSubscription(req, res) {
  try {
    const { id } = req.params;

    await webhookService.deleteWebhookSubscription(id);

    res.json({
      message: 'Webhook subscription deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting webhook subscription:', err);
    res.status(500).json({ error: 'Failed to delete webhook subscription' });
  }
}

/**
 * Get webhook deliveries for a merchant
 * GET /webhooks/deliveries/:merchantId
 */
export async function getDeliveries(req, res) {
  try {
    const { merchantId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const deliveries = await webhookService.getWebhookDeliveries(merchantId, limit);

    res.json({
      deliveries,
      count: deliveries.length,
    });
  } catch (err) {
    console.error('Error fetching webhook deliveries:', err);
    res.status(500).json({ error: 'Failed to fetch webhook deliveries' });
  }
}
