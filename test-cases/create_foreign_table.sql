CREATE FOREIGN TABLE remote_orders (
  id INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ
) SERVER remote_db OPTIONS (table_name 'orders');
