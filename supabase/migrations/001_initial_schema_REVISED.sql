-- ASU Connect: Complete Database Schema
-- Revised to avoid RLS infinite recursion issues

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

-- Create indexes for foreign keys and common queries
CREATE INDEX idx_clubs_created_by ON public.clubs(created_by);
CREATE INDEX idx_events_club_id ON public.events(club_id);
CREATE INDEX idx_events_created_by ON public.events(created_by);
CREATE INDEX idx_events_event_date ON public.events(event_date);
CREATE INDEX idx_club_members_club_id ON public.club_members(club_id);
CREATE INDEX idx_club_members_user_id ON public.club_members(user_id);
CREATE INDEX idx_event_registrations_event_id ON public.event_registrations(event_id);
CREATE INDEX idx_event_registrations_user_id ON public.event_registrations(user_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

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

-- Only club admins/creators can create events
-- FIXED: Check if user is the club creator (avoids recursion on club_members table)
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
-- KEY FIX: Avoid recursive queries on club_members itself
-- Instead, use the clubs table to check ownership
-- ========================================

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

-- FIXED: Club creators (not just admins) can add members
-- Query clubs table instead of club_members to avoid recursion
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

-- FIXED: Club creators can update member roles
-- Query clubs table instead of club_members to avoid recursion
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

-- FIXED: Club creators can remove members
-- Query clubs table instead of club_members to avoid recursion
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

-- Anyone can view registrations (public read)
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

-- Event creators can delete registrations (for removal of users)
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
