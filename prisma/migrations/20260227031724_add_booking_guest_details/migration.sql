-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "additionalGuests" TEXT,
ADD COLUMN     "bondDeposit" DECIMAL(10,2),
ADD COLUMN     "checkInTime" TEXT,
ADD COLUMN     "checkOutTime" TEXT,
ADD COLUMN     "guestAddress" TEXT,
ADD COLUMN     "guestDateOfBirth" TIMESTAMP(3),
ADD COLUMN     "vehicleRego" TEXT;
