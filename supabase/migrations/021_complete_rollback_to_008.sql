-- ============================================================================
-- COMPLETE ROLLBACK TO MIGRATION 008 STATE
-- ============================================================================
-- This migration rolls back ALL changes made by migrations 009-020
-- It restores the database to the state after migration 008_add_club_members_status.sql
-- Created: 2025-11-18
-- Safe to run multiple times (idempotent)
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop all policies that were added/modified by migrations 009-020
-- ============================================================================

-- Drop policies from migration 020 (rejoin policies)
DROP POLICY IF EXISTS "Members can rejoin after leaving" ON public.club_members;

-- Drop policies from migration 017 (club join final fix)
DROP POLICY IF EXISTS "Users can join clubs (insert new membership)" ON public.club_members;
DROP POLICY IF EXISTS "Users can update their left status to rejoin" ON public.club_members;

-- Drop policies from migration 015 (club join insert policy fix)
DROP POLICY IF EXISTS "Users can insert their own membership (join club)" ON public.club_members;

-- Drop policies from migration 014 (RLS and membership fix)
DROP POLICY IF EXISTS "Users can create membership when joining club" ON public.club_members;
DROP POLICY IF EXISTS "Members can view their own membership" ON public.club_members;
DROP POLICY IF EXISTS "Club leaders can view all club members" ON public.club_members;
DROP POLICY IF EXISTS "Club leaders can update member status" ON public.club_members;
DROP POLICY IF EXISTS "Members can leave club (delete membership)" ON public.club_members;

-- Drop policies from migration 013 (fix infinite recursion)
DROP POLICY IF EXISTS "allow_insert_club_members" ON public.club_members;
DROP POLICY IF EXISTS "allow_select_club_members" ON public.club_members;
DROP POLICY IF EXISTS "allow_update_club_members" ON public.club_members;
DROP POLICY IF EXISTS "allow_delete_club_members" ON public.club_members;

-- Drop policies from migration 012 (complete RLS optimization)
DROP POLICY IF EXISTS "select_own_membership" ON public.club_members;
DROP POLICY IF EXISTS "select_club_leader_view" ON public.club_members;
DROP POLICY IF EXISTS "insert_self_join" ON public.club_members;
DROP POLICY IF EXISTS "update_club_leader" ON public.club_members;
DROP POLICY IF EXISTS "delete_own_membership" ON public.club_members;

-- Drop policies from migration 011 (fix clubs insert policy)
DROP POLICY IF EXISTS "allow_authenticated_insert_clubs" ON public.clubs;

-- Drop policies from migration 009 (optimize admin RLS)
DROP POLICY IF EXISTS "Admins have full access to all clubs" ON public.clubs;
DROP POLICY IF EXISTS "Admins have full access to all events" ON public.events;
DROP POLICY IF EXISTS "Admins have full access to all club_members" ON public.club_members;
DROP POLICY IF EXISTS "Admins have full access to all event_registrations" ON public.event_registrations;

-- ============================================================================
-- STEP 2: Remove any columns added by migrations 009-020
-- ============================================================================

-- Note: Migration 010 added 'left' to the status check constraint
-- We need to revert this back to just the original three statuses
ALTER TABLE public.club_members
DROP CONSTRAINT IF EXISTS club_members_status_check;

-- Recreate the original constraint (from migration 008)
ALTER TABLE public.club_members
ADD CONSTRAINT club_members_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));

-- Update any 'left' status records back to 'approved' to preserve data
UPDATE public.club_members
SET status = 'approved'
WHERE status = 'left';

-- ============================================================================
-- STEP 3: Recreate the ORIGINAL policies from before migration 009
-- ============================================================================
-- These are the policies that existed after migration 008

