# Postman Testing Guide - Merchant Management System

## Prerequisites
1. Start the server: `npm run dev` (runs on http://localhost:3000)
2. Database must be running with all migrations executed
3. Create a test operator in the database (see below)

## Setup Test Data

### Create Test Operators in Database
```sql
-- Admin operator (roleId = 1)
INSERT INTO operators (id, name, email, password_hash, role_id)
VALUES (
  'a1234567-e89b-12d3-a456-426614174000',
  'Admin User',
  'admin@test.com',
  '$2b$10$YourHashedPasswordHere',  -- Use actual bcrypt hash
  1
);

-- Regular operator (roleId = 2)
INSERT INTO operators (id, name, email, password_hash, role_id)
VALUES (
  'b1234567-e89b-12d3-a456-426614174000',
  'Regular Operator',
  'operator@test.com',
  '$2b$10$YourHashedPasswordHere',  -- Use actual bcrypt hash
  2
);
```

**Or use existing test operator from migrations:**
- Email: `nanu@test.com`
- Password: `password123`
- Role: Admin (roleId = 1)

---

## 1. AUTHENTICATION APIs

### 1.1 Login (Get Access Token)
**POST** `http://localhost:3000/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "nanu@test.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**💡 Save the `accessToken` - you'll need it for all subsequent requests!**

---

### 1.2 Refresh Access Token
**POST** `http://localhost:3000/auth/refresh`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "refreshToken": "YOUR_REFRESH_TOKEN_FROM_LOGIN"
}
```

**Response (200):**
```json
{
  "accessToken": "NEW_ACCESS_TOKEN"
}
```

---

## 2. MERCHANT CRUD APIs

**⚠️ All merchant endpoints require authentication. Add this header to all requests:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 2.1 Create Merchant
**POST** `http://localhost:3000/merchants`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Casa Electronics Store",
  "category": "Electronics",
  "city": "Casablanca",
  "contact_email": "contact@casaelectronics.ma"
}
```

**Response (201):**
```json
{
  "message": "Merchant created successfully",
  "merchant": {
    "id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
    "name": "Casa Electronics Store",
    "category": "Electronics",
    "city": "Casablanca",
    "contact_email": "contact@casaelectronics.ma",
    "status_id": 1,
    "status_name": "Pending KYB",
    "created_at": "2026-03-08T10:30:00.000Z",
    "updated_at": "2026-03-08T10:30:00.000Z"
  }
}
```

**💡 Save the merchant `id` for subsequent tests!**

---

### 2.2 Get All Merchants
**GET** `http://localhost:3000/merchants`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Optional Query Parameters:**
- `?status_id=1` - Filter by status (1=Pending, 2=Active, 3=Suspended)
- `?city=Casablanca` - Filter by city
- `?status_id=2&city=Rabat` - Combine filters

**Response (200):**
```json
{
  "merchants": [
    {
      "id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
      "name": "Casa Electronics Store",
      "category": "Electronics",
      "city": "Casablanca",
      "contact_email": "contact@casaelectronics.ma",
      "status_id": 1,
      "status_name": "Pending KYB"
    }
  ],
  "count": 1
}
```

---

### 2.3 Get Merchant by ID
**GET** `http://localhost:3000/merchants/{merchant-id}`

**Example:**
```
GET http://localhost:3000/merchants/c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11
```

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200):**
```json
{
  "merchant": {
    "id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
    "name": "Casa Electronics Store",
    "category": "Electronics",
    "city": "Casablanca",
    "contact_email": "contact@casaelectronics.ma",
    "status_id": 1,
    "status_name": "Pending KYB"
  }
}
```

---

### 2.4 Update Merchant
**PATCH** `http://localhost:3000/merchants/{merchant-id}`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Body (all fields optional):**
```json
{
  "name": "Casa Electronics & Appliances",
  "category": "Electronics & Home Appliances",
  "city": "Casablanca",
  "contact_email": "info@casaelectronics.ma"
}
```

**Response (200):**
```json
{
  "message": "Merchant updated successfully",
  "merchant": {
    "id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
    "name": "Casa Electronics & Appliances",
    "category": "Electronics & Home Appliances",
    "city": "Casablanca",
    "contact_email": "info@casaelectronics.ma",
    "status_id": 1,
    "updated_at": "2026-03-08T11:00:00.000Z"
  }
}
```

