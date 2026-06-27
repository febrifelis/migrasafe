INSERT INTO settings (key, value)
VALUES ('theme', 'dark')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
