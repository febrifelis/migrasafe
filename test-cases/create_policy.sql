CREATE POLICY user_isolation ON accounts
  USING (owner_id = current_user_id());

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
