-- kyb_documents: KYB documents per merchant and type
CREATE TABLE IF NOT EXISTS kyb_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id      UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  document_type_id INT  NOT NULL REFERENCES document_types(id),
  is_verified      BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(merchant_id, document_type_id)
);

CREATE INDEX IF NOT EXISTS idx_kyb_documents_merchant_id ON kyb_documents(merchant_id);
CREATE INDEX IF NOT EXISTS idx_kyb_documents_document_type_id ON kyb_documents(document_type_id);
