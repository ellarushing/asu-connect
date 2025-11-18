-- ============================================================================
-- COMPREHENSIVE DIAGNOSTIC CHECK FOR ASU CONNECT DATABASE
-- ============================================================================
-- This script checks the current state of your database schema
-- Run this in Supabase SQL Editor to see what exists and what's missing
-- Focus: Identifying the event_flags constraint name mismatch issue
-- ============================================================================

-- ============================================================================
-- SECTION 1: TABLE EXISTENCE CHECK
-- ============================================================================
SELECT '=== SECTION 1: TABLE EXISTENCE CHECK ===' as section;

SELECT
  table_name,
  CASE
    WHEN table_name IN (
      'profiles', 'clubs', 'events', 'club_members',
      'event_registrations', 'club_flags', 'event_flags', 'moderation_logs'
    ) THEN 'Expected Table Exists'
    ELSE 'Unexpected Table'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY
  CASE table_name
    WHEN 'profiles' THEN 1
    WHEN 'clubs' THEN 2
    WHEN 'events' THEN 3
    WHEN 'club_members' THEN 4
    WHEN 'event_registrations' THEN 5
    WHEN 'club_flags' THEN 6
    WHEN 'event_flags' THEN 7
    WHEN 'moderation_logs' THEN 8
    ELSE 99
  END;

-- Check for missing expected tables
SELECT
  expected_table,
  'MISSING - NEEDS TO BE CREATED' as status
FROM (
  VALUES
    ('profiles'),
    ('clubs'),
    ('events'),
    ('club_members'),
    ('event_registrations'),
    ('club_flags'),
    ('event_flags'),
    ('moderation_logs')
) AS expected(expected_table)
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = expected_table
);

-- ============================================================================
-- SECTION 2: CRITICAL - event_flags CONSTRAINT CHECK
-- ============================================================================
SELECT '=== SECTION 2: EVENT_FLAGS CONSTRAINT CHECK (CRITICAL) ===' as section;

-- This is the key check for your error
SELECT
  conname as constraint_name,
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
  END as constraint_type,
  pg_get_constraintdef(oid) as definition,
  CASE
    WHEN conname = 'event_flags_unique_user_event' THEN 'CORRECT - Named constraint exists'
    WHEN conname LIKE '%event_id%user_id%' THEN 'WRONG - Auto-generated name (THIS IS YOUR PROBLEM)'
    WHEN conname LIKE 'event_flags%pkey' THEN 'OK - Primary key'
    WHEN conname LIKE 'event_flags%check%' THEN 'OK - Check constraint'
    WHEN conname LIKE 'event_flags%fkey' THEN 'OK - Foreign key'
    ELSE 'UNKNOWN'
  END as status
FROM pg_constraint
WHERE conrelid = 'event_flags'::regclass
ORDER BY contype, conname;

-- ============================================================================
-- SECTION 3: FUNCTION EXISTENCE CHECK
-- ============================================================================
SELECT '=== SECTION 3: REQUIRED FUNCTION CHECK ===' as section;

SELECT
  proname as function_name,
  pronargs as num_args,
  CASE
    WHEN proname = 'is_admin' THEN 'Required by event_flags RLS policies'
    WHEN proname = 'log_moderation_action' THEN 'Required by event_flags triggers'
    ELSE 'Other function'
  END as purpose
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'is_admin',
    'log_moderation_action',
    'update_event_flags_updated_at',
    'log_event_flag_resolution'
  )
ORDER BY proname;

-- Check for missing critical functions
SELECT
  expected_function,
  'MISSING - Migration 004 not run or incomplete' as status
FROM (
  VALUES
    ('is_admin'),
    ('log_moderation_action')
) AS expected(expected_function)
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname = expected_function
);

-- ============================================================================
-- SECTION 4: COLUMN EXISTENCE CHECK
-- ============================================================================
SELECT '=== SECTION 4: COLUMN EXISTENCE CHECK ===' as section;

-- Check if profiles table has is_admin column (added in migration 004)
SELECT
  'profiles.is_admin' as column_check,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'is_admin'
    ) THEN 'EXISTS - Migration 004 applied'
    ELSE 'MISSING - Migration 004 not applied'
  END as status;

-- Check if clubs has approval columns (added in migration 004)
SELECT
  'clubs.approval_status' as column_check,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'clubs' AND column_name = 'approval_status'
    ) THEN 'EXISTS - Migration 004 applied'
    ELSE 'MISSING - Migration 004 not applied'
  END as status;

-- Check if events has category/pricing columns (added in migration 003)
SELECT
  'events.category' as column_check,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'category'
    ) THEN 'EXISTS - Migration 003 applied'
    ELSE 'MISSING - Migration 003 not applied'
  END as status;

SELECT
  'events.is_free' as column_check,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'is_free'
    ) THEN 'EXISTS - Migration 003 applied'
    ELSE 'MISSING - Migration 003 not applied'
  END as status;

