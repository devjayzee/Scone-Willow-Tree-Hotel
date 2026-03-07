/*
  Warnings:

  - Made the column `guestPhone` on table `Booking` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "guestEmail" DROP NOT NULL,
ALTER COLUMN "guestPhone" SET NOT NULL;
