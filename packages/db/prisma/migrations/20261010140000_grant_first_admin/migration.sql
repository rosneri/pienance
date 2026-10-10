-- Data migration: the first admin. Promotes the existing account only; it never grants a role
-- at sign-up (emails are not verified, so whoever registered the address first would get it).
-- Further admins: UPDATE "user" SET "role" = 'admin' WHERE "email" = '…';
DO $$
DECLARE
  promoted integer;
BEGIN
  UPDATE "user" SET "role" = 'admin' WHERE lower("email") = 'neri.coder@gmail.com';
  GET DIAGNOSTICS promoted = ROW_COUNT;
  RAISE NOTICE 'First admin: % account(s) promoted', promoted;
END $$;
