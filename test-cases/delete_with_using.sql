DELETE FROM orders
USING expired_orders
WHERE orders.id = expired_orders.order_id;
