DELETE FROM orders WHERE user_id IN (
  SELECT id FROM users WHERE status = 'banned'
);
