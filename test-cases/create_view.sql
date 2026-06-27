CREATE OR REPLACE VIEW active_users AS
  SELECT id, email, name FROM users WHERE deleted_at IS NULL;
