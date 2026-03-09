import pool from '../db/index.js';
import { sendMerchantStatusWebhook } from './webhookService.js';

// Status label mapping
const STATUS_LABELS = {
  1: 'Pending KYB',
  2: 'Active',
  3: 'Suspended',
};

/**
 * Create a new merchant with transaction
 * Ensures merchant creation and audit log entry are atomic
 */
export async function createMerchant(merchantData, operatorId) {
  const { name, category, city, contact_email } = merchantData;
  
  const client = await pool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');

    // Insert merchant with default status_id = 1 (Pending)
    const merchantResult = await client.query(
      `INSERT INTO merchants (name, category, city, contact_email, status_id)
       VALUES ($1, $2, $3, $4, 1)
       RETURNING id, name, category, city, contact_email, status_id`,
      [name, category, city, contact_email]
    );

    const merchant = merchantResult.rows[0];

    // Log the creation in audit_logs
    await client.query(
      `INSERT INTO audit_logs (merchant_id, operator_id, old_status_id, new_status_id)
       VALUES ($1, $2, NULL, 1)`,
      [merchant.id, operatorId]
    );

    // Commit transaction
    await client.query('COMMIT');

    return merchant;
  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    throw err;
  } finally {
    // Release client back to pool
    client.release();
  }
}

/**
 * Get all merchants with optional filters
 */
export async function getMerchants(filters = {}) {
  const { status_id, city } = filters;

  // Build dynamic query with filters
  let query = `
    SELECT 
      m.id, 
      m.name, 
      m.category, 
      m.city, 
      m.contact_email, 
      m.status_id,
      ms.label as status_label
    FROM merchants m
    LEFT JOIN merchant_statuses ms ON m.status_id = ms.id
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (status_id) {
    query += ` AND m.status_id = $${paramIndex}`;
    params.push(parseInt(status_id));
    paramIndex++;
  }

  if (city) {
    query += ` AND m.city = $${paramIndex}`;
    params.push(city);
    paramIndex++;
  }

  query += ` ORDER BY m.name`;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get a single merchant by ID
 */
export async function getMerchantById(merchantId) {
  const result = await pool.query(
    `SELECT 
      m.id, 
      m.name, 
      m.category, 
      m.city, 
      m.contact_email, 
      m.status_id,
      ms.label as status_label
    FROM merchants m
    LEFT JOIN merchant_statuses ms ON m.status_id = ms.id
    WHERE m.id = $1`,
    [merchantId]
  );

  return result.rows[0] || null;
}

/**
 * Update a merchant by ID with transaction
 * Logs the update in audit_logs
 */
export async function updateMerchant(merchantId, updateData, operatorId) {
  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid fields to update');
  }

  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');

    // Get current merchant data
    const currentResult = await client.query(
      'SELECT * FROM merchants WHERE id = $1',
      [merchantId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error('Merchant not found');
    }

    const currentMerchant = currentResult.rows[0];

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });

    values.push(merchantId); // Add ID for WHERE clause
    const updateQuery = `
      UPDATE merchants 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, values);
    const updatedMerchant = updateResult.rows[0];

    // Log the update in audit_logs
    await client.query(
      `INSERT INTO audit_logs (merchant_id, operator_id, old_status_id, new_status_id)
       VALUES ($1, $2, $3, $4)`,
      [
        merchantId,
        operatorId,
        currentMerchant.status_id,
        updatedMerchant.status_id,
      ]
    );

    // Commit transaction
    await client.query('COMMIT');

    return updatedMerchant;
  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    throw err;
  } finally {
    // Release client back to pool
    client.release();
  }
}

/**
 * Add or update a KYB document for a merchant
 */
export async function addKybDocument(merchantId, documentTypeId, isVerified = false) {
  const result = await pool.query(
    `INSERT INTO kyb_documents (merchant_id, document_type_id, is_verified)
     VALUES ($1, $2, $3)
     ON CONFLICT (merchant_id, document_type_id)
     DO UPDATE SET is_verified = $3
     RETURNING id, merchant_id, document_type_id, is_verified`,
    [merchantId, documentTypeId, isVerified]
  );

  return result.rows[0];
}

/**
 * Get KYB documents for a merchant
 */
export async function getKybDocuments(merchantId) {
  const result = await pool.query(
    `SELECT 
      kd.id,
      kd.merchant_id,
      kd.document_type_id,
      dt.name as document_type_name,
      kd.is_verified
    FROM kyb_documents kd
    JOIN document_types dt ON kd.document_type_id = dt.id
    WHERE kd.merchant_id = $1
    ORDER BY dt.id`,
    [merchantId]
  );

  return result.rows;
}

/**
 * Check if merchant has all 3 required verified documents
 */
export async function checkKybCompliance(merchantId) {
  const result = await pool.query(
    `SELECT COUNT(*) as verified_count
     FROM kyb_documents
     WHERE merchant_id = $1 AND is_verified = true`,
    [merchantId]
  );

  const verifiedCount = parseInt(result.rows[0].verified_count);
  return verifiedCount === 3;
}

/**
 * Status transition validation rules
 */
