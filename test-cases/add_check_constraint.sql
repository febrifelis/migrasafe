ALTER TABLE orders ADD CONSTRAINT chk_amount CHECK (amount > 0);
ALTER TABLE users ADD CONSTRAINT chk_email CHECK (email LIKE '%@%');
