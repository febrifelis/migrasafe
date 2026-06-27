CREATE TABLE orders_2024 (CHECK (created_at >= '2024-01-01' AND created_at < '2025-01-01'))
  INHERITS (orders);

ALTER TABLE orders ATTACH PARTITION orders_2024
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
