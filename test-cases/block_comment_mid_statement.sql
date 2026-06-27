ALTER TABLE users
  /* adding phone */
  ADD COLUMN phone VARCHAR(20);
DROP /* careful */ TABLE /* very careful */ legacy_data;
