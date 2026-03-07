-- document_types: lookup table for KYB document types
CREATE TABLE IF NOT EXISTS document_types (
  id   SERIAL PRIMARY KEY,
  name TEXT   NOT NULL UNIQUE
);

INSERT INTO document_types (id, name) VALUES
  (1, 'business_registration'),
  (2, 'owner_identity'),
  (3, 'bank_proof')
ON CONFLICT (id) DO NOTHING;
