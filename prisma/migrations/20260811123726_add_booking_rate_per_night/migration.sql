-- Add ratePerNight as a per-booking snapshot of the room's rate at
-- creation time (#185). Existing rows are backfilled with the room's
-- CURRENT price — best-guess approximation. Any booking whose room
-- was re-priced between its creation and this migration will show
-- the post-re-price rate. The audit accepts this as the only
-- practical option; future bookings snapshot correctly.

-- 1. Add nullable
ALTER TABLE "Booking" ADD COLUMN "ratePerNight" DECIMAL(10, 2);

-- 2. Backfill from the room's current price
UPDATE "Booking"
  SET "ratePerNight" = "Room"."pricePerNight"
  FROM "Room"
  WHERE "Booking"."roomId" = "Room"."id";

-- 3. Enforce NOT NULL now that every row has a value
ALTER TABLE "Booking" ALTER COLUMN "ratePerNight" SET NOT NULL;
