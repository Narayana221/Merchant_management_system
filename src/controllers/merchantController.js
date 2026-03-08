import { z } from 'zod';
import * as merchantService from '../services/merchantService.js';

// Validation schema for merchant creation
const createMerchantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  city: z.string().min(1, 'City is required'),
  contact_email: z.string().email('Valid email is required'),
});

// Validation schema for merchant update
const updateMerchantSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  contact_email: z.string().email().optional(),
  status_id: z.number().int().positive().optional(),
});

/**
 * Create a new merchant
 * POST /merchants
 */
export async function createMerchant(req, res) {
  try {
    // Validate input
    const validatedData = createMerchantSchema.parse(req.body);
    const operatorId = req.user.id;

    // Call service to create merchant
    const merchant = await merchantService.createMerchant(validatedData, operatorId);

    res.status(201).json({
      message: 'Merchant created successfully',
      merchant,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: err.errors,
      });
    }
    console.error('Error creating merchant:', err);
    res.status(500).json({ error: 'Failed to create merchant' });
  }
}

/**
 * Get all merchants with optional filters
 * GET /merchants?status_id=2&city=Casablanca
 */
export async function getAllMerchants(req, res) {
  try {
    const { status_id, city } = req.query;

    // Call service to get merchants with filters
    const merchants = await merchantService.getMerchants({ status_id, city });

    res.json({
      merchants,
      count: merchants.length,
    });
  } catch (err) {
    console.error('Error fetching merchants:', err);
    res.status(500).json({ error: 'Failed to fetch merchants' });
  }
}

/**
 * Get a single merchant by ID
 * GET /merchants/:id
 */
export async function getMerchantById(req, res) {
  try {
    const { id } = req.params;

    // Call service to get merchant by ID
    const merchant = await merchantService.getMerchantById(id);

    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    res.json({ merchant });
  } catch (err) {
    console.error('Error fetching merchant:', err);
    res.status(500).json({ error: 'Failed to fetch merchant' });
  }
}

/**
 * Update a merchant by ID
 * PATCH /merchants/:id
 */
export async function updateMerchant(req, res) {
  try {
    const { id } = req.params;

    // Validate input
    const validatedData = updateMerchantSchema.parse(req.body);

    const operatorId = req.user.id;

    // Call service to update merchant
    const updatedMerchant = await merchantService.updateMerchant(id, validatedData, operatorId);

    res.json({
      message: 'Merchant updated successfully',
      merchant: updatedMerchant,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: err.errors,
      });
    }
    if (err.message === 'No valid fields to update') {
      return res.status(400).json({ error: err.message });
    }
    if (err.message === 'Merchant not found') {
      return res.status(404).json({ error: err.message });
    }
    console.error('Error updating merchant:', err);
    res.status(500).json({ error: 'Failed to update merchant' });
  }
}

/**
 * Add or update a KYB document
 * POST /merchants/:id/documents
 */
export async function addDocument(req, res) {
  try {
    const { id } = req.params;
    const { document_type_id, is_verified } = req.body;

    // Validate document_type_id
    if (!document_type_id || ![1, 2, 3].includes(document_type_id)) {
      return res.status(400).json({
        error: 'Invalid document_type_id. Must be 1 (business_registration), 2 (owner_identity), or 3 (bank_proof)',
      });
    }

    // Call service to add document
    const document = await merchantService.addKybDocument(
      id,
      document_type_id,
      is_verified || false
    );

    res.status(201).json({
      message: 'Document added successfully',
      document,
    });
  } catch (err) {
    console.error('Error adding document:', err);
    res.status(500).json({ error: 'Failed to add document' });
  }
}

/**
 * Get KYB documents for a merchant
 * GET /merchants/:id/documents
 */
export async function getDocuments(req, res) {
  try {
    const { id } = req.params;

    // Call service to get documents
    const documents = await merchantService.getKybDocuments(id);

    res.json({
      documents,
      count: documents.length,
    });
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
}

/**
 * Update merchant status with KYB validation
 * PATCH /merchants/:id/status
 */
export async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status_id } = req.body;

    // Validate status_id
    if (!status_id || ![1, 2, 3].includes(status_id)) {
      return res.status(400).json({
        error: 'Invalid status_id. Must be 1 (Pending), 2 (Active), or 3 (Suspended)',
      });
    }

    const operatorId = req.user.id;

    // Call service to update status
    const updatedMerchant = await merchantService.updateMerchantStatus(
      id,
      status_id,
      operatorId
    );

    res.json({
      message: 'Merchant status updated successfully',
      merchant: updatedMerchant,
    });
  } catch (err) {
    if (err.message === 'Merchant not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'Merchant already has this status') {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes('Invalid status transition')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes('KYB Incomplete')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Error updating status:', err);
    res.status(500).json({ error: 'Failed to update merchant status' });
  }
}
