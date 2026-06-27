CREATE TEMPORARY TABLE staging_import (
  id SERIAL PRIMARY KEY,
  raw_data JSONB,
  imported_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO staging_import (raw_data)
SELECT data FROM external_feed WHERE processed = false;
