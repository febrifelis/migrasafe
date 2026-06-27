-- Test case: suggest command with a rule that has no migration pattern
-- DROP TYPE triggers DROP_TYPE rule which has no pattern in src/ai/suggestions.ts
-- Expected: informative message shown, not silent exit
-- Bug: previously `migrasafe suggest` produced zero output when issues were
--      found but none had a matching pattern (seenRules was non-empty but
--      patternsShown stayed 0, so the fallback message was never printed)

DROP TYPE user_status;
