-- merchant_statuses: lookup table for merchant lifecycle
CREATE TABLE IF NOT EXISTS merchant_statuses (
  id    SERIAL PRIMARY KEY,
  label TEXT   NOT NULL UNIQUE
);

INSERT INTO merchant_statuses (id, label) VALUES
  (1, 'Pending KYB'),
  (2, 'Active'),
  (3, 'Suspended')
ON CONFLICT (id) DO NOTHING;
