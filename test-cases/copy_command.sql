COPY users FROM '/tmp/users.csv' CSV HEADER;
COPY (SELECT * FROM users) TO '/tmp/export.csv' CSV HEADER;
