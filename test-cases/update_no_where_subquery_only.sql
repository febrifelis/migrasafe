UPDATE users SET verified = true
FROM (SELECT 1) AS t;
