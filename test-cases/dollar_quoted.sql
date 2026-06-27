CREATE OR REPLACE FUNCTION audit() RETURNS trigger AS $$
BEGIN
  -- DROP TABLE would be logged here
  INSERT INTO audit_log VALUES (OLD.id, 'DROP TABLE attempted');
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
