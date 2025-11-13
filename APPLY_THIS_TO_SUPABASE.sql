-- ============================================================================
-- ASU CONNECT DATABASE SCHEMA - COMPLETE SETUP
-- ============================================================================
--
-- HOW TO USE THIS FILE:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Copy and paste the ENTIRE contents of this file
-- 5. Click "Run" to execute all statements
-- 6. Check for any errors in the output
--
-- WHAT THIS SCRIPT DOES:
-- - Creates 4 tables: clubs, events, club_members, event_registrations
-- - Sets up proper foreign key relationships and cascading deletes
-- - Creates 8 indexes for optimal query performance
-- - Enables Row Level Security (RLS) on all tables
-- - Creates 11 RLS policies with FIXED infinite recursion issues
--
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE TABLES
-- ============================================================================

-- Create clubs table
CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create club_members table
CREATE TABLE public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

-- Create event_registrations table
CREATE TABLE public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ============================================================================
-- STEP 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_clubs_created_by ON public.clubs(created_by);
CREATE INDEX idx_events_club_id ON public.events(club_id);
CREATE INDEX idx_events_created_by ON public.events(created_by);
CREATE INDEX idx_events_event_date ON public.events(event_date);
CREATE INDEX idx_club_members_club_id ON public.club_members(club_id);
CREATE INDEX idx_club_members_user_id ON public.club_members(user_id);
CREATE INDEX idx_event_registrations_event_id ON public.event_registrations(event_id);
CREATE INDEX idx_event_registrations_user_id ON public.event_registrations(user_id);

-- ============================================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ============================================================================

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: CREATE RLS POLICIES
-- ============================================================================
--
-- IMPORTANT: These policies have been carefully designed to avoid infinite
-- recursion. They do NOT have circular dependencies.
--
-- KEY PRINCIPLE: When checking club/event permissions, we query the clubs
-- or events table (which own the resource), not the club_members or
-- event_registrations tables (which would create circular dependencies).

-- ========================================
-- RLS POLICIES FOR CLUBS TABLE
-- ========================================

-- Anyone can view clubs (public read)
CREATE POLICY "Clubs are publicly viewable"
  ON public.clubs
  FOR SELECT
  USING (true);

-- Only authenticated users can create clubs
CREATE POLICY "Authenticated users can create clubs"
  ON public.clubs
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Only club creator can update their club
CREATE POLICY "Club creators can update their clubs"
  ON public.clubs
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Only club creator can delete their club
CREATE POLICY "Club creators can delete their clubs"
  ON public.clubs
  FOR DELETE
  USING (auth.uid() = created_by);

-- ========================================
-- RLS POLICIES FOR EVENTS TABLE
-- ========================================

-- Anyone can view events (public read)
CREATE POLICY "Events are publicly viewable"
  ON public.events
  FOR SELECT
  USING (true);

-- Only club creators can create events
-- FIXED: Checks if user is the club creator (avoids recursion)
CREATE POLICY "Authenticated users can create events"
  ON public.events
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = events.club_id
      AND created_by = auth.uid()
    )
  );

-- Only event creator can update their event
CREATE POLICY "Event creators can update their events"
  ON public.events
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Only event creator can delete their event
CREATE POLICY "Event creators can delete their events"
  ON public.events
  FOR DELETE
  USING (auth.uid() = created_by);

-- ========================================
-- RLS POLICIES FOR CLUB_MEMBERS TABLE
-- ========================================
--
-- CRITICAL FIX: These policies do NOT query club_members recursively.
-- Instead, they check the clubs table to determine authorization.
-- This prevents infinite recursion issues.

-- Anyone can view club members (public read)
CREATE POLICY "Club members are publicly viewable"
  ON public.club_members
  FOR SELECT
  USING (true);

-- Users can join a club themselves (as member)
CREATE POLICY "Users can join clubs"
  ON public.club_members
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
    AND role = 'member'
  );

-- Club creators can add members
-- FIXED: Queries clubs table instead of club_members to avoid recursion
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

-- Club creators can update member roles
-- FIXED: Queries clubs table instead of club_members to avoid recursion
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

-- Club creators can remove members
-- FIXED: Queries clubs table instead of club_members to avoid recursion
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

-- Users can remove themselves from clubs
CREATE POLICY "Users can remove themselves from clubs"
  ON public.club_members
  FOR DELETE
  USING (auth.uid() = user_id);

-- ========================================
-- RLS POLICIES FOR EVENT_REGISTRATIONS TABLE
-- ========================================

-- Anyone can view event registrations (public read)
CREATE POLICY "Event registrations are publicly viewable"
  ON public.event_registrations
  FOR SELECT
  USING (true);

-- Authenticated users can register for events
CREATE POLICY "Authenticated users can register for events"
  ON public.event_registrations
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
  );

-- Users can unregister from events
CREATE POLICY "Users can unregister from events"
  ON public.event_registrations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Event creators can delete registrations (for removing users from events)
CREATE POLICY "Event creators can remove registrations"
  ON public.event_registrations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_registrations.event_id
      AND created_by = auth.uid()
    )
  );

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
--
-- Your database schema is now ready to use. All tables are created,
-- indexed, and protected with RLS policies.
--
-- KEY NOTES:
-- - All SELECT queries allow public read access
-- - User authentication is required for CREATE/UPDATE/DELETE operations
-- - Club and event creators have special permissions to manage their resources
-- - The RLS policies prevent infinite recursion by using the parent tables
--   (clubs, events) for authorization checks instead of child tables
-- - All foreign keys cascade on delete for data consistency
--
-- ============================================================================
