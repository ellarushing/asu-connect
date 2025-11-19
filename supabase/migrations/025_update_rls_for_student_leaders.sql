-- Migration: Update RLS policies for student leader role
-- Created: 2025-11-19
-- Description: Updates RLS policies to enforce student leader permissions
--              for club and event creation at the database level

BEGIN;

-- ============================================================================
-- Helper Functions for RLS Policies
-- ============================================================================

-- Drop existing clubs_insert policy
DROP POLICY IF EXISTS clubs_insert ON clubs;

-- Create new policy allowing only student leaders and admins to create clubs
CREATE POLICY clubs_insert
ON clubs
FOR INSERT
WITH CHECK (
    auth.uid() = created_by
    AND (
        -- Student leaders create pending clubs
        (
            (SELECT role FROM profiles WHERE id = auth.uid()) = 'student_leader'
            AND approval_status = 'pending'
        )
        OR
        -- Admins can create approved or pending clubs
        (
            (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
            AND approval_status IN ('pending', 'approved')
        )
    )
);

COMMENT ON POLICY clubs_insert ON clubs IS
'Only student leaders (pending clubs) and admins (approved clubs) can create clubs. Regular students cannot create clubs.';

-- ============================================================================
-- Update Event Creation Policy (if needed)
-- ============================================================================

-- Note: Event creation already requires club admin role via club_members
-- The student leader check should be enforced in the API layer
-- This ensures backwards compatibility

COMMIT;

-- ============================================================================
-- Verification Queries (run separately)
-- ============================================================================

-- Check the updated policy
-- SELECT * FROM pg_policies WHERE tablename = 'clubs' AND policyname = 'clubs_insert';

-- Test student leader permissions
-- SELECT p.email, p.role,
--        CASE WHEN p.role = 'student_leader' THEN 'Can create clubs (pending)'
--             WHEN p.role = 'admin' THEN 'Can create clubs (auto-approved)'
--             ELSE 'Cannot create clubs'
--        END as club_creation_permission
-- FROM profiles p
-- LIMIT 10;
