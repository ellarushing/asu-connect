-- Club Visibility Debugging Script
-- Run this in your Supabase SQL Editor to diagnose club visibility issues

-- ============================================================================
-- 1. CHECK ALL CLUBS AND THEIR APPROVAL STATUS
-- ============================================================================
SELECT
  c.id,
  c.name,
  c.approval_status,
  c.created_at,
  p.email as creator_email,
  p.is_admin as creator_is_admin
FROM clubs c
LEFT JOIN profiles p ON p.id = c.created_by
ORDER BY c.created_at DESC
LIMIT 20;

-- ============================================================================
-- 2. CHECK RLS POLICIES ON CLUBS TABLE
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'clubs'
ORDER BY policyname;

-- ============================================================================
-- 3. TEST THE is_admin() FUNCTION
-- ============================================================================
-- This checks if the is_admin function is working correctly
SELECT is_admin(auth.uid()) as current_user_is_admin;

-- ============================================================================
-- 4. CHECK WHAT CLUBS THE CURRENT USER CAN SEE
-- ============================================================================
-- Run this while logged in as a student to see what you can access
SELECT
  c.id,
  c.name,
  c.approval_status,
  c.created_by = auth.uid() as i_created_it,
  is_admin(auth.uid()) as i_am_admin,
  p.email as creator_email
FROM clubs c
LEFT JOIN profiles p ON p.id = c.created_by
WHERE
  c.approval_status = 'approved'
  OR c.created_by = auth.uid()
  OR is_admin(auth.uid());

-- ============================================================================
-- 5. CHECK PROFILES TABLE FOR ADMIN FLAGS
-- ============================================================================
SELECT
  id,
  email,
  full_name,
  is_admin,
  created_at
FROM profiles
WHERE is_admin = true
ORDER BY created_at DESC;

-- ============================================================================
-- 6. VERIFY THE NEW RLS POLICY EXISTS
-- ============================================================================
SELECT
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'clubs' AND policyname = 'clubs_insert';

-- ============================================================================
-- QUICK FIXES (if needed)
-- ============================================================================

-- FIX 1: If admin-created clubs have 'pending' status, approve them
-- UNCOMMENT to run:
-- UPDATE clubs
-- SET approval_status = 'approved',
--     approved_at = NOW()
-- WHERE created_by IN (
--   SELECT id FROM profiles WHERE is_admin = true
-- )
-- AND approval_status = 'pending';

-- FIX 2: If a specific club needs to be approved manually
-- UNCOMMENT and replace 'CLUB_ID_HERE' with actual club ID:
-- UPDATE clubs
-- SET approval_status = 'approved',
--     approved_at = NOW()
-- WHERE id = 'CLUB_ID_HERE';

-- FIX 3: Check if RLS is enabled on clubs table
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'clubs';

-- If rowsecurity is false, enable it with:
-- ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