---

### 2.5 Delete Merchant (Admin Only)
**DELETE** `http://localhost:3000/merchants/{merchant-id}`

**Headers:**
```
Authorization: Bearer ADMIN_ACCESS_TOKEN
```

**⚠️ Only operators with roleId = 1 (admin) can delete merchants!**

**Response (200):**
```json
{
  "message": "Merchant deleted successfully",
  "merchant_id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11"
}
```

**Error (403) - Non-admin tries to delete:**
```json
{
  "error": "Admin access required"
}
```

---

## 3. KYB DOCUMENT APIs

### 3.1 Add KYB Document
**POST** `http://localhost:3000/merchants/{merchant-id}/documents`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "document_type_id": 1,
  "is_verified": true
}
```

**Document Types:**
- `1` = Business Registration Certificate
- `2` = Owner Identity Document
- `3` = Bank Account Proof

**Response (201):**
```json
{
  "message": "Document added successfully",
  "document": {
    "id": "d1234567-e89b-12d3-a456-426614174000",
    "merchant_id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
    "document_type_id": 1,
    "document_type_name": "business_registration",
    "is_verified": true,
    "uploaded_at": "2026-03-08T10:35:00.000Z"
  }
}
```

**💡 Repeat this 3 times with document_type_id = 1, 2, 3 to complete KYB!**

---

### 3.2 Get Merchant Documents
**GET** `http://localhost:3000/merchants/{merchant-id}/documents`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200):**
```json
{
  "documents": [
    {
      "id": "d1234567-e89b-12d3-a456-426614174000",
      "merchant_id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
      "document_type_id": 1,
      "document_type_name": "business_registration",
      "is_verified": true,
      "uploaded_at": "2026-03-08T10:35:00.000Z"
    },
    {
      "id": "d2234567-e89b-12d3-a456-426614174000",
      "merchant_id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
      "document_type_id": 2,
      "document_type_name": "owner_identity",
      "is_verified": true,
      "uploaded_at": "2026-03-08T10:36:00.000Z"
    },
    {
      "id": "d3234567-e89b-12d3-a456-426614174000",
      "merchant_id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
      "document_type_id": 3,
      "document_type_name": "bank_proof",
      "is_verified": true,
      "uploaded_at": "2026-03-08T10:37:00.000Z"
    }
  ],
  "count": 3
}
```

---

## 4. MERCHANT STATUS APIs

### 4.1 Update Merchant Status
**PATCH** `http://localhost:3000/merchants/{merchant-id}/status`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "status_id": 2
}
```

**Status IDs:**
- `1` = Pending KYB
- `2` = Active
- `3` = Suspended

**Valid Transitions:**
- Pending (1) → Active (2) - Requires 3 verified KYB documents
- Active (2) → Suspended (3)
- Suspended (3) → Active (2)

**Response (200):**
```json
{
  "message": "Merchant status updated successfully",
  "merchant": {
    "id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
    "name": "Casa Electronics Store",
    "status_id": 2,
    "status_name": "Active",
    "updated_at": "2026-03-08T11:00:00.000Z"
  }
}
```

**Error (400) - KYB Incomplete:**
```json
{
  "error": "KYB Incomplete: Cannot activate merchant without 3 verified documents"
}
```

**Error (400) - Invalid Transition:**
```json
{
  "error": "Invalid status transition from Active to Pending KYB"
}
```

---

## 5. MERCHANT HISTORY API

### 5.1 Get Merchant Audit History
**GET** `http://localhost:3000/merchants/{merchant-id}/history`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200):**
```json
{
  "merchant_id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
  "history": [
    {
      "id": "log-3",
      "action": "STATUS_CHANGE",
      "old_values": {
        "status_id": 1
      },
      "new_values": {
        "status_id": 2
      },
      "created_at": "2026-03-08T11:00:00.000Z",
      "operator_name": "Admin User",
      "operator_email": "admin@test.com",
      "operator_role": "admin"
    },
    {
      "id": "log-2",
      "action": "UPDATE",
      "old_values": {
        "name": "Casa Electronics Store"
      },
      "new_values": {
        "name": "Casa Electronics & Appliances"
      },
      "created_at": "2026-03-08T10:50:00.000Z",
      "operator_name": "Admin User",
      "operator_email": "admin@test.com",
      "operator_role": "admin"
    },
    {
      "id": "log-1",
      "action": "MERCHANT_CREATED",
      "old_values": null,
      "new_values": {
        "name": "Casa Electronics Store",
        "category": "Electronics",
        "city": "Casablanca",
        "contact_email": "contact@casaelectronics.ma"
      },
      "created_at": "2026-03-08T10:30:00.000Z",
      "operator_name": "Admin User",
      "operator_email": "admin@test.com",
      "operator_role": "admin"
    }
  ],
  "total_events": 3
}
```

