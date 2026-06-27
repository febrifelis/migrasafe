CREATE OR REPLACE PROCEDURE archive_old_orders(cutoff_date DATE)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO orders_archive SELECT * FROM orders WHERE created_at < cutoff_date;
  DELETE FROM orders WHERE created_at < cutoff_date;
  COMMIT;
END;
$$;
