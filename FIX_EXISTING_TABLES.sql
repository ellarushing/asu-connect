-- ============================================================================
-- EMERGENCY FIX FOR EXISTING TABLES - RUN THIS BEFORE COMPLETE_DATABASE_SETUP.sql
-- ============================================================================
--
-- PURPOSE:
-- This script fixes constraint naming issues in existing event_flags and
-- club_flags tables. The COMPLETE_DATABASE_SETUP.sql script expects specific
-- constraint names, but if your tables were created earlier, they may have
-- auto-generated constraint names.
--
-- WHEN TO USE:
-- Run this BEFORE running COMPLETE_DATABASE_SETUP.sql if you have existing
-- event_flags or club_flags tables.
--
-- WHAT IT DOES:
-- 1. Finds and drops ANY unique constraint on event_flags(event_id, user_id)
--    regardless of its current name
-- 2. Recreates it with the correct name: event_flags_unique_user_event
-- 3. Does the same for club_flags(club_id, user_id) with name: club_flags_unique_user_club
-- 4. Handles cases where tables don't exist (no error)
-- 5. Handles cases where constraints already have correct names (no-op)
-- 6. Is idempotent - safe to run multiple times
--
-- HOW TO USE:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this ENTIRE file
-- 3. Click "Run"
-- 4. Check the output messages for success
-- 5. Then run COMPLETE_DATABASE_SETUP.sql
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: FIX EVENT_FLAGS TABLE CONSTRAINTS
-- ============================================================================

DO $$
DECLARE
  table_exists BOOLEAN;
  wrong_constraint_name TEXT;
  correct_constraint_exists BOOLEAN;
BEGIN
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'FIXING event_flags TABLE CONSTRAINTS';
  RAISE NOTICE '========================================================================';

  -- Check if event_flags table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'event_flags'
  ) INTO table_exists;

  IF NOT table_exists THEN
    RAISE NOTICE 'Table event_flags does not exist - skipping';
    RAISE NOTICE 'This is OK if you have not created the table yet';
    RAISE NOTICE '------------------------------------------------------------------------';
    RETURN;
  END IF;

  RAISE NOTICE 'Table event_flags exists - checking constraints...';

  -- Check if correct constraint already exists
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.event_flags'::regclass
    AND conname = 'event_flags_unique_user_event'
    AND contype = 'u'
  ) INTO correct_constraint_exists;

  IF correct_constraint_exists THEN
    RAISE NOTICE 'Constraint event_flags_unique_user_event already exists with correct name';
    RAISE NOTICE 'No fix needed for event_flags';
    RAISE NOTICE '------------------------------------------------------------------------';
    RETURN;
  END IF;

  -- Find any unique constraint on (event_id, user_id) with wrong name
  SELECT conname INTO wrong_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.event_flags'::regclass
  AND contype = 'u'
  AND pg_get_constraintdef(oid) LIKE '%event_id%user_id%'
  AND conname != 'event_flags_unique_user_event'
  LIMIT 1;

  IF wrong_constraint_name IS NOT NULL THEN
    RAISE NOTICE 'Found incorrectly named constraint: %', wrong_constraint_name;
    RAISE NOTICE 'Dropping constraint: %', wrong_constraint_name;

    EXECUTE format('ALTER TABLE public.event_flags DROP CONSTRAINT IF EXISTS %I', wrong_constraint_name);

    RAISE NOTICE 'Successfully dropped: %', wrong_constraint_name;
  ELSE
    RAISE NOTICE 'No incorrectly named constraint found';
  END IF;

  -- Create constraint with correct name
  RAISE NOTICE 'Creating constraint with correct name: event_flags_unique_user_event';

  BEGIN
    ALTER TABLE public.event_flags
      ADD CONSTRAINT event_flags_unique_user_event UNIQUE (event_id, user_id);
    RAISE NOTICE 'Successfully created constraint: event_flags_unique_user_event';
  EXCEPTION
    WHEN duplicate_table THEN
      RAISE NOTICE 'Constraint event_flags_unique_user_event already exists (this is OK)';
    WHEN others THEN
      RAISE NOTICE 'Error creating constraint: % - %', SQLERRM, SQLSTATE;
  END;

  RAISE NOTICE '------------------------------------------------------------------------';

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Table event_flags does not exist - skipping';
    RAISE NOTICE '------------------------------------------------------------------------';
  WHEN others THEN
    RAISE NOTICE 'Unexpected error: % - %', SQLERRM, SQLSTATE;
    RAISE NOTICE '------------------------------------------------------------------------';
END $$;

-- ============================================================================
-- SECTION 2: FIX CLUB_FLAGS TABLE CONSTRAINTS
-- ============================================================================

DO $$
DECLARE
  table_exists BOOLEAN;
  wrong_constraint_name TEXT;
  correct_constraint_exists BOOLEAN;
