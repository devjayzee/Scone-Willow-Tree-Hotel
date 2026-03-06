/*
  Warnings:

  - The values [DOUBLE,TWIN,SUITE,DELUXE] on the enum `RoomType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RoomType_new" AS ENUM ('SINGLE', 'STANDARD_DOUBLE', 'QUEEN_DOUBLE', 'KING_SINGLE');
ALTER TABLE "Room" ALTER COLUMN "roomType" TYPE "RoomType_new" USING ("roomType"::text::"RoomType_new");
ALTER TYPE "RoomType" RENAME TO "RoomType_old";
ALTER TYPE "RoomType_new" RENAME TO "RoomType";
DROP TYPE "public"."RoomType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "pricePerNight" DECIMAL(10,2) NOT NULL DEFAULT 0;
