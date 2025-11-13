-- ASU Connect Database Schema Diagnostic Check
-- Run this in Supabase SQL Editor to verify your database state

-- ============================================================
-- SECTION 1: Check if tables exist
-- ============================================================
SELECT 'TABLE CHECK' as check_type;

SELECT
  'clubs' as table_name,
  EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clubs'
  )::text as exists
UNION ALL
SELECT
  'events' as table_name,
  EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'events'
  )::text as exists
UNION ALL
SELECT
  'club_members' as table_name,
  EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'club_members'
  )::text as exists
UNION ALL
SELECT
  'event_registrations' as table_name,
  EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'event_registrations'
  )::text as exists;

-- ============================================================
-- SECTION 2: Check RLS policies on club_members
-- ============================================================
SELECT 'RLS POLICIES ON club_members' as check_type;

SELECT
  policyname,
  permissive,
  cmd,
  CASE
    WHEN qual LIKE '%club_members%' AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    THEN 'WARNING: Recursive query detected'
    ELSE 'OK'
  END as recursion_check
FROM pg_policies
WHERE tablename = 'club_members'
ORDER BY policyname;

-- ============================================================
-- SECTION 3: Verify fixed policies exist
-- ============================================================
SELECT 'VERIFY FIX STATUS' as check_type;

SELECT
  'Club creators can add members' as expected_policy,
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = 'club_members'
    AND policyname = 'Club creators can add members'
  )::text as exists
UNION ALL
SELECT
  'Club creators can update member roles',
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = 'club_members'
    AND policyname = 'Club creators can update member roles'
  )::text
UNION ALL
SELECT
  'Club creators can remove members',
  EXISTS(
    SELECT 1 FROM pg_policies
    WHERE tablename = 'club_members'
    AND policyname = 'Club creators can remove members'
  )::text;

-- ============================================================
-- SECTION 4: List all policies (for manual verification)
-- ============================================================
SELECT 'ALL POLICIES' as check_type;

SELECT
  tablename,
  policyname,
  permissive,
  cmd,
  (CASE WHEN qual IS NOT NULL THEN 'Has condition' ELSE 'No condition' END) as condition_status
FROM pg_policies
WHERE tablename IN ('clubs', 'events', 'club_members', 'event_registrations')
ORDER BY tablename, policyname;

-- ============================================================
-- SECTION 5: Test if tables are accessible
-- ============================================================
SELECT 'TABLE ACCESS TEST' as check_type;

SELECT 'clubs - SELECT' as test, COUNT(*) as count FROM public.clubs
UNION ALL
SELECT 'events - SELECT', COUNT(*) FROM public.events
UNION ALL
SELECT 'club_members - SELECT', COUNT(*) FROM public.club_members
UNION ALL
SELECT 'event_registrations - SELECT', COUNT(*) FROM public.event_registrations;

-- ============================================================
-- SECTION 6: Check for old broken policies
-- ============================================================
SELECT 'BROKEN POLICIES CHECK' as check_type;

SELECT
  policyname,
  'SHOULD BE DROPPED' as status
FROM pg_policies
WHERE tablename = 'club_members'
AND policyname IN (
  'Club admins can add members',
  'Club admins can update member roles',
  'Club admins can remove members'
);

-- If this returns no rows, the fix was applied successfully!

-- ============================================================
-- SECTION 7: Schema summary
-- ============================================================
SELECT 'SCHEMA SUMMARY' as check_type;

SELECT
  schemaname,
  COUNT(*) as table_count
FROM pg_tables
WHERE schemaname = 'public'
GROUP BY schemaname;

-- ============================================================
-- INTERPRETATION
-- ============================================================
--
-- SECTION 1: All 4 tables should show 'true'
--   If any show 'false', tables are missing
--
-- SECTION 2: Should show ~5 policies for club_members
--   Should NOT see "WARNING: Recursive query detected"
--   If you see warnings, the fix hasn't been applied yet
--
-- SECTION 3: Should show 'true' for all 3 expected policies
--   If any show 'false', the fix hasn't been applied yet
--
-- SECTION 4: Shows all policies (for manual review)
--   Should see 'Club creators...' not 'Club admins...'
--
-- SECTION 5: Should not error (tables should be accessible)
--   If you get permission errors, RLS may still be corrupted
--
-- SECTION 6: Should return NO ROWS (broken policies deleted)
--   If you see 'Club admins can...' policies, fix wasn't applied
--
-- SECTION 7: Should show 'public' with 4 tables
--
-- ============================================================
-- SUMMARY
-- ============================================================
--
-- If all checks pass, your database is FIXED!
--
-- If any check fails:
-- 1. Read the diagnostics above
-- 2. Apply migration: 002_fix_rls_infinite_recursion.sql
-- 3. Re-run this diagnostic
--
-- ============================================================