---

## 6. WEBHOOK SUBSCRIPTION APIs

### 6.1 Create Webhook Subscription
**POST** `http://localhost:3000/webhooks/subscriptions`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "name": "External System Integration",
  "url": "https://webhook.site/your-unique-id",
  "events": ["merchant.approved", "merchant.suspended"]
}
```

**💡 Get a test URL from https://webhook.site to see webhooks in real-time!**

**Events Available:**
- `merchant.approved` - Merchant status changed to Active
- `merchant.suspended` - Merchant status changed to Suspended
- `merchant.reactivated` - Suspended merchant reactivated

**Response (201):**
```json
{
  "message": "Webhook subscription created successfully",
  "subscription": {
    "id": "w1234567-e89b-12d3-a456-426614174000",
    "name": "External System Integration",
    "url": "https://webhook.site/your-unique-id",
    "secret": "a1b2c3d4e5f67890abcdef1234567890",
    "events": ["merchant.approved", "merchant.suspended"],
    "is_active": true,
    "created_at": "2026-03-08T11:00:00.000Z"
  }
}
```

**⚠️ Save the `secret` - you'll need it to verify webhook signatures!**

---

### 6.2 List Webhook Subscriptions
**GET** `http://localhost:3000/webhooks/subscriptions`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200):**
```json
{
  "subscriptions": [
    {
      "id": "w1234567-e89b-12d3-a456-426614174000",
      "name": "External System Integration",
      "url": "https://webhook.site/your-unique-id",
      "events": ["merchant.approved", "merchant.suspended"],
      "is_active": true,
      "created_at": "2026-03-08T11:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 6.3 Update Webhook Subscription (Enable/Disable)
**PATCH** `http://localhost:3000/webhooks/subscriptions/{subscription-id}`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "is_active": false
}
```

**Response (200):**
```json
{
  "message": "Webhook subscription updated successfully",
  "subscription": {
    "id": "w1234567-e89b-12d3-a456-426614174000",
    "is_active": false
  }
}
```

---

### 6.4 Delete Webhook Subscription
**DELETE** `http://localhost:3000/webhooks/subscriptions/{subscription-id}`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200):**
```json
{
  "message": "Webhook subscription deleted successfully"
}
```

---

### 6.5 Get Webhook Delivery History
**GET** `http://localhost:3000/webhooks/deliveries/{merchant-id}`

**Optional Query Parameter:**
- `?limit=50` - Limit number of results (default: 100)

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response (200):**
```json
{
  "deliveries": [
    {
      "id": "del-1",
      "merchant_id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
      "event_type": "merchant.approved",
      "target_url": "https://webhook.site/your-unique-id",
      "status": "success",
      "response_code": 200,
      "retry_count": 0,
      "last_attempt_at": "2026-03-08T11:00:05.000Z",
      "created_at": "2026-03-08T11:00:05.000Z"
    }
  ],
  "count": 1
}
```

**Delivery Statuses:**
- `pending` - Not yet sent
- `success` - Delivered successfully (HTTP 2xx response)
- `failed` - All retry attempts failed

---

## 7. COMPLETE TESTING FLOW

### Step-by-Step Test Sequence

1. **Login**
   ```
   POST /auth/login
   Body: {"email": "nanu@test.com", "password": "password123"}
   → Save accessToken
   ```

2. **Create Merchant**
   ```
   POST /merchants
   Body: {"name": "Test Store", "category": "Retail", "city": "Casablanca", "contact_email": "test@store.com"}
   → Save merchant_id
   ```