-- ============================================================================
-- SECTION 5: RLS POLICY CHECK
-- ============================================================================
SELECT '=== SECTION 5: RLS POLICY CHECK ===' as section;

-- Check if RLS is enabled on event_flags
SELECT
  'event_flags RLS' as check_item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'event_flags' AND rowsecurity = true
    ) THEN 'ENABLED'
    ELSE 'DISABLED - Security risk!'
  END as status;

-- Count policies on event_flags
SELECT
  'event_flags policies' as check_item,
  COUNT(*)::text || ' policies' as status
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'event_flags';

-- List event_flags policies that use is_admin
SELECT
  policyname,
  'Uses is_admin() function' as dependency,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace AND proname = 'is_admin'
    ) THEN 'OK - Function exists'
    ELSE 'ERROR - Function missing, policy will fail'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'event_flags'
  AND (
    policyname LIKE '%admin%'
    OR qual LIKE '%is_admin%'
    OR with_check LIKE '%is_admin%'
  );

-- ============================================================================
-- SECTION 6: FINAL DIAGNOSIS AND FIX SCRIPT
-- ============================================================================
SELECT '=== SECTION 6: FINAL DIAGNOSIS ===' as section;

-- Generate diagnosis and fix script
DO $$
DECLARE
  has_event_flags BOOLEAN;
  has_correct_constraint BOOLEAN;
  wrong_constraint_name TEXT;
  has_is_admin BOOLEAN;
  has_log_function BOOLEAN;
BEGIN
  -- Check if event_flags exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'event_flags'
  ) INTO has_event_flags;

  -- Check if correct constraint exists
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'event_flags'::regclass
      AND conname = 'event_flags_unique_user_event'
  ) INTO has_correct_constraint;

  -- Get the wrong constraint name if it exists
  SELECT conname INTO wrong_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'event_flags'::regclass
    AND contype = 'u'
    AND conname != 'event_flags_unique_user_event'
  LIMIT 1;

  -- Check functions
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname = 'is_admin'
  ) INTO has_is_admin;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname = 'log_moderation_action'
  ) INTO has_log_function;

  -- Report findings
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'DIAGNOSTIC RESULTS';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE '';

  IF NOT has_event_flags THEN
    RAISE NOTICE 'STATUS: event_flags table DOES NOT EXIST';
    RAISE NOTICE 'ACTION: Run migration 005_add_event_flags_table.sql';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE 'STATUS: event_flags table EXISTS';
    RAISE NOTICE '';

    IF has_correct_constraint THEN
      RAISE NOTICE 'CONSTRAINT: event_flags_unique_user_event - CORRECT';
      RAISE NOTICE 'YOUR ERROR SHOULD BE RESOLVED';
    ELSE
      RAISE NOTICE 'CONSTRAINT: event_flags_unique_user_event - MISSING';
      RAISE NOTICE 'FOUND INSTEAD: %', COALESCE(wrong_constraint_name, 'No unique constraint found');
      RAISE NOTICE '';
      RAISE NOTICE 'THIS IS THE CAUSE OF YOUR ERROR!';
      RAISE NOTICE '';
      RAISE NOTICE '========================================================================';
      RAISE NOTICE 'FIX SCRIPT (Copy and run this)';
      RAISE NOTICE '========================================================================';
      RAISE NOTICE '';

      IF wrong_constraint_name IS NOT NULL THEN
        RAISE NOTICE '-- Step 1: Drop the incorrectly named constraint';
        RAISE NOTICE 'ALTER TABLE event_flags DROP CONSTRAINT %;', wrong_constraint_name;
        RAISE NOTICE '';
      END IF;

      RAISE NOTICE '-- Step 2: Add the correctly named constraint';
      RAISE NOTICE 'ALTER TABLE event_flags';
      RAISE NOTICE '  ADD CONSTRAINT event_flags_unique_user_event UNIQUE (event_id, user_id);';
      RAISE NOTICE '';
      RAISE NOTICE '-- Step 3: Add the comment (this was failing before)';
      RAISE NOTICE 'COMMENT ON CONSTRAINT event_flags_unique_user_event ON event_flags';
      RAISE NOTICE '  IS ''Prevents duplicate flags from the same user for the same event'';';
      RAISE NOTICE '';
    END IF;
  END IF;

  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'DEPENDENCY CHECK';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE '';

  IF NOT has_is_admin THEN
    RAISE NOTICE 'WARNING: is_admin() function MISSING';
    RAISE NOTICE 'ACTION: Run migration 004_admin_moderation_system.sql first';
  ELSE
    RAISE NOTICE 'OK: is_admin() function exists';
  END IF;

  IF NOT has_log_function THEN
    RAISE NOTICE 'WARNING: log_moderation_action() function MISSING';
    RAISE NOTICE 'ACTION: Run migration 004_admin_moderation_system.sql first';
  ELSE
    RAISE NOTICE 'OK: log_moderation_action() function exists';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'END OF DIAGNOSTIC';
  RAISE NOTICE '========================================================================';
END $$;
