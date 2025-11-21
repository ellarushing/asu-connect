-- ============================================================================
-- Fix Infinite Recursion in club_members RLS Policies
-- ============================================================================
-- Migration 021's rollback re-introduced the infinite recursion bug
-- This migration properly fixes it by avoiding self-referential policies
-- Created: 2025-11-18
-- ============================================================================

-- Drop the problematic policy that queries club_members from within club_members
DROP POLICY IF EXISTS "Club admins can manage members" ON public.club_members;

-- ============================================================================
-- SOLUTION: Split the monolithic policy into specific operation policies
-- that avoid querying club_members from within club_members policies
-- ============================================================================

-- Policy 1: Club CREATORS can add members (checks clubs table, no recursion)
CREATE POLICY "Club creators can add members"
  ON public.club_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      -- User is the club creator
      EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = club_members.club_id
        AND created_by = auth.uid()
      )
      OR
      -- OR user is joining themselves
      user_id = auth.uid()
    )
  );

-- Policy 2: Club CREATORS can update member roles (checks clubs table, no recursion)
CREATE POLICY "Club creators can update member roles"
  ON public.club_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
  );

-- Policy 3: Club CREATORS can remove members (checks clubs table, no recursion)
-- AND users can remove themselves
CREATE POLICY "Club creators can remove members"
  ON public.club_members
  FOR DELETE
  USING (
    -- User is the club creator
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
    OR
    -- OR user is removing themselves
    user_id = auth.uid()
  );

-- ============================================================================
-- Additional fix: Update event creation policy to also check club creators
-- This ensures club creators can create events even if they're not explicitly
-- marked as admin in club_members
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;

CREATE POLICY "Authenticated users can create events"
  ON public.events
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND created_by = auth.uid()
    AND (
      -- User is admin of the club
      EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = events.club_id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'approved'
      )
      OR
      -- OR user is the club creator
      EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = events.club_id
        AND created_by = auth.uid()
      )
    )
  );

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'club_members';

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Infinite Recursion Fix Applied';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total policies on club_members: %', policy_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Fixed policies:';
    RAISE NOTICE '- Club creators can add members';
    RAISE NOTICE '- Club creators can update member roles';
    RAISE NOTICE '- Club creators can remove members';
    RAISE NOTICE '- Users can join clubs (unchanged)';
    RAISE NOTICE '- Users can leave clubs (unchanged)';
    RAISE NOTICE '- Users can view club members (unchanged)';
    RAISE NOTICE '';
    RAISE NOTICE 'Event creation policy also updated to allow club creators';
    RAISE NOTICE '========================================';
END $$;
