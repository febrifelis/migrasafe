CREATE MATERIALIZED VIEW monthly_sales AS
  SELECT DATE_TRUNC('month', created_at) AS month, SUM(amount) AS total
  FROM orders GROUP BY 1;
