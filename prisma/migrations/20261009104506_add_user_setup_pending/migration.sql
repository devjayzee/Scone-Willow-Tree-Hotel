-- AlterTable
ALTER TABLE "User" ADD COLUMN     "setupPending" BOOLEAN NOT NULL DEFAULT false;

-- Mark as pending only accounts we can prove are unredeemed invites:
--  * inactive, AND
--  * tokenVersion = 0: never redeemed any SETUP/RESET token, AND
--  * a SETUP token was minted within 5 minutes of the user row, i.e. the
--    account came from createStaff's invite flow (002716c, 2026-08-10), AND
--  * a GM never explicitly deactivated it (STAFF_DEACTIVATED audit row);
--    a missing audit row falls back to the rules above.
UPDATE "User" u SET "setupPending" = true
WHERE u."isActive" = false
  AND u."tokenVersion" = 0
  AND EXISTS (
    SELECT 1 FROM "PasswordResetToken" t
    WHERE t."userId" = u.id AND t.purpose = 'SETUP'
      AND t."createdAt" BETWEEN u."createdAt" - interval '5 minutes'
                            AND u."createdAt" + interval '5 minutes')
  AND NOT EXISTS (
    SELECT 1 FROM "AuditLog" a
    WHERE a."entityType" = 'STAFF' AND a."entityId" = u.id
      AND a.action = 'STAFF_DEACTIVATED');

-- Void unused setup links on accounts that are not pending. The new code
-- refuses these anyway; voiding them closes the window where the old
-- deployment (still serving after migrate deploy) would redeem them.
-- DateTime columns are timestamp(3) without time zone, holding UTC.
UPDATE "PasswordResetToken" t SET "usedAt" = (now() AT TIME ZONE 'UTC')
FROM "User" u
WHERE t."userId" = u.id AND t.purpose = 'SETUP'
  AND t."usedAt" IS NULL AND u."setupPending" = false;

-- Enforce setupPending => !isActive. Old code running against the migrated
-- database (deploy window, or a code-only revert) must fail instead of
-- writing a pending and active row. Prisma does not model CHECK constraints.
ALTER TABLE "User" ADD CONSTRAINT "User_setupPending_inactive_check" CHECK (NOT ("setupPending" AND "isActive"));
