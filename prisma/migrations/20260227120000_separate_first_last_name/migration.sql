-- Add firstName and lastName columns as nullable first
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Migrate data from name to firstName and lastName
-- Split the name by first space: first word becomes firstName, rest becomes lastName
UPDATE "User"
SET
  "firstName" = SPLIT_PART("name", ' ', 1),
  "lastName" = CASE
    WHEN POSITION(' ' IN "name") > 0
    THEN SUBSTRING("name" FROM POSITION(' ' IN "name") + 1)
    ELSE SPLIT_PART("name", ' ', 1)
  END;

-- Make columns NOT NULL
ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" SET NOT NULL;

-- Drop the old name column
ALTER TABLE "User" DROP COLUMN "name";
