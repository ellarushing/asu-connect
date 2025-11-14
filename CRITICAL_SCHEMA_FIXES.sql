-- ============================================================================
-- CRITICAL SCHEMA FIXES FOR ASU CONNECT
-- ============================================================================
--
-- WHAT THIS DOES:
-- Adds only the essential missing columns that are causing 500 errors
-- when creating events and joining clubs.
--
-- HOW TO USE:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this ENTIRE file
-- 3. Click "Run"
-- 4. Check for success messages
--
-- IMPORTANT:
-- - Only run this if your base tables (clubs, events, club_members,
--   event_registrations) already exist
-- - This script is idempotent - it won't fail if columns already exist
-- - This does NOT include RLS policies or indexes (those can be added later)
--
-- ============================================================================

-- ============================================================================
-- FIX 1: Add category, is_free, and price columns to events table
-- ============================================================================
-- These columns are required by the event creation API

-- Add category column (allows NULL for existing events)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS category TEXT
CHECK (category IN ('Academic', 'Social', 'Sports', 'Arts', 'Career', 'Community Service', 'Other'));

-- Add is_free column (defaults to true for existing events)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT true;

-- Add price column (allows NULL)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2)
CHECK (price IS NULL OR price >= 0);

-- ============================================================================
-- FIX 2: Add status column to club_members table
-- ============================================================================
-- This column is required by the club membership API for approval workflow

-- Add status column (defaults to 'approved' for existing members)
-- IMPORTANT: Default is 'approved' so that club creators (who are auto-added as admin)
-- don't need approval. Regular members who join will set status='pending' explicitly.
ALTER TABLE public.club_members
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Update any existing members to 'approved' status (safe to run multiple times)
UPDATE public.club_members
SET status = 'approved'
WHERE status IS NULL OR status = '';

-- ============================================================================
-- FIX 3: Create event_flags table
-- ============================================================================
-- This table is required by the event flagging API

-- Create event_flags table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.event_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS on event_flags (required for security)
ALTER TABLE public.event_flags ENABLE ROW LEVEL SECURITY;

-- Add minimal RLS policies for event_flags
-- Policy 1: Users can view flags they created OR flags for events they created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_flags'
    AND policyname = 'Event flags are viewable by event creator and flag creator'
  ) THEN
    CREATE POLICY "Event flags are viewable by event creator and flag creator"
      ON public.event_flags
      FOR SELECT
      USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM public.events
          WHERE id = event_flags.event_id
          AND created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- Policy 2: Authenticated users can create flags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_flags'
    AND policyname = 'Authenticated users can flag events'
  ) THEN
    CREATE POLICY "Authenticated users can flag events"
      ON public.event_flags
      FOR INSERT
      WITH CHECK (
        auth.role() = 'authenticated'
        AND user_id = auth.uid()
      );
  END IF;
END $$;

-- Policy 3: Event creators can update flag status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_flags'
    AND policyname = 'Event creators can update flag status'
  ) THEN
    CREATE POLICY "Event creators can update flag status"
      ON public.event_flags
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.events
          WHERE id = event_flags.event_id
          AND created_by = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.events
          WHERE id = event_flags.event_id
          AND created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these queries to verify the changes were applied:

-- Check events table columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'events'
-- AND column_name IN ('category', 'is_free', 'price')
-- ORDER BY column_name;

-- Check club_members table columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'club_members'
-- AND column_name = 'status';

-- Check if event_flags table exists
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_name = 'event_flags'
-- AND table_schema = 'public';

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- Your app should now work for:
-- - Creating events with categories and pricing
-- - Joining clubs with approval workflow
-- - Flagging events for review
--
-- NEXT STEPS (optional, for production):
-- 1. Add indexes for better query performance
-- 2. Add additional constraints and validation
-- 3. Review and update RLS policies as needed
-- ============================================================================
