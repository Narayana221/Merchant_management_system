# Merchant Management System

A robust backend system for managing merchant onboarding, KYB (Know Your Business) verification, status management, and webhook notifications built with Express.js, PostgreSQL, and JWT authentication.

## Features

- 🔐 **JWT Authentication** - Secure access and refresh token system
- 👥 **Role-Based Access Control** - Admin and operator roles with different permissions
- 📋 **Merchant Management** - Full CRUD operations with status tracking
- 📄 **KYB Document Verification** - Upload and verify business documents
- 📊 **Audit History** - Complete audit trail of all merchant status changes
- 🔔 **Webhook System** - Real-time notifications for merchant status changes
- ✅ **Comprehensive Testing** - 60 tests covering all functionality
- 📖 **API Documentation** - Complete Postman testing guide included

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js 4.21.0
- **Database:** PostgreSQL
- **Authentication:** JWT (jsonwebtoken)
- **Validation:** Zod
- **Testing:** Jest + Supertest
- **Password Hashing:** bcrypt

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- **PostgreSQL** >= 14 ([Download](https://www.postgresql.org/download/))
- **npm** (comes with Node.js)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Narayana221/Merchant_management_system.git
cd Merchant_management_system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory by copying the example:

```bash
cp .env.example .env
```

Edit the `.env` file and configure your environment variables:

```env
# Server Configuration
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=merchant_management_system_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT Configuration (IMPORTANT: Use strong random strings in production!)
JWT_ACCESS_SECRET=your-super-secret-access-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
```

**⚠️ Security Note:** Generate strong random secrets for production:

```bash
# Generate random secrets (macOS/Linux)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Set Up PostgreSQL Database

#### Option A: Using PostgreSQL CLI

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE merchant_management_system_db;

# Create user (if needed)
CREATE USER your_db_user WITH PASSWORD 'your_db_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE merchant_management_system_db TO your_db_user;

# Exit
\q
```

#### Option B: Using createdb command

```bash
createdb merchant_management_system_db
```

### 5. Run Database Migrations

The migrations will create all necessary tables (operators, merchants, audit_logs, etc.):

```bash
npm run migrate
```

This will automatically run all migration files in order and create:
- `operator_roles` - Admin and operator role definitions
- `merchant_statuses` - Status lookup table
- `document_types` - KYB document types
- `operators` - System users
- `merchants` - Merchant records
- `kyb_documents` - Document verification tracking
- `audit_logs` - Status change history
- `webhook_deliveries` - Webhook delivery tracking
- `webhook_subscriptions` - Webhook endpoint registrations

Expected output:
```
Committed migration: 001_create_operator_roles.sql
Committed migration: 002_create_merchant_statuses.sql
...
All migrations applied successfully.
```

### 6. Create Test Operator (Optional)

To quickly get started, create a test admin operator:

```bash
psql -d merchant_management_system_db
```

```sql
-- Insert test admin operator
INSERT INTO operators (id, email, password_hash, role_id)
VALUES (
  'a1234567-e89b-12d3-a456-426614174000',
  'nanu@test.com',
  '$2b$10$YXnQHue3YxzJ/YsZQxZDOO4UPFQEmz6FEj7OzmJXhBZHLCLN8Gjii', -- password: password123
  1  -- admin role
);
```

### 7. Start the Server

#### Development Mode (with auto-reload)

```bash
npm run dev
```

#### Production Mode

```bash
npm start
```

The server will start on `http://localhost:3000` (or the PORT you specified in `.env`)

### 8. Verify Installation

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status": "ok"}
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm test:watch
```

### Test Coverage

The project includes 60 comprehensive tests covering:
- Authentication (login, token refresh)
- Merchant CRUD operations
- KYB document management
- Status transitions with validation
- Admin-only operations
- Webhook subscriptions and deliveries

Expected output:
```
Test Suites: 5 passed, 5 total
Tests:       60 passed, 60 total
```

## API Documentation

Comprehensive API documentation with example requests and responses is available in:

📖 **[POSTMAN_TESTING_GUIDE.md](./POSTMAN_TESTING_GUIDE.md)**

### Quick API Overview

#### Authentication
- `POST /auth/login` - Login and get access tokens
- `POST /auth/refresh` - Refresh access token

#### Merchants
- `POST /merchants` - Create merchant
- `GET /merchants` - List merchants (with filters)
- `GET /merchants/:id` - Get merchant details
- `PATCH /merchants/:id` - Update merchant
- `DELETE /merchants/:id` - Delete merchant (Admin only)
- `GET /merchants/:id/history` - Get merchant audit history

#### KYB Documents
- `POST /merchants/:id/documents` - Add KYB document
- `GET /merchants/:id/documents` - List merchant documents

#### Status Management
- `PATCH /merchants/:id/status` - Update merchant status

#### Webhooks
- `POST /webhooks/subscriptions` - Create webhook subscription
- `GET /webhooks/subscriptions` - List subscriptions
- `PATCH /webhooks/subscriptions/:id` - Update subscription
- `DELETE /webhooks/subscriptions/:id` - Delete subscription
- `GET /webhooks/deliveries/:merchantId` - View delivery history

## Project Structure

```
MerchantMS/
├── src/
│   ├── controllers/        # Request handlers
│   │   ├── authController.js
│   │   ├── merchantController.js
│   │   └── webhookController.js
│   ├── db/                # Database configuration
│   │   └── index.js
│   ├── middleware/        # Express middleware
│   │   └── auth.js        # JWT authentication
│   ├── routes/            # API routes
│   │   ├── authRoutes.js
│   │   ├── merchantRoutes.js
│   │   └── webhookRoutes.js
│   ├── services/          # Business logic
│   │   ├── authService.js
│   │   ├── merchantService.js
│   │   └── webhookService.js
│   └── index.js           # Application entry point
├── migrations/            # Database migrations
│   ├── 001_create_operator_roles.sql
│   ├── 002_create_merchant_statuses.sql
│   ├── 003_create_document_types.sql
│   ├── 004_create_operators.sql
│   ├── 005_create_merchants.sql
│   ├── 006_create_kyb_documents.sql
│   ├── 007_create_audit_logs.sql
│   ├── 008_create_webhook_deliveries.sql
│   └── 009_create_webhook_subscriptions.sql
├── tests/                 # Test suites
│   ├── auth.test.js
│   ├── merchant.test.js
│   ├── kyb.test.js
│   ├── webhook.test.js
│   ├── admin.test.js
│   └── helpers/
│       └── tokenHelper.js
├── .env.example          # Environment variables template
├── package.json
├── jest.config.js
├── POSTMAN_TESTING_GUIDE.md
└── README.md
```

## Database Schema

### Core Tables

- **operator_roles** - Admin and operator role definitions
- **operators** - System users with authentication
- **merchant_statuses** - Status lookup (Pending KYB, Active, Suspended)
- **merchants** - Merchant records
- **document_types** - KYB document type definitions
- **kyb_documents** - Merchant verification documents
- **audit_logs** - Status change history
- **webhook_subscriptions** - Webhook endpoints
- **webhook_deliveries** - Webhook delivery tracking

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | No | Server port | `3000` |
| `DB_HOST` | Yes | PostgreSQL host | `localhost` |
| `DB_PORT` | Yes | PostgreSQL port | `5432` |
| `DB_NAME` | Yes | Database name | `merchant_management_system_db` |
| `DB_USER` | Yes | Database user | `postgres` |
| `DB_PASSWORD` | Yes | Database password | `your_password` |
| `JWT_ACCESS_SECRET` | Yes | Access token secret | `random-64-char-string` |
| `JWT_REFRESH_SECRET` | Yes | Refresh token secret | `random-64-char-string` |

### Issue: Migration errors

**Solution:** Ensure you run migrations in order (001, 002, 003...)

### Issue: Tests failing

**Solution:** Tests use mocked database connections, ensure all dependencies are installed:
```bash
npm install
npm test
```

## Development Workflow

1. **Start Development Server:**
   ```bash
   npm run dev
   ```
   
2. **Make Changes** - Server auto-reloads with `--watch` flag

3. **Run Tests:**
   ```bash
   npm test
   ```

4. **Test APIs** - Use Postman with the provided [testing guide](./POSTMAN_TESTING_GUIDE.md)

## Production Deployment

### Checklist

- [ ] Use strong random JWT secrets (not the example values)
- [ ] Set `NODE_ENV=production`
- [ ] Use environment variables for all configuration
- [ ] Enable database SSL connection
- [ ] Set up proper logging
- [ ] Configure CORS if serving a frontend
- [ ] Set up database backups
- [ ] Use a process manager (PM2, systemd)
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring and alerts

## API Authentication

All endpoints (except `/auth/login` and `/auth/refresh`) require JWT authentication:

```bash
Authorization: Bearer <your_access_token>
```

### Example Request

```bash
curl -X GET http://localhost:3000/merchants \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Role-Based Access

- **Admin (roleId = 1):** Full access to all operations including merchant deletion
- **Operator (roleId = 2):** Can manage merchants but cannot delete them

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Testing Webhooks

Use [webhook.site](https://webhook.site) to test webhook deliveries:

1. Go to https://webhook.site
2. Copy your unique URL
3. Create a webhook subscription with that URL
4. Change merchant status to trigger webhooks
5. View deliveries in real-time on webhook.site

## License

This project is licensed under the MIT License.

## Support

For issues, questions, or contributions, please open an issue on GitHub.

## Author

**Narayana Menon S**

- GitHub: [@Narayana221](https://github.com/Narayana221)
- Repository: [Merchant_management_system](https://github.com/Narayana221/Merchant_management_system)

---

**Built using Node.js, Express, and PostgreSQL**
