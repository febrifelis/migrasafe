DO $$
BEGIN
  EXECUTE 'DROP TABLE ' || table_name;
END;
$$ LANGUAGE plpgsql;