3. **Upload KYB Documents (3 times)**
   ```
   POST /merchants/{merchant-id}/documents
   Body: {"document_type_id": 1, "is_verified": true}
   
   POST /merchants/{merchant-id}/documents
   Body: {"document_type_id": 2, "is_verified": true}
   
   POST /merchants/{merchant-id}/documents
   Body: {"document_type_id": 3, "is_verified": true}
   ```

4. **Create Webhook Subscription**
   ```
   POST /webhooks/subscriptions
   Body: {"name": "Test Webhook", "url": "https://webhook.site/YOUR-ID"}
   ```

5. **Approve Merchant (Triggers Webhook)**
   ```
   PATCH /merchants/{merchant-id}/status
   Body: {"status_id": 2}
   → Check webhook.site to see the webhook received!
   ```

6. **View Merchant History**
   ```
   GET /merchants/{merchant-id}/history
   → See all changes made
   ```

7. **View Webhook Deliveries**
   ```
   GET /webhooks/deliveries/{merchant-id}
   → See webhook delivery status
   ```

8. **Suspend Merchant (Triggers Another Webhook)**
   ```
   PATCH /merchants/{merchant-id}/status
   Body: {"status_id": 3}
   ```

9. **Delete Merchant (Admin Only)**
   ```
   DELETE /merchants/{merchant-id}
   → Must use admin token!
   ```

---

## 8. WEBHOOK PAYLOAD FORMAT

When a merchant status changes, your webhook URL receives:

**Headers:**
```
Content-Type: application/json
X-Webhook-Signature: a1b2c3d4e5f67890abcdef1234567890
X-Webhook-Timestamp: 2026-03-08T11:00:05Z
```

**Body:**
```json
{
  "event": "merchant.approved",
  "timestamp": "2026-03-08T11:00:05Z",
  "data": {
    "merchant_id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
    "merchant_name": "Casa Electronics Store",
    "old_status": "Pending KYB",
    "new_status": "Active",
    "merchant": {
      "id": "c2ddebc9-9c0b-4ef8-bb6d-6bb9bd380a11",
      "name": "Casa Electronics Store",
      "category": "Electronics",
      "city": "Casablanca",
      "contact_email": "contact@casaelectronics.ma",
      "status": "Active"
    }
  }
}
```

---

## 9. ERROR RESPONSES

### Common Error Codes

**401 Unauthorized:**
```json
{
  "error": "Access token required"
}
```

**403 Forbidden:**
```json
{
  "error": "Admin access required"
}
```

**404 Not Found:**
```json
{
  "error": "Merchant not found"
}
```

**400 Bad Request:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["name"],
      "message": "Name is required"
    }
  ]
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to create merchant"
}
```

---

## 10. POSTMAN ENVIRONMENT VARIABLES

Create these variables in Postman for easier testing:

| Variable | Initial Value |
|----------|--------------|
| `baseUrl` | `http://localhost:3000` |
| `accessToken` | (Set after login) |
| `refreshToken` | (Set after login) |
| `merchantId` | (Set after creating merchant) |
| `subscriptionId` | (Set after creating webhook) |

**Example Usage:**
```
POST {{baseUrl}}/merchants
Authorization: Bearer {{accessToken}}
```

---

## 11. TESTING ROLE-BASED ACCESS

### Test Admin-Only Endpoints

1. **Login as Regular Operator:**
   ```json
   {"email": "operator@test.com", "password": "password123"}
   ```

2. **Try to Delete Merchant:**
   ```
   DELETE /merchants/{merchant-id}
   → Should get 403 Forbidden
   ```

3. **Login as Admin:**
   ```json
   {"email": "admin@test.com", "password": "password123"}
   ```

4. **Delete Merchant:**
   ```
   DELETE /merchants/{merchant-id}
   → Should succeed with 200
   ```

---

## 12. TIPS FOR TESTING

✅ **Use webhook.site** for easy webhook testing without setting up a server

✅ **Test invalid transitions** - Try to go from Active (2) → Pending (1) to see validation

✅ **Test KYB enforcement** - Try to activate merchant without uploading all 3 documents

✅ **Check audit logs** - Every change should appear in merchant history

✅ **Test retry logic** - Use a fake URL in webhook subscription and check deliveries

✅ **Verify signatures** - Use the webhook secret to validate HMAC signatures

✅ **Test filters** - Try `/merchants?status_id=2&city=Casablanca`

✅ **Test pagination** - Use `?limit=10` on deliveries endpoint
