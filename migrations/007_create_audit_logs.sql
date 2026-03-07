-- audit_logs: immutable history of status changes (no UPDATE/DELETE allowed)
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID REFERENCES merchants(id),
  operator_id   UUID REFERENCES operators(id),
  old_status_id INT  REFERENCES merchant_statuses(id),
  new_status_id INT  REFERENCES merchant_statuses(id),
  changed_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant_id ON audit_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs(changed_at);

-- Deny UPDATE and DELETE on audit_logs (immutable)
CREATE OR REPLACE FUNCTION audit_logs_deny_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'UPDATE is not allowed on audit_logs';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DELETE is not allowed on audit_logs';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_deny_update ON audit_logs;
DROP TRIGGER IF EXISTS audit_logs_deny_delete ON audit_logs;

CREATE TRIGGER audit_logs_deny_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_deny_update_delete();

CREATE TRIGGER audit_logs_deny_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_deny_update_delete();

