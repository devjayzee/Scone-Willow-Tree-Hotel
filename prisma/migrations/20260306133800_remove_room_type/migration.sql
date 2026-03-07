-- Remove roomType column from Room table
ALTER TABLE "Room" DROP COLUMN IF EXISTS "roomType";

-- Drop the RoomType enum
DROP TYPE IF EXISTS "RoomType";
