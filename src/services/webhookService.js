import crypto from 'crypto';
import pool from '../db/index.js';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

/**
 * Send webhook to a single URL with signature
 */
async function sendWebhookRequest(url, payload, secret) {
  const signature = generateSignature(payload, secret);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': new Date().toISOString(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    return {
      success: response.ok,
      status: response.status,
      error: response.ok ? null : await response.text(),
    };
  } catch (error) {
    return {
      success: false,
      status: null,
      error: error.message,
    };
  }
}

/**
 * Retry webhook delivery with exponential backoff
 */
async function retryWebhookDelivery(deliveryId) {
  const result = await pool.query(
    `SELECT * FROM webhook_deliveries WHERE id = $1`,
    [deliveryId]
  );

  if (result.rows.length === 0) {
    return;
  }

  const delivery = result.rows[0];

  // Stop if max retries reached
  if (delivery.retry_count >= MAX_RETRY_ATTEMPTS) {
    await pool.query(
      `UPDATE webhook_deliveries 
       SET status = 'failed'
       WHERE id = $1`,
      [deliveryId]
    );
    return;
  }

  // Get subscription details
  const subResult = await pool.query(
    `SELECT * FROM webhook_subscriptions WHERE url = $1 AND is_active = true`,
    [delivery.target_url]
  );

  if (subResult.rows.length === 0) {
    return;
  }

  const subscription = subResult.rows[0];

  // Send webhook
  const response = await sendWebhookRequest(
    delivery.target_url,
    delivery.payload,
    subscription.secret
  );

  // Update delivery record
  if (response.success) {
    await pool.query(
      `UPDATE webhook_deliveries 
       SET status = 'success', 
           response_code = $1,
           last_attempt_at = NOW()
       WHERE id = $2`,
      [response.status, deliveryId]
    );
  } else {
    const newRetryCount = delivery.retry_count + 1;
    await pool.query(
      `UPDATE webhook_deliveries 
       SET retry_count = $1,
           response_code = $2,
           last_attempt_at = NOW()
       WHERE id = $3`,
      [newRetryCount, response.status, deliveryId]
    );

    // Schedule next retry if not max attempts
    if (newRetryCount < MAX_RETRY_ATTEMPTS) {
      const delay = RETRY_DELAYS[newRetryCount - 1] || 15000;
      setTimeout(() => retryWebhookDelivery(deliveryId), delay);
    } else {
      await pool.query(
        `UPDATE webhook_deliveries SET status = 'failed' WHERE id = $1`,
        [deliveryId]
      );
    }
  }
}

/**
 * Send webhook notification for merchant status change
 * Runs in background and doesn't block the main operation
 */
export async function sendMerchantStatusWebhook(merchantId, eventType, statusChange) {
  // Run in background - don't await
  setImmediate(async () => {
    try {
      // Get active subscriptions for this event type
      const subscriptions = await pool.query(
        `SELECT * FROM webhook_subscriptions 
         WHERE is_active = true 
         AND $1 = ANY(events)`,
        [eventType]
      );

      if (subscriptions.rows.length === 0) {
        return;
      }

      // Get merchant details
      const merchantResult = await pool.query(
        `SELECT m.id, m.name, m.category, m.city, m.contact_email, m.status_id, ms.label as status_label
         FROM merchants m
         LEFT JOIN merchant_statuses ms ON m.status_id = ms.id
         WHERE m.id = $1`,
        [merchantId]
      );

      if (merchantResult.rows.length === 0) {
        return;
      }

      const merchant = merchantResult.rows[0];

      // Prepare payload
      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data: {
          merchant_id: merchant.id,
          merchant_name: merchant.name,
          old_status: statusChange.old_status,
          new_status: statusChange.new_status,
          merchant: {
            id: merchant.id,
            name: merchant.name,
            category: merchant.category,
            city: merchant.city,
            contact_email: merchant.contact_email,
            status: merchant.status_label,
          },
        },
      };

      // Send webhook to each subscription
      for (const subscription of subscriptions.rows) {
        // Create delivery record
        const deliveryResult = await pool.query(
          `INSERT INTO webhook_deliveries 
           (merchant_id, event_type, payload, target_url, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING id`,
          [merchantId, eventType, payload, subscription.url]
        );

        const deliveryId = deliveryResult.rows[0].id;

        // Send webhook (non-blocking)
        const response = await sendWebhookRequest(
          subscription.url,
          payload,
          subscription.secret
        );

        // Update delivery record
        if (response.success) {
          await pool.query(
            `UPDATE webhook_deliveries 
             SET status = 'success', 
                 response_code = $1,
                 last_attempt_at = NOW()
             WHERE id = $2`,
            [response.status, deliveryId]
          );
        } else {
          await pool.query(
            `UPDATE webhook_deliveries 
             SET retry_count = 1,
                 response_code = $1,
                 last_attempt_at = NOW()
             WHERE id = $2`,
            [response.status, deliveryId]
          );

          // Schedule retry
          setTimeout(() => retryWebhookDelivery(deliveryId), RETRY_DELAYS[0]);
        }
      }
    } catch (error) {
      console.error('Error sending webhook:', error);
    }
  });
}

/**
 * Create a new webhook subscription
 */
export async function createWebhookSubscription(name, url, events = ['merchant.approved', 'merchant.suspended', 'merchant.reactivated']) {
  // Generate a random secret for this subscription
  const secret = crypto.randomBytes(32).toString('hex');

  const result = await pool.query(
    `INSERT INTO webhook_subscriptions (name, url, secret, events)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, url, secret, events, is_active, created_at`,
    [name, url, secret, events]
  );

  return result.rows[0];
}

/**
 * Get all webhook subscriptions
 */
export async function getWebhookSubscriptions() {
  const result = await pool.query(
    `SELECT id, name, url, events, is_active, created_at
     FROM webhook_subscriptions
     ORDER BY created_at DESC`
  );

  return result.rows;
}

/**
 * Update webhook subscription status
 */
export async function updateWebhookSubscription(subscriptionId, isActive) {
  const result = await pool.query(
    `UPDATE webhook_subscriptions 
     SET is_active = $1
     WHERE id = $2
     RETURNING id, name, url, events, is_active`,
    [isActive, subscriptionId]
  );

  return result.rows[0] || null;
}

/**
 * Delete webhook subscription
 */
export async function deleteWebhookSubscription(subscriptionId) {
  await pool.query(
    `DELETE FROM webhook_subscriptions WHERE id = $1`,
    [subscriptionId]
  );
}

/**
 * Get webhook deliveries for a merchant
 */
export async function getWebhookDeliveries(merchantId, limit = 50) {
  const result = await pool.query(
    `SELECT id, merchant_id, event_type, target_url, status, 
            response_code, retry_count, last_attempt_at, created_at
     FROM webhook_deliveries
     WHERE merchant_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [merchantId, limit]
  );

  return result.rows;
}
