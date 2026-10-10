-- Role-based access: every user is a member; admins also operate pienance (e.g. /admin).
-- Grant with: UPDATE "user" SET "role" = 'admin' WHERE "email" = '…';
CREATE TYPE "Role" AS ENUM ('member', 'admin');

ALTER TABLE "user" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'member';
