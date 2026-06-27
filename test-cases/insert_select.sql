INSERT INTO archive_orders SELECT * FROM orders WHERE created_at < '2023-01-01';
DELETE FROM orders WHERE created_at < '2023-01-01';
