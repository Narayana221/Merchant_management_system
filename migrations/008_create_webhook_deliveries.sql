-- webhook_deliveries: outbound webhook events and delivery status
DO $$ BEGIN
  CREATE TYPE webhook_delivery_status AS ENUM ('pending', 'success', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id    UUID      NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  event_type     TEXT      NOT NULL,
  payload        JSONB     NOT NULL DEFAULT '{}',
  target_url     TEXT      NOT NULL,
  status         webhook_delivery_status NOT NULL DEFAULT 'pending',
  response_code  INT,
  retry_count    INT       NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_merchant_id ON webhook_deliveries(merchant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