BEGIN
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'FIXING club_flags TABLE CONSTRAINTS';
  RAISE NOTICE '========================================================================';

  -- Check if club_flags table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'club_flags'
  ) INTO table_exists;

  IF NOT table_exists THEN
    RAISE NOTICE 'Table club_flags does not exist - skipping';
    RAISE NOTICE 'This is OK if you have not created the table yet';
    RAISE NOTICE '------------------------------------------------------------------------';
    RETURN;
  END IF;

  RAISE NOTICE 'Table club_flags exists - checking constraints...';

  -- Check if correct constraint already exists
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.club_flags'::regclass
    AND conname = 'club_flags_unique_user_club'
    AND contype = 'u'
  ) INTO correct_constraint_exists;

  IF correct_constraint_exists THEN
    RAISE NOTICE 'Constraint club_flags_unique_user_club already exists with correct name';
    RAISE NOTICE 'No fix needed for club_flags';
    RAISE NOTICE '------------------------------------------------------------------------';
    RETURN;
  END IF;

  -- Find any unique constraint on (club_id, user_id) with wrong name
  SELECT conname INTO wrong_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.club_flags'::regclass
  AND contype = 'u'
  AND pg_get_constraintdef(oid) LIKE '%club_id%user_id%'
  AND conname != 'club_flags_unique_user_club'
  LIMIT 1;

  IF wrong_constraint_name IS NOT NULL THEN
    RAISE NOTICE 'Found incorrectly named constraint: %', wrong_constraint_name;
    RAISE NOTICE 'Dropping constraint: %', wrong_constraint_name;

    EXECUTE format('ALTER TABLE public.club_flags DROP CONSTRAINT IF EXISTS %I', wrong_constraint_name);

    RAISE NOTICE 'Successfully dropped: %', wrong_constraint_name;
  ELSE
    RAISE NOTICE 'No incorrectly named constraint found';
  END IF;

  -- Create constraint with correct name
  RAISE NOTICE 'Creating constraint with correct name: club_flags_unique_user_club';

  BEGIN
    ALTER TABLE public.club_flags
      ADD CONSTRAINT club_flags_unique_user_club UNIQUE (club_id, user_id);
    RAISE NOTICE 'Successfully created constraint: club_flags_unique_user_club';
  EXCEPTION
    WHEN duplicate_table THEN
      RAISE NOTICE 'Constraint club_flags_unique_user_club already exists (this is OK)';
    WHEN others THEN
      RAISE NOTICE 'Error creating constraint: % - %', SQLERRM, SQLSTATE;
  END;

  RAISE NOTICE '------------------------------------------------------------------------';

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Table club_flags does not exist - skipping';
    RAISE NOTICE '------------------------------------------------------------------------';
  WHEN others THEN
    RAISE NOTICE 'Unexpected error: % - %', SQLERRM, SQLSTATE;
    RAISE NOTICE '------------------------------------------------------------------------';
END $$;

-- ============================================================================
-- SECTION 3: VERIFICATION
-- ============================================================================

DO $$
DECLARE
  event_flags_exists BOOLEAN;
  club_flags_exists BOOLEAN;
  event_flags_constraint_ok BOOLEAN;
  club_flags_constraint_ok BOOLEAN;
  success_count INTEGER := 0;
  total_count INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'VERIFICATION RESULTS';
  RAISE NOTICE '========================================================================';

  -- Check event_flags
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'event_flags'
  ) INTO event_flags_exists;

  IF event_flags_exists THEN
    total_count := total_count + 1;

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.event_flags'::regclass
      AND conname = 'event_flags_unique_user_event'
      AND contype = 'u'
    ) INTO event_flags_constraint_ok;

    IF event_flags_constraint_ok THEN
      RAISE NOTICE 'event_flags: Constraint event_flags_unique_user_event EXISTS';
      success_count := success_count + 1;
    ELSE
      RAISE NOTICE 'event_flags: Constraint event_flags_unique_user_event MISSING (may need manual fix)';
    END IF;
  ELSE
    RAISE NOTICE 'event_flags: Table does not exist (will be created by setup script)';
  END IF;

  -- Check club_flags
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'club_flags'
  ) INTO club_flags_exists;

  IF club_flags_exists THEN
    total_count := total_count + 1;

    SELECT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.club_flags'::regclass
      AND conname = 'club_flags_unique_user_club'
      AND contype = 'u'
    ) INTO club_flags_constraint_ok;

    IF club_flags_constraint_ok THEN
      RAISE NOTICE 'club_flags: Constraint club_flags_unique_user_club EXISTS';
      success_count := success_count + 1;
    ELSE
      RAISE NOTICE 'club_flags: Constraint club_flags_unique_user_club MISSING (may need manual fix)';
    END IF;
  ELSE
    RAISE NOTICE 'club_flags: Table does not exist (will be created by setup script)';
  END IF;

  RAISE NOTICE '------------------------------------------------------------------------';

  IF total_count = 0 THEN
    RAISE NOTICE 'RESULT: No existing tables found';
    RAISE NOTICE 'ACTION: You can safely run COMPLETE_DATABASE_SETUP.sql now';
  ELSIF success_count = total_count THEN
    RAISE NOTICE 'RESULT: All existing constraints are now correctly named';
    RAISE NOTICE 'ACTION: You can safely run COMPLETE_DATABASE_SETUP.sql now';
  ELSE
    RAISE NOTICE 'RESULT: Some constraints may still have issues';
    RAISE NOTICE 'ACTION: Review the messages above and fix manually if needed';
  END IF;

  RAISE NOTICE '========================================================================';
END $$;

COMMIT;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This script has:
-- 1. Checked for existing event_flags and club_flags tables
-- 2. Fixed any incorrectly named unique constraints
-- 3. Ensured constraints have the correct names expected by COMPLETE_DATABASE_SETUP.sql
-- 4. Handled all edge cases gracefully (no errors if tables don't exist)
-- 5. Verified the fixes
--
-- NEXT STEPS:
-- 1. Review the verification results above
-- 2. If all constraints are correct, run COMPLETE_DATABASE_SETUP.sql
-- 3. If there are issues, review the error messages and fix manually
--
-- SAFE TO RUN MULTIPLE TIMES:
-- This script is idempotent - you can run it multiple times without harm.
-- It will only make changes if needed.
-- ============================================================================
