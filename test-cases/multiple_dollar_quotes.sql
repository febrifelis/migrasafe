CREATE OR REPLACE FUNCTION safe_fn() RETURNS void AS $body$
BEGIN
  INSERT INTO logs(msg) VALUES('ok');
END;
$body$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION also_safe() RETURNS void AS $func$
BEGIN
  UPDATE stats SET count = count + 1 WHERE id = 1;
END;
$func$ LANGUAGE plpgsql;
