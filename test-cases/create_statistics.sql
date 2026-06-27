CREATE STATISTICS orders_stats (dependencies)
  ON customer_id, status FROM orders;

ANALYZE orders;
