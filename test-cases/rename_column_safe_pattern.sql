ALTER TABLE users ADD COLUMN full_name VARCHAR(200);
UPDATE users SET full_name = name WHERE full_name IS NULL;
