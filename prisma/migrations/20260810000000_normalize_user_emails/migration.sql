-- Normalize all User.email rows to lowercase (#142).
--
-- Login and forgot-password both look up the row via the normalized form,
-- but staff creation had been storing whatever casing the operator typed.
-- This backfill lines the stored data up with how it's actually queried.
--
-- Guard first: if two rows collide when lowercased (e.g. Jane@Example.com
-- and jane@example.com), the naive UPDATE below would violate the
-- @unique index halfway through and leave the table in an inconsistent
-- state. Fail loudly with an actionable message instead.

DO $$
DECLARE
  collision_pairs INTEGER;
BEGIN
  SELECT COUNT(*) INTO collision_pairs
  FROM (
    SELECT lower(email) AS normalized
    FROM "User"
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
  ) c;

  IF collision_pairs > 0 THEN
    RAISE EXCEPTION 'Email normalization aborted: % emails collide when lowercased. Resolve duplicate User rows before re-running this migration.', collision_pairs;
  END IF;
END $$;

UPDATE "User" SET email = lower(email) WHERE email <> lower(email);
