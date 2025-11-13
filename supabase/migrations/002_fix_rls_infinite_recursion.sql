-- Migration: Fix RLS infinite recursion and improve policy logic
-- Issue: club_members RLS policies had circular dependencies
-- Solution: Simplify policies to avoid recursive table lookups

-- Drop problematic RLS policies on club_members
DROP POLICY IF EXISTS "Club admins can add members" ON public.club_members;
DROP POLICY IF EXISTS "Club admins can update member roles" ON public.club_members;
DROP POLICY IF EXISTS "Club admins can remove members" ON public.club_members;

-- ===== REVISED RLS POLICIES FOR club_members TABLE =====

-- Policy 1: Allow users to view all club members (public read)
-- This remains the same - safe to keep
-- (Already exists as "Club members are publicly viewable")

-- Policy 2: Users can join a club themselves (as member)
-- This remains the same - safe to keep
-- (Already exists as "Users can join clubs")

-- Policy 3: Users can remove themselves from clubs
-- This remains the same - safe to keep
-- (Already exists as "Users can remove themselves from clubs")

-- Policy 4: Club creators can add members
-- Simplified: Check if user is the club creator (from clubs table, not club_members)
CREATE POLICY "Club creators can add members"
  ON public.club_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
  );

-- Policy 5: Club creators can update member roles
-- Simplified: Check if user is the club creator (from clubs table, not club_members)
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

-- Policy 6: Club creators can remove members
-- Simplified: Check if user is the club creator (from clubs table, not club_members)
CREATE POLICY "Club creators can remove members"
  ON public.club_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
  );

-- ===== VERIFY event_registrations TABLE EXISTS =====
-- This table should already exist from initial migration
-- If it doesn't, uncomment the CREATE TABLE below

-- Ensure event_registrations table exists with proper structure
-- (If already exists, this will be skipped by Supabase)
-- CREATE TABLE IF NOT EXISTS public.event_registrations (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
--   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   UNIQUE(event_id, user_id)
-- );

-- ===== VERIFY RLS POLICIES FOR event_registrations =====
-- These policies are non-recursive and should work fine
-- They are already in the initial schema migration

-- Summary of changes:
-- 1. Replaced club_members RLS checks that queried club_members table
--    with checks that query the clubs table (club creator check)
-- 2. This eliminates circular dependencies causing infinite recursion
-- 3. Preserves functionality: only club creators can manage members
-- 4. event_registrations table should be accessible once club_members policies are fixed
