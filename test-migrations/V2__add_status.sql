ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL;

DROP COLUMN users.old_field;

UPDATE users SET status = 'active';

CREATE INDEX idx_status ON users(status);
