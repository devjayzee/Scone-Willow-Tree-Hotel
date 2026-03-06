-- First, set all existing roomType values to NULL to avoid constraint errors
UPDATE "Room" SET "roomType" = NULL;

-- Drop the old enum and create the new one
-- PostgreSQL requires dropping and recreating enums

-- Create temporary new enum
CREATE TYPE "RoomType_new" AS ENUM ('STANDARD', 'LARGE', 'EXTRA_LARGE');

-- Alter the column to use the new enum (via text casting)
ALTER TABLE "Room" ALTER COLUMN "roomType" TYPE "RoomType_new" USING NULL;

-- Drop the old enum
DROP TYPE "RoomType";

-- Rename the new enum to the original name
ALTER TYPE "RoomType_new" RENAME TO "RoomType";
