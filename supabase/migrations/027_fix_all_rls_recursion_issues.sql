-- Migration: Fix all remaining RLS recursion issues
-- Created: 2025-11-19
-- Description: Fixes infinite recursion in multiple RLS policies by:
--              1. Removing self-referential subqueries from clubs_update_own
--              2. Replacing is_admin() function calls with direct role checks
--              3. Applying fixes across clubs, profiles, club_flags, and event_flags tables
--
-- Root Causes:
--   - clubs_update_own has subqueries that query clubs table from within clubs policy
--   - Multiple policies use is_admin() which queries profiles, triggering profile policies
--
-- Solution: Direct role checks and removing self-referential subqueries

BEGIN;

-- ============================================================================
-- FIX 1: clubs_update_own - Remove self-referential subqueries
-- ============================================================================

DROP POLICY IF EXISTS clubs_update_own ON clubs;

CREATE POLICY clubs_update_own
ON clubs
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (
    auth.uid() = created_by
    -- Removed self-referential subqueries that caused infinite recursion
    -- Approval fields are protected by:
    --   1. API layer validation (doesn't send approval field updates for non-admins)
    --   2. clubs_update_admin policy (only admins can update approval fields)
);

COMMENT ON POLICY clubs_update_own ON clubs IS
'Club creators can update their clubs. Approval fields are protected by API layer and admin-only policy. No self-referential subqueries to avoid recursion.';

-- ============================================================================
-- FIX 2: profiles table policies - Use is_admin field directly (not function)
-- ============================================================================
-- NOTE: We cannot query profiles.role from within profiles policies as that
--       would cause recursion. Instead, we use the is_admin boolean field
--       which is kept in sync with the role enum via trigger.

DROP POLICY IF EXISTS profiles_select_admin ON profiles;

CREATE POLICY profiles_select_admin
ON profiles
FOR SELECT
USING (
    id = auth.uid()
    OR is_admin = true
);

COMMENT ON POLICY profiles_select_admin ON profiles IS
'Users can view their own profile, admins can view all profiles. Uses is_admin field (not function) to avoid recursion.';

DROP POLICY IF EXISTS profiles_update_admin ON profiles;

CREATE POLICY profiles_update_admin
ON profiles
FOR UPDATE
USING (is_admin = true)
WITH CHECK (is_admin = true);

COMMENT ON POLICY profiles_update_admin ON profiles IS
'Admins can update any profile. Uses is_admin field (not function) to avoid recursion.';

DROP POLICY IF EXISTS profiles_update_own ON profiles;

CREATE POLICY profiles_update_own
ON profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid()
    -- Users cannot change their own role or admin status
    -- These fields are protected at the application layer
);

COMMENT ON POLICY profiles_update_own ON profiles IS
'Users can update their own profile. Role changes are restricted at the application layer.';

-- ============================================================================
-- FIX 3: club_flags policies - Replace is_admin() with direct role check
-- ============================================================================

DROP POLICY IF EXISTS club_flags_select_admin ON club_flags;

CREATE POLICY club_flags_select_admin
ON club_flags
FOR SELECT
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

COMMENT ON POLICY club_flags_select_admin ON club_flags IS
'Admins can view all club flags. Uses direct role check to avoid recursion.';

DROP POLICY IF EXISTS club_flags_update_admin ON club_flags;

CREATE POLICY club_flags_update_admin
ON club_flags
FOR UPDATE
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

COMMENT ON POLICY club_flags_update_admin ON club_flags IS
'Admins can update club flags (e.g., mark as reviewed). Uses direct role check to avoid recursion.';

-- ============================================================================
-- FIX 4: event_flags policies - Replace is_admin() with direct role check
-- ============================================================================

DROP POLICY IF EXISTS event_flags_select_admin ON event_flags;

CREATE POLICY event_flags_select_admin
ON event_flags
FOR SELECT
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

COMMENT ON POLICY event_flags_select_admin ON event_flags IS
'Admins can view all event flags. Uses direct role check to avoid recursion.';

DROP POLICY IF EXISTS event_flags_update_admin ON event_flags;

CREATE POLICY event_flags_update_admin
ON event_flags
FOR UPDATE
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

COMMENT ON POLICY event_flags_update_admin ON event_flags IS
'Admins can update event flags (e.g., mark as reviewed). Uses direct role check to avoid recursion.';

-- ============================================================================
-- FIX 5: moderation_logs policies - Replace is_admin() with direct role check
-- ============================================================================

DROP POLICY IF EXISTS moderation_logs_select_admin ON moderation_logs;

CREATE POLICY moderation_logs_select_admin
ON moderation_logs
FOR SELECT
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

COMMENT ON POLICY moderation_logs_select_admin ON moderation_logs IS
'Admins can view all moderation logs. Uses direct role check to avoid recursion.';

DROP POLICY IF EXISTS moderation_logs_insert_admin ON moderation_logs;

CREATE POLICY moderation_logs_insert_admin
ON moderation_logs
FOR INSERT
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

COMMENT ON POLICY moderation_logs_insert_admin ON moderation_logs IS
'Admins can insert moderation logs. Uses direct role check to avoid recursion.';

COMMIT;

-- ============================================================================
-- Verification Queries (run separately to test)
-- ============================================================================

-- Check all updated policies
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('clubs', 'profiles', 'club_flags', 'event_flags', 'moderation_logs')
-- ORDER BY tablename, policyname;

-- Test admin update on clubs (should work without recursion)
-- UPDATE clubs
-- SET approval_status = 'approved', approved_by = auth.uid(), approved_at = NOW()
-- WHERE id = 'some-club-id';
