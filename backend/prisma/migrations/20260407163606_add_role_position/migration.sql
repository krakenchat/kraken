-- AlterTable
ALTER TABLE "Role" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 50;

-- Set positions for default community roles
UPDATE "Role" SET "position" = 10 WHERE "name" = 'Community Admin' AND "isDefault" = true;
UPDATE "Role" SET "position" = 20 WHERE "name" = 'Moderator' AND "isDefault" = true;
UPDATE "Role" SET "position" = 100 WHERE "name" = 'Member' AND "isDefault" = true;

-- Set positions for default instance roles
UPDATE "Role" SET "position" = 10 WHERE "name" = 'Instance Admin' AND "isDefault" = true;
UPDATE "Role" SET "position" = 20 WHERE "name" = 'Community Creator' AND "isDefault" = true;
UPDATE "Role" SET "position" = 30 WHERE "name" = 'User Manager' AND "isDefault" = true;
UPDATE "Role" SET "position" = 40 WHERE "name" = 'Invite Manager' AND "isDefault" = true;
