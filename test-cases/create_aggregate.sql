CREATE AGGREGATE sum_positive (NUMERIC) (
  SFUNC = numeric_add,
  STYPE = NUMERIC,
  INITCOND = '0'
);
