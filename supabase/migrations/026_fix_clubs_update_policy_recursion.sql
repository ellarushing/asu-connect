-- Migration: Fix infinite recursion in clubs update policy
-- Created: 2025-11-19
-- Description: Fixes the infinite recursion error when admins try to approve/reject clubs
--              by replacing the is_admin() function call with a direct role check
--
-- Root Cause: The clubs_update_admin policy uses is_admin() which queries profiles table,
--             which has RLS policies that also call is_admin(), creating infinite recursion.
--
-- Solution: Query the role enum directly (same pattern as migration 025)

BEGIN;

-- ============================================================================
-- Drop the problematic policy
-- ============================================================================

DROP POLICY IF EXISTS clubs_update_admin ON clubs;

-- ============================================================================
-- Create new policy with direct role check (no function call)
-- ============================================================================

CREATE POLICY clubs_update_admin
ON clubs
FOR UPDATE
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

COMMENT ON POLICY clubs_update_admin ON clubs IS
'Admins can update any club. Uses direct role check to avoid infinite recursion from is_admin() function.';

-- ============================================================================
-- Also fix clubs_select_approved policy to prevent potential recursion
-- ============================================================================

DROP POLICY IF EXISTS clubs_select_approved ON clubs;

CREATE POLICY clubs_select_approved
ON clubs
FOR SELECT
USING (
    approval_status = 'approved'
    OR auth.uid() = created_by
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

COMMENT ON POLICY clubs_select_approved ON clubs IS
'Users can view: approved clubs, their own clubs (any status), or all clubs if they are admin. Uses direct role check to avoid recursion.';

COMMIT;

-- ============================================================================
-- Verification Queries (run separately to test)
-- ============================================================================

-- Check the updated policies
-- SELECT policyname, policycmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'clubs' AND policyname IN ('clubs_update_admin', 'clubs_select_approved');

-- Test admin update permission (should work without recursion)
-- UPDATE clubs
-- SET approval_status = 'approved'
-- WHERE id = 'some-club-id';
