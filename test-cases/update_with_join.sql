UPDATE orders o
SET status = 'cancelled'
FROM expired_orders e
WHERE o.id = e.order_id;
