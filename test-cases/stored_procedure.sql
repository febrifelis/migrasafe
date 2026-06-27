CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  DELETE FROM logs WHERE created_at < NOW() - INTERVAL '90 days';
  UPDATE users SET last_cleanup = NOW() WHERE active = true;
END;
$$ LANGUAGE plpgsql;
