-- DROP TABLE is just a comment here, should not be detected
/* TRUNCATE is also a comment */
CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  message TEXT
);
