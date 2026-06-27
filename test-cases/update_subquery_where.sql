UPDATE users SET status = 'inactive' WHERE id IN (SELECT id FROM expired_users);