-- CLUBS table policies (from 004_admin_moderation_system.sql)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'clubs'
        AND policyname = 'clubs_select_approved'
    ) THEN
        CREATE POLICY clubs_select_approved ON public.clubs
            FOR SELECT
            USING (
                approval_status = 'approved'
                OR created_by = auth.uid()
                OR is_admin(auth.uid())
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'clubs'
        AND policyname = 'clubs_insert'
    ) THEN
        CREATE POLICY clubs_insert ON public.clubs
            FOR INSERT
            WITH CHECK (
                auth.uid() = created_by
                AND approval_status = 'pending'
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'clubs'
        AND policyname = 'clubs_update_own'
    ) THEN
        CREATE POLICY clubs_update_own ON public.clubs
            FOR UPDATE
            USING (auth.uid() = created_by)
            WITH CHECK (
                auth.uid() = created_by
                -- Prevent changing approval status/fields
                AND approval_status = (SELECT approval_status FROM clubs WHERE id = clubs.id)
                AND approved_by IS NOT DISTINCT FROM (SELECT approved_by FROM clubs WHERE id = clubs.id)
                AND approved_at IS NOT DISTINCT FROM (SELECT approved_at FROM clubs WHERE id = clubs.id)
                AND rejection_reason IS NOT DISTINCT FROM (SELECT rejection_reason FROM clubs WHERE id = clubs.id)
            );
    END IF;
END $$;

-- EVENTS table policies (from 001_initial_schema.sql)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'events'
        AND policyname = 'Events are publicly viewable'
    ) THEN
        CREATE POLICY "Events are publicly viewable" ON public.events
            FOR SELECT
            USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'events'
        AND policyname = 'Authenticated users can create events'
    ) THEN
        CREATE POLICY "Authenticated users can create events" ON public.events
            FOR INSERT
            WITH CHECK (
                auth.role() = 'authenticated'
                AND created_by = auth.uid()
                AND EXISTS (
                    SELECT 1 FROM public.club_members
                    WHERE club_id = events.club_id
                    AND user_id = auth.uid()
                    AND role = 'admin'
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'events'
        AND policyname = 'Event creators can update their events'
    ) THEN
        CREATE POLICY "Event creators can update their events" ON public.events
            FOR UPDATE
            USING (auth.uid() = created_by);
    END IF;
END $$;

-- CLUB_MEMBERS table policies (from 001_initial_schema.sql and 002_fix_rls_infinite_recursion.sql)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'club_members'
        AND policyname = 'Users can view club members'
    ) THEN
        CREATE POLICY "Users can view club members" ON public.club_members
            FOR SELECT
            USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'club_members'
        AND policyname = 'Users can join clubs'
    ) THEN
        CREATE POLICY "Users can join clubs" ON public.club_members
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'club_members'
        AND policyname = 'Club admins can manage members'
    ) THEN
        CREATE POLICY "Club admins can manage members" ON public.club_members
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.club_members cm
                    WHERE cm.club_id = club_members.club_id
                    AND cm.user_id = auth.uid()
                    AND cm.role IN ('admin', 'moderator')
                    AND cm.status = 'approved'
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'club_members'
        AND policyname = 'Users can leave clubs'
    ) THEN
        CREATE POLICY "Users can leave clubs" ON public.club_members
            FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- EVENT_REGISTRATIONS table policies (from 001_initial_schema.sql)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'event_registrations'
        AND policyname = 'Users can view their own registrations'
    ) THEN
        CREATE POLICY "Users can view their own registrations" ON public.event_registrations
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'event_registrations'
        AND policyname = 'Users can register for events'
    ) THEN
        CREATE POLICY "Users can register for events" ON public.event_registrations
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'event_registrations'
        AND policyname = 'Users can cancel their registrations'
    ) THEN
        CREATE POLICY "Users can cancel their registrations" ON public.event_registrations
            FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'event_registrations'
        AND policyname = 'Event organizers can view registrations'
    ) THEN
        CREATE POLICY "Event organizers can view registrations" ON public.event_registrations
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.events e
                    WHERE e.id = event_registrations.event_id
                    AND e.created_by = auth.uid()
                )
            );
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Verification queries
-- ============================================================================

-- Show current policies on critical tables
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename IN ('clubs', 'events', 'club_members', 'event_registrations');

    RAISE NOTICE '========================================';
    RAISE NOTICE 'ROLLBACK COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total policies on core tables: %', policy_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Database has been restored to migration 008 state';
    RAISE NOTICE 'All changes from migrations 009-020 have been reverted';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Delete migration files 009-020 from disk';
    RAISE NOTICE '2. Restore code files to their previous state';
    RAISE NOTICE '3. Test basic club join/leave functionality';
    RAISE NOTICE '========================================';
END $$;
