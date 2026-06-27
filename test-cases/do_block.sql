DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM users WHERE active = true;
  RAISE NOTICE 'Active users: %', v_count;
END;
$$;
