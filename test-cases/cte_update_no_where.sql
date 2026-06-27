-- Test case: UPDATE without WHERE preceded by a CTE should be flagged CRITICAL
-- Bug: isMissingWhere() checked if SQL starts with "UPDATE", but CTE statements
-- start with "WITH" — so the check always returned false (no issue reported).
-- Fix: stripCTEPrefix() extracts the DML part before the WHERE check.

WITH active_users AS (
  SELECT id FROM users WHERE active = true
)
UPDATE user_stats SET count = (SELECT COUNT(*) FROM active_users);
