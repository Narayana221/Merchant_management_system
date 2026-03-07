-- merchants: merchant accounts with status
CREATE TABLE IF NOT EXISTS merchants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  category      TEXT,
  city          TEXT,
  contact_email TEXT,
  status_id     INT  NOT NULL DEFAULT 1 REFERENCES merchant_statuses(id)
);

CREATE INDEX IF NOT EXISTS idx_merchants_status_id ON merchants(status_id);
CREATE INDEX IF NOT EXISTS idx_merchants_contact_email ON merchants(contact_email);
