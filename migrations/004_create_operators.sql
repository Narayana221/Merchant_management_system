-- operators: system users with roles and login security
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS operators (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT      NOT NULL UNIQUE,
  password_hash TEXT      NOT NULL,
  role_id       INT       NOT NULL REFERENCES operator_roles(id),
  login_attempts INT      NOT NULL DEFAULT 0,
  lock_until    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operators_email ON operators(email);
CREATE INDEX IF NOT EXISTS idx_operators_role_id ON operators(role_id);