const STATUS_TRANSITIONS = {
  1: { // Pending
    allowed: [2], // Can go to Active
    requiresKyb: true,
  },
  2: { // Active
    allowed: [3], // Can go to Suspended
    requiresKyb: false,
  },
  3: { // Suspended
    allowed: [2], // Can go back to Active
    requiresKyb: false,
  },
};

/**
 * Update merchant status with validation and KYB checks
 */
export async function updateMerchantStatus(merchantId, newStatusId, operatorId) {
  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');

    // Get current merchant
    const merchantResult = await client.query(
      'SELECT * FROM merchants WHERE id = $1',
      [merchantId]
    );

    if (merchantResult.rows.length === 0) {
      throw new Error('Merchant not found');
    }

    const currentMerchant = merchantResult.rows[0];
    const oldStatusId = currentMerchant.status_id;

    // Check if status is already the same
    if (oldStatusId === newStatusId) {
      throw new Error('Merchant already has this status');
    }

    // Validate transition is allowed
    const transition = STATUS_TRANSITIONS[oldStatusId];
    if (!transition || !transition.allowed.includes(newStatusId)) {
      throw new Error(
        `Invalid status transition from status ${oldStatusId} to ${newStatusId}`
      );
    }

    // Check KYB compliance if required (Pending -> Active)
    if (transition.requiresKyb && newStatusId === 2) {
      const kybResult = await client.query(
        `SELECT COUNT(*) as verified_count
         FROM kyb_documents
         WHERE merchant_id = $1 AND is_verified = true`,
        [merchantId]
      );

      const verifiedCount = parseInt(kybResult.rows[0].verified_count);
      if (verifiedCount !== 3) {
        throw new Error('KYB Incomplete: 3 verified documents required for approval');
      }
    }

    // Update merchant status
    const updateResult = await client.query(
      `UPDATE merchants 
       SET status_id = $1
       WHERE id = $2
       RETURNING *`,
      [newStatusId, merchantId]
    );

    const updatedMerchant = updateResult.rows[0];

    // Log the status change in audit_logs
    await client.query(
      `INSERT INTO audit_logs (merchant_id, operator_id, old_status_id, new_status_id)
       VALUES ($1, $2, $3, $4)`,
      [merchantId, operatorId, oldStatusId, newStatusId]
    );

    // Commit transaction
    await client.query('COMMIT');

    // Send webhook notifications (non-blocking, runs in background)
    // Determine event type based on status change
    let eventType = null;
    if (oldStatusId === 1 && newStatusId === 2) {
      eventType = 'merchant.approved';
    } else if (newStatusId === 3) {
      eventType = 'merchant.suspended';
    } else if (oldStatusId === 3 && newStatusId === 2) {
      eventType = 'merchant.reactivated';
    }

    if (eventType) {
      sendMerchantStatusWebhook(merchantId, eventType, {
        old_status: STATUS_LABELS[oldStatusId],
        new_status: STATUS_LABELS[newStatusId],
      });
    }

    return updatedMerchant;
  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    throw err;
  } finally {
    // Release client back to pool
    client.release();
  }
}

/**
 * Get full audit history for a merchant
 * @param {string} merchantId - UUID of the merchant
 * @returns {Promise<Array>} Array of audit log entries with operator details
 */
export async function getMerchantHistory(merchantId) {
  // First verify the merchant exists
  const merchantCheck = await pool.query(
    'SELECT id, name FROM merchants WHERE id = $1',
    [merchantId]
  );

  if (merchantCheck.rows.length === 0) {
    throw new Error('Merchant not found');
  }

  // Fetch all audit log entries for this merchant with operator details
  const result = await pool.query(
    `SELECT 
      al.id,
      al.old_status_id,
      al.new_status_id,
      ms_old.label as old_status_name,
      ms_new.label as new_status_name,
      al.changed_at,
      o.email as operator_email,
      or_role.name as operator_role
    FROM audit_logs al
    LEFT JOIN operators o ON al.operator_id = o.id
    LEFT JOIN operator_roles or_role ON o.role_id = or_role.id
    LEFT JOIN merchant_statuses ms_old ON al.old_status_id = ms_old.id
    LEFT JOIN merchant_statuses ms_new ON al.new_status_id = ms_new.id
    WHERE al.merchant_id = $1
    ORDER BY al.changed_at DESC`,
    [merchantId]
  );

  return result.rows;
}

export async function deleteMerchant(merchantId, operatorId) {
  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');

    // Check if merchant exists
    const merchantResult = await client.query(
      'SELECT * FROM merchants WHERE id = $1',
      [merchantId]
    );

    if (merchantResult.rows.length === 0) {
      throw new Error('Merchant not found');
    }

    const merchant = merchantResult.rows[0];

    // Delete the merchant record
    await client.query(
      'DELETE FROM merchants WHERE id = $1',
      [merchantId]
    );

    // Log the deletion in audit logs (merchant no longer has a status)
    await client.query(
      `INSERT INTO audit_logs (merchant_id, operator_id, old_status_id, new_status_id)
       VALUES ($1, $2, $3, $4)`,
      [
        merchantId,
        operatorId,
        merchant.status_id,
        null,
      ]
    );

    // Commit transaction
    await client.query('COMMIT');

    return { success: true };
  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    throw err;
  } finally {
    // Release client back to pool
    client.release();
  }
}
