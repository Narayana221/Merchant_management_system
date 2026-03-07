-- operator_roles: lookup table for operator permission levels
CREATE TABLE IF NOT EXISTS operator_roles (
  id   SERIAL PRIMARY KEY,
  name TEXT   NOT NULL UNIQUE
);

INSERT INTO operator_roles (id, name) VALUES
  (1, 'admin'),
  (2, 'operator')
ON CONFLICT (id) DO NOTHING;
