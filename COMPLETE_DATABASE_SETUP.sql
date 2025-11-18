-- =====================================================================
-- COMPLETE DATABASE SETUP SCRIPT FOR ASU CONNECT
-- =====================================================================
-- This is the "nuclear option" - a comprehensive script that sets up
-- the entire database schema from scratch in the correct order.
--
-- WHAT THIS SCRIPT DOES:
-- 1. Checks prerequisites (auth.users exists)
-- 2. Creates all tables in dependency order
-- 3. Creates all indexes for performance
-- 4. Creates all helper functions
-- 5. Creates all triggers (except auth.users trigger - see section 5.1)
-- 6. Enables RLS on all tables
-- 7. Creates all RLS policies
-- 8. Grants appropriate permissions
-- 9. Backfills profiles for existing users
-- 10. Provides verification queries
--
-- FEATURES:
-- - Idempotent (safe to run multiple times)
-- - Uses IF NOT EXISTS everywhere
-- - Comprehensive comments
-- - Proper dependency ordering
-- - Fixed constraint naming
-- - Consolidated from migrations 001-005
--
-- USAGE:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this ENTIRE file
-- 3. Click "Run"
-- 4. Check the verification queries at the end
--
-- Created: 2025-11-17
-- Based on migrations: 001_initial_schema, 002_fix_rls_infinite_recursion,
--                      003_add_event_categories_pricing,
--                      004_admin_moderation_system, 005_add_event_flags_table
-- =====================================================================

BEGIN;

-- =====================================================================
-- SECTION 1: PREREQUISITE CHECKS
-- =====================================================================

-- Verify that auth.users exists (created by Supabase)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth'
    AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION 'auth.users table does not exist. This script requires Supabase authentication to be set up.';
  END IF;
END $$;

-- Check if tables already exist and warn (but don't stop)
DO $$
DECLARE
  existing_tables TEXT[];
BEGIN
  SELECT ARRAY_AGG(table_name)
  INTO existing_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'clubs', 'events', 'club_members', 'event_registrations',
                     'club_flags', 'event_flags', 'moderation_logs');

  IF existing_tables IS NOT NULL THEN
    RAISE NOTICE 'The following tables already exist and will be preserved: %', existing_tables;
    RAISE NOTICE 'This script uses IF NOT EXISTS to avoid conflicts.';
  END IF;
END $$;

-- =====================================================================
-- SECTION 2: CREATE TABLES IN DEPENDENCY ORDER
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2.1: PROFILES TABLE
-- ---------------------------------------------------------------------
-- Stores user profile information beyond what's in auth.users
-- Must be created FIRST as other tables may reference user profiles

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE profiles IS 'Extended user profile information including admin status';
COMMENT ON COLUMN profiles.id IS 'References auth.users(id) - primary key';
COMMENT ON COLUMN profiles.email IS 'User email address (cached from auth.users)';
COMMENT ON COLUMN profiles.full_name IS 'User full name for display';
COMMENT ON COLUMN profiles.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN profiles.is_admin IS 'Indicates if user has admin privileges for moderation';
COMMENT ON COLUMN profiles.created_at IS 'Timestamp when profile was created';
COMMENT ON COLUMN profiles.updated_at IS 'Timestamp when profile was last updated';

-- ---------------------------------------------------------------------
-- 2.2: CLUBS TABLE
-- ---------------------------------------------------------------------
-- Stores club information with approval workflow

CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approval_status TEXT DEFAULT 'pending' NOT NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraint for approval_status values
  CONSTRAINT clubs_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected'))
);

COMMENT ON TABLE clubs IS 'Student clubs and organizations with approval workflow';
COMMENT ON COLUMN clubs.name IS 'Name of the club';
COMMENT ON COLUMN clubs.description IS 'Detailed description of the club';
COMMENT ON COLUMN clubs.created_by IS 'User who created the club';
COMMENT ON COLUMN clubs.approval_status IS 'Approval workflow status: pending (awaiting review), approved (published), rejected (denied)';
COMMENT ON COLUMN clubs.approved_by IS 'Admin who approved or rejected the club';
COMMENT ON COLUMN clubs.approved_at IS 'Timestamp when approval decision was made';
COMMENT ON COLUMN clubs.rejection_reason IS 'Reason provided if club was rejected';

-- ---------------------------------------------------------------------
-- 2.3: EVENTS TABLE
-- ---------------------------------------------------------------------
-- Stores events created by clubs with categories and pricing

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  category TEXT,
  is_free BOOLEAN DEFAULT TRUE NOT NULL,
  price DECIMAL(10, 2),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints for category and pricing
  CONSTRAINT events_category_check
    CHECK (category IN ('Academic', 'Social', 'Sports', 'Arts', 'Career', 'Community Service', 'Other')),
  CONSTRAINT events_price_check
    CHECK (price >= 0),
  CONSTRAINT events_price_required_when_not_free
    CHECK (is_free = TRUE OR (is_free = FALSE AND price IS NOT NULL AND price > 0))
);

COMMENT ON TABLE events IS 'Events organized by clubs with category and pricing information';
COMMENT ON COLUMN events.title IS 'Title of the event';
COMMENT ON COLUMN events.description IS 'Detailed description of the event';
COMMENT ON COLUMN events.event_date IS 'When the event takes place';
COMMENT ON COLUMN events.location IS 'Where the event takes place';
COMMENT ON COLUMN events.category IS 'Event category: Academic, Social, Sports, Arts, Career, Community Service, Other';
COMMENT ON COLUMN events.is_free IS 'Whether the event is free to attend';
COMMENT ON COLUMN events.price IS 'Price for paid events (must be > 0 when is_free = false)';
COMMENT ON COLUMN events.club_id IS 'Club organizing this event';
COMMENT ON COLUMN events.created_by IS 'User who created the event';

-- ---------------------------------------------------------------------
-- 2.4: CLUB_MEMBERS TABLE
-- ---------------------------------------------------------------------
-- Stores club membership with approval workflow

CREATE TABLE IF NOT EXISTS public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'approved',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  UNIQUE(club_id, user_id),

  -- Constraint for membership status
  CONSTRAINT club_members_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

COMMENT ON TABLE club_members IS 'Club membership records with approval workflow';
COMMENT ON COLUMN club_members.club_id IS 'Club the user is a member of';
COMMENT ON COLUMN club_members.user_id IS 'User who is a member';
COMMENT ON COLUMN club_members.role IS 'Member role: admin (can manage club) or member (regular member)';
COMMENT ON COLUMN club_members.status IS 'Membership status: pending (awaiting approval), approved (active member), rejected (denied)';
COMMENT ON COLUMN club_members.joined_at IS 'Timestamp when membership was created';
COMMENT ON CONSTRAINT club_members_status_check ON club_members IS 'Ensures status is one of the valid values';

-- ---------------------------------------------------------------------
-- 2.5: EVENT_REGISTRATIONS TABLE
-- ---------------------------------------------------------------------
-- Stores user registrations for events

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  UNIQUE(event_id, user_id)
);

COMMENT ON TABLE event_registrations IS 'User registrations for events';
COMMENT ON COLUMN event_registrations.event_id IS 'Event the user registered for';
COMMENT ON COLUMN event_registrations.user_id IS 'User who registered';
COMMENT ON COLUMN event_registrations.registered_at IS 'Timestamp when user registered';

-- ---------------------------------------------------------------------
-- 2.6: CLUB_FLAGS TABLE
-- ---------------------------------------------------------------------
-- Stores user reports/flags for inappropriate clubs

CREATE TABLE IF NOT EXISTS public.club_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT club_flags_status_check
    CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  CONSTRAINT club_flags_unique_user_club
    UNIQUE (club_id, user_id)
);

COMMENT ON TABLE club_flags IS 'User reports/flags for clubs that may violate community guidelines';
COMMENT ON COLUMN club_flags.club_id IS 'Reference to the flagged club (cascades on delete)';
COMMENT ON COLUMN club_flags.user_id IS 'User who created the flag (cascades on delete)';
COMMENT ON COLUMN club_flags.reason IS 'Primary reason for flagging (e.g., inappropriate content, spam)';
COMMENT ON COLUMN club_flags.details IS 'Additional context or details provided by the reporter';
COMMENT ON COLUMN club_flags.status IS 'Current status: pending (new), reviewed (seen by admin), resolved (action taken), dismissed (no action needed)';
COMMENT ON COLUMN club_flags.reviewed_by IS 'Admin who reviewed this flag';
COMMENT ON COLUMN club_flags.reviewed_at IS 'Timestamp when flag was reviewed';
COMMENT ON CONSTRAINT club_flags_unique_user_club ON club_flags IS 'Prevents duplicate flags from same user for same club';

-- ---------------------------------------------------------------------
-- 2.7: EVENT_FLAGS TABLE
-- ---------------------------------------------------------------------
-- Stores user reports/flags for inappropriate events

CREATE TABLE IF NOT EXISTS public.event_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints with CORRECT naming
  CONSTRAINT event_flags_status_check
    CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  CONSTRAINT event_flags_unique_user_event
    UNIQUE (event_id, user_id)
);

-- Fix constraint naming if table already existed with auto-generated name
DO $$
DECLARE
  existing_constraint_name TEXT;
BEGIN
  -- Check if there's a unique constraint on (event_id, user_id) with a different name
  SELECT conname INTO existing_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'event_flags'::regclass
  AND contype = 'u'
  AND conname != 'event_flags_unique_user_event'
  AND array_length(conkey, 1) = 2
  AND EXISTS (
    SELECT 1 FROM unnest(conkey) WITH ORDINALITY AS t(attnum, ord)
    JOIN pg_attribute a ON a.attnum = t.attnum AND a.attrelid = 'event_flags'::regclass
    WHERE a.attname IN ('event_id', 'user_id')
    GROUP BY a.attrelid
    HAVING COUNT(*) = 2
  );

  -- If found, rename it to the correct name
  IF existing_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE event_flags RENAME CONSTRAINT %I TO event_flags_unique_user_event', existing_constraint_name);
    RAISE NOTICE 'Renamed constraint % to event_flags_unique_user_event', existing_constraint_name;
  END IF;
END $$;

COMMENT ON TABLE event_flags IS 'User reports/flags for events that may violate community guidelines or contain inappropriate content';
COMMENT ON COLUMN event_flags.event_id IS 'Reference to the flagged event (cascades on delete)';
COMMENT ON COLUMN event_flags.user_id IS 'User who created the flag (cascades on delete)';
COMMENT ON COLUMN event_flags.reason IS 'Primary reason for flagging (e.g., inappropriate content, spam, misleading information)';
COMMENT ON COLUMN event_flags.details IS 'Additional context or details provided by the reporter';
COMMENT ON COLUMN event_flags.status IS 'Current status: pending (awaiting review), reviewed (seen by admin), resolved (action taken), dismissed (no action needed)';
COMMENT ON COLUMN event_flags.reviewed_by IS 'Admin user who reviewed this flag';
COMMENT ON COLUMN event_flags.reviewed_at IS 'Timestamp when the flag was reviewed by an admin';

-- Add comments on constraints only if they exist
DO $$
BEGIN
  -- Comment on status check constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_flags_status_check'
    AND conrelid = 'event_flags'::regclass
  ) THEN
    COMMENT ON CONSTRAINT event_flags_status_check ON event_flags IS 'Ensures status is one of the valid values';
  END IF;

  -- Comment on unique constraint (may have different name if table already existed)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_flags_unique_user_event'
    AND conrelid = 'event_flags'::regclass
  ) THEN
    COMMENT ON CONSTRAINT event_flags_unique_user_event ON event_flags IS 'Prevents duplicate flags from the same user for the same event';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2.8: MODERATION_LOGS TABLE
-- ---------------------------------------------------------------------
-- Stores audit trail for all moderation actions

CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE moderation_logs IS 'Audit trail for all moderation actions performed by admins';
COMMENT ON COLUMN moderation_logs.admin_id IS 'Admin who performed the action';
COMMENT ON COLUMN moderation_logs.action IS 'Type of action: flag_resolved, flag_dismissed, club_approved, club_rejected, event_approved, etc.';
COMMENT ON COLUMN moderation_logs.entity_type IS 'Type of entity affected: event, club, user, flag';
COMMENT ON COLUMN moderation_logs.entity_id IS 'UUID of the affected entity';
COMMENT ON COLUMN moderation_logs.details IS 'Additional context stored as JSON (reason, notes, previous state, etc.)';

-- =====================================================================
-- SECTION 3: CREATE INDEXES FOR PERFORMANCE
-- =====================================================================

-- Indexes for profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = TRUE;

COMMENT ON INDEX idx_profiles_email IS 'Optimizes profile lookups by email';
COMMENT ON INDEX idx_profiles_is_admin IS 'Optimizes queries filtering for admin users';

-- Indexes for clubs table
CREATE INDEX IF NOT EXISTS idx_clubs_created_by ON public.clubs(created_by);
CREATE INDEX IF NOT EXISTS idx_clubs_approval_status ON public.clubs(approval_status);

COMMENT ON INDEX idx_clubs_created_by IS 'Optimizes queries for clubs created by a user';
COMMENT ON INDEX idx_clubs_approval_status IS 'Optimizes queries filtering clubs by approval status';

-- Indexes for events table
CREATE INDEX IF NOT EXISTS idx_events_club_id ON public.events(club_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);
CREATE INDEX IF NOT EXISTS idx_events_is_free ON public.events(is_free);

COMMENT ON INDEX idx_events_club_id IS 'Optimizes queries for events by club';
COMMENT ON INDEX idx_events_created_by IS 'Optimizes queries for events by creator';
COMMENT ON INDEX idx_events_event_date IS 'Optimizes queries ordering/filtering by event date';
COMMENT ON INDEX idx_events_category IS 'Optimizes category filtering';
COMMENT ON INDEX idx_events_is_free IS 'Optimizes pricing filtering';

-- Indexes for club_members table
CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON public.club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON public.club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_status ON public.club_members(status);

COMMENT ON INDEX idx_club_members_club_id IS 'Optimizes queries for members of a club';
COMMENT ON INDEX idx_club_members_user_id IS 'Optimizes queries for clubs a user belongs to';
COMMENT ON INDEX idx_club_members_status IS 'Optimizes filtering by membership status';

-- Indexes for event_registrations table
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user_id ON public.event_registrations(user_id);

COMMENT ON INDEX idx_event_registrations_event_id IS 'Optimizes queries for registrations of an event';
COMMENT ON INDEX idx_event_registrations_user_id IS 'Optimizes queries for events a user registered for';

-- Indexes for club_flags table
CREATE INDEX IF NOT EXISTS idx_club_flags_club_id ON public.club_flags(club_id);
CREATE INDEX IF NOT EXISTS idx_club_flags_user_id ON public.club_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_club_flags_status ON public.club_flags(status);
CREATE INDEX IF NOT EXISTS idx_club_flags_created_at ON public.club_flags(created_at DESC);

COMMENT ON INDEX idx_club_flags_club_id IS 'Optimizes queries for flags on a club';
COMMENT ON INDEX idx_club_flags_user_id IS 'Optimizes queries for flags by a user';
COMMENT ON INDEX idx_club_flags_status IS 'Optimizes filtering by flag status';
COMMENT ON INDEX idx_club_flags_created_at IS 'Optimizes ordering by creation date';

-- Indexes for event_flags table
CREATE INDEX IF NOT EXISTS idx_event_flags_event_id ON public.event_flags(event_id);
CREATE INDEX IF NOT EXISTS idx_event_flags_user_id ON public.event_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_event_flags_status ON public.event_flags(status);
CREATE INDEX IF NOT EXISTS idx_event_flags_created_at ON public.event_flags(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_flags_status_created ON public.event_flags(status, created_at DESC) WHERE status = 'pending';

COMMENT ON INDEX idx_event_flags_event_id IS 'Optimizes queries filtering by event_id (e.g., viewing all flags for an event)';
COMMENT ON INDEX idx_event_flags_user_id IS 'Optimizes queries filtering by user_id (e.g., viewing flags created by a user)';
COMMENT ON INDEX idx_event_flags_status IS 'Optimizes queries filtering by status (e.g., admin viewing pending flags)';
COMMENT ON INDEX idx_event_flags_created_at IS 'Optimizes queries ordering by creation date (DESC for most recent first)';
COMMENT ON INDEX idx_event_flags_status_created IS 'Optimizes admin dashboard query for pending flags ordered by date';

-- Indexes for moderation_logs table
CREATE INDEX IF NOT EXISTS idx_moderation_logs_admin_id ON public.moderation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_action ON public.moderation_logs(action);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_entity_type ON public.moderation_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_entity_id ON public.moderation_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON public.moderation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_entity_lookup ON public.moderation_logs(entity_type, entity_id, created_at DESC);

COMMENT ON INDEX idx_moderation_logs_admin_id IS 'Optimizes queries for logs by admin';
COMMENT ON INDEX idx_moderation_logs_action IS 'Optimizes queries filtering by action type';
COMMENT ON INDEX idx_moderation_logs_entity_type IS 'Optimizes queries filtering by entity type';
COMMENT ON INDEX idx_moderation_logs_entity_id IS 'Optimizes queries for logs of a specific entity';
COMMENT ON INDEX idx_moderation_logs_created_at IS 'Optimizes ordering by creation date';
COMMENT ON INDEX idx_moderation_logs_entity_lookup IS 'Composite index for common entity lookup pattern';

-- =====================================================================
-- SECTION 4: CREATE HELPER FUNCTIONS
-- =====================================================================

-- ---------------------------------------------------------------------
-- 4.1: is_admin() - Check if a user is an admin
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  admin_status BOOLEAN;
BEGIN
  SELECT is_admin INTO admin_status
  FROM profiles
  WHERE id = user_uuid;

  RETURN COALESCE(admin_status, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_admin(UUID) IS 'Returns TRUE if the given user has admin privileges, FALSE otherwise';

-- ---------------------------------------------------------------------
-- 4.2: log_moderation_action() - Log moderation actions
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_moderation_action(
  p_admin_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO moderation_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, p_action, p_entity_type, p_entity_id, p_details)
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_moderation_action IS 'Creates a moderation log entry and returns the log ID';

-- ---------------------------------------------------------------------
-- 4.3: handle_new_user() - Auto-create profile on user signup
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, ignore
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION handle_new_user() IS 'Automatically creates a profile when a new user signs up';

-- =====================================================================
-- SECTION 5: CREATE TRIGGERS
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5.1: Auto-create profile on user signup
-- ---------------------------------------------------------------------
-- NOTE: This trigger cannot be created via SQL script because regular users
-- don't have permission to create triggers on auth.users (owned by Supabase).
--
-- OPTION 1 (Recommended): Handle profile creation in your application
-- When a user signs up, immediately call:
--   INSERT INTO public.profiles (id, email, full_name)
--   VALUES (user.id, user.email, user.user_metadata.full_name)
--   ON CONFLICT (id) DO NOTHING;
--
-- OPTION 2: Create via Supabase Dashboard > Database > Functions
-- If you have admin access, you can manually create this trigger:
--   CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW
--     EXECUTE FUNCTION public.handle_new_user();
--
-- OPTION 3: Use Supabase Auth Hooks (if available on your plan)
-- Configure a webhook to call your API when users sign up.
--
-- The handle_new_user() function (section 4.3) is still created and
-- available for use if you do set up the trigger via the dashboard.

-- ---------------------------------------------------------------------
-- 5.2: Auto-update updated_at for club_flags
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_club_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_club_flags_updated_at() IS 'Automatically updates the updated_at timestamp when a club flag record is modified';

DROP TRIGGER IF EXISTS club_flags_updated_at_trigger ON public.club_flags;
CREATE TRIGGER club_flags_updated_at_trigger
  BEFORE UPDATE ON public.club_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_club_flags_updated_at();

COMMENT ON TRIGGER club_flags_updated_at_trigger ON club_flags IS 'Ensures updated_at is automatically set on every update';

-- ---------------------------------------------------------------------
-- 5.3: Auto-update updated_at for event_flags
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_event_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_event_flags_updated_at() IS 'Automatically updates the updated_at timestamp when an event flag record is modified';

DROP TRIGGER IF EXISTS event_flags_updated_at_trigger ON public.event_flags;
CREATE TRIGGER event_flags_updated_at_trigger
  BEFORE UPDATE ON public.event_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_flags_updated_at();

COMMENT ON TRIGGER event_flags_updated_at_trigger ON event_flags IS 'Ensures updated_at is automatically set on every update';

-- ---------------------------------------------------------------------
-- 5.4: Log club approval/rejection
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_club_approval_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if approval_status changed
  IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
    IF NEW.approval_status = 'approved' THEN
      PERFORM log_moderation_action(
        NEW.approved_by,
        'club_approved',
        'club',
        NEW.id,
        jsonb_build_object(
          'club_name', NEW.name,
          'previous_status', OLD.approval_status
        )
      );
    ELSIF NEW.approval_status = 'rejected' THEN
      PERFORM log_moderation_action(
        NEW.approved_by,
        'club_rejected',
        'club',
        NEW.id,
        jsonb_build_object(
          'club_name', NEW.name,
          'previous_status', OLD.approval_status,
          'rejection_reason', NEW.rejection_reason
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_club_approval_change() IS 'Automatically logs club approval/rejection to moderation_logs';

DROP TRIGGER IF EXISTS club_approval_logging_trigger ON public.clubs;
CREATE TRIGGER club_approval_logging_trigger
  AFTER UPDATE ON public.clubs
  FOR EACH ROW
  WHEN (OLD.approval_status IS DISTINCT FROM NEW.approval_status)
  EXECUTE FUNCTION public.log_club_approval_change();

COMMENT ON TRIGGER club_approval_logging_trigger ON clubs IS 'Automatically logs club approval/rejection to moderation_logs';

-- ---------------------------------------------------------------------
-- 5.5: Log club flag resolution
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_club_flag_resolution()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status changed from pending to resolved/dismissed
  IF OLD.status = 'pending' AND NEW.status IN ('resolved', 'dismissed') THEN
    PERFORM log_moderation_action(
      NEW.reviewed_by,
      CASE
        WHEN NEW.status = 'resolved' THEN 'flag_resolved'
        WHEN NEW.status = 'dismissed' THEN 'flag_dismissed'
      END,
      'club_flag',
      NEW.id,
      jsonb_build_object(
        'club_id', NEW.club_id,
        'flag_reason', NEW.reason,
        'reporter_id', NEW.user_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_club_flag_resolution() IS 'Automatically logs club flag resolution/dismissal to moderation_logs';

DROP TRIGGER IF EXISTS club_flag_resolution_logging_trigger ON public.club_flags;
CREATE TRIGGER club_flag_resolution_logging_trigger
  AFTER UPDATE ON public.club_flags
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status IN ('resolved', 'dismissed'))
  EXECUTE FUNCTION public.log_club_flag_resolution();

COMMENT ON TRIGGER club_flag_resolution_logging_trigger ON club_flags IS 'Automatically logs club flag resolution/dismissal to moderation_logs';

-- ---------------------------------------------------------------------
-- 5.6: Log event flag resolution
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_event_flag_resolution()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log when status changes from pending to resolved/dismissed
  IF OLD.status = 'pending' AND NEW.status IN ('resolved', 'dismissed') THEN
    PERFORM log_moderation_action(
      NEW.reviewed_by,
      CASE
        WHEN NEW.status = 'resolved' THEN 'event_flag_resolved'
        WHEN NEW.status = 'dismissed' THEN 'event_flag_dismissed'
      END,
      'event_flag',
      NEW.id,
      jsonb_build_object(
        'event_id', NEW.event_id,
        'flag_reason', NEW.reason,
        'reporter_id', NEW.user_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_event_flag_resolution() IS 'Automatically creates moderation log entry when event flags are resolved or dismissed';

DROP TRIGGER IF EXISTS event_flag_resolution_logging_trigger ON public.event_flags;
CREATE TRIGGER event_flag_resolution_logging_trigger
  AFTER UPDATE ON public.event_flags
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status IN ('resolved', 'dismissed'))
  EXECUTE FUNCTION public.log_event_flag_resolution();

COMMENT ON TRIGGER event_flag_resolution_logging_trigger ON event_flags IS 'Automatically logs event flag resolution/dismissal to moderation_logs table';

-- =====================================================================
-- SECTION 6: ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- SECTION 7: CREATE RLS POLICIES
-- =====================================================================

-- ---------------------------------------------------------------------
-- 7.1: PROFILES TABLE POLICIES
-- ---------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;

-- Policy: Everyone can view all profiles (for displaying user info)
CREATE POLICY profiles_select_public
ON public.profiles
FOR SELECT
USING (true);

COMMENT ON POLICY profiles_select_public ON profiles IS 'Everyone can view all profiles for displaying user info in clubs/events';

-- Policy: Users can insert their own profile
CREATE POLICY profiles_insert_own
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

COMMENT ON POLICY profiles_insert_own ON profiles IS 'Users can create their own profile';

-- Policy: Users can update their own profile (but not is_admin field)
CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  -- Prevent users from self-promoting to admin
  AND is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
);

COMMENT ON POLICY profiles_update_own ON profiles IS 'Users can update their own profile but cannot change admin status';

-- Policy: Admins can update any profile
CREATE POLICY profiles_update_admin
ON public.profiles
FOR UPDATE
USING (is_admin(auth.uid()));

COMMENT ON POLICY profiles_update_admin ON profiles IS 'Admins can update any profile including admin status';

-- ---------------------------------------------------------------------
-- 7.2: CLUBS TABLE POLICIES
-- ---------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Clubs are publicly viewable" ON public.clubs;
DROP POLICY IF EXISTS clubs_select_approved ON public.clubs;
DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;
DROP POLICY IF EXISTS clubs_insert ON public.clubs;
DROP POLICY IF EXISTS "Club creators can update their clubs" ON public.clubs;
DROP POLICY IF EXISTS clubs_update_own ON public.clubs;
DROP POLICY IF EXISTS clubs_update_admin ON public.clubs;
DROP POLICY IF EXISTS "Club creators can delete their clubs" ON public.clubs;
DROP POLICY IF EXISTS clubs_delete_own ON public.clubs;

-- Policy: Public can view approved clubs, creators see their own, admins see all
CREATE POLICY clubs_select_approved
ON public.clubs
FOR SELECT
USING (
  approval_status = 'approved'
  OR created_by = auth.uid()
  OR is_admin(auth.uid())
);

COMMENT ON POLICY clubs_select_approved ON clubs IS 'Users can view approved clubs, their own clubs (any status), admins can view all';

-- Policy: Authenticated users can create clubs (will be pending by default)
CREATE POLICY clubs_insert
ON public.clubs
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND approval_status = 'pending'
);

COMMENT ON POLICY clubs_insert ON clubs IS 'Authenticated users can create clubs which start as pending';

-- Policy: Creators can update their own clubs (except approval fields)
CREATE POLICY clubs_update_own
ON public.clubs
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

COMMENT ON POLICY clubs_update_own ON clubs IS 'Club creators can update their clubs but not approval fields';

-- Policy: Admins can update any club including approval status
CREATE POLICY clubs_update_admin
ON public.clubs
FOR UPDATE
USING (is_admin(auth.uid()));

COMMENT ON POLICY clubs_update_admin ON clubs IS 'Admins can update any club including approval workflow fields';

-- Policy: Creators can delete their own clubs
CREATE POLICY clubs_delete_own
ON public.clubs
FOR DELETE
USING (auth.uid() = created_by);

COMMENT ON POLICY clubs_delete_own ON clubs IS 'Club creators can delete their own clubs';

-- ---------------------------------------------------------------------
-- 7.3: EVENTS TABLE POLICIES
-- ---------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Events are publicly viewable" ON public.events;
DROP POLICY IF EXISTS events_select_public ON public.events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
DROP POLICY IF EXISTS events_insert ON public.events;
DROP POLICY IF EXISTS "Event creators can update their events" ON public.events;
DROP POLICY IF EXISTS events_update_own ON public.events;
DROP POLICY IF EXISTS "Event creators can delete their events" ON public.events;
DROP POLICY IF EXISTS events_delete_own ON public.events;

-- Policy: Anyone can view events
CREATE POLICY events_select_public
ON public.events
FOR SELECT
USING (true);

COMMENT ON POLICY events_select_public ON events IS 'Anyone can view all events';

-- Policy: Only club creators can create events for their clubs
CREATE POLICY events_insert
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

COMMENT ON POLICY events_insert ON events IS 'Only club creators can create events for their clubs';

-- Policy: Event creators can update their events
CREATE POLICY events_update_own
ON public.events
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

COMMENT ON POLICY events_update_own ON events IS 'Event creators can update their own events';

-- Policy: Event creators can delete their events
CREATE POLICY events_delete_own
ON public.events
FOR DELETE
USING (auth.uid() = created_by);

COMMENT ON POLICY events_delete_own ON events IS 'Event creators can delete their own events';

-- ---------------------------------------------------------------------
-- 7.4: CLUB_MEMBERS TABLE POLICIES
-- ---------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Club members are publicly viewable" ON public.club_members;
DROP POLICY IF EXISTS "Club members visibility with approval" ON public.club_members;
DROP POLICY IF EXISTS club_members_select_approved ON public.club_members;
DROP POLICY IF EXISTS "Club admins can add members" ON public.club_members;
DROP POLICY IF EXISTS "Club creators can add members" ON public.club_members;
DROP POLICY IF EXISTS club_members_insert_creator ON public.club_members;
DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
DROP POLICY IF EXISTS club_members_insert_self ON public.club_members;
DROP POLICY IF EXISTS "Club admins can update member roles" ON public.club_members;
DROP POLICY IF EXISTS "Club creators can update member roles" ON public.club_members;
DROP POLICY IF EXISTS club_members_update_creator ON public.club_members;
DROP POLICY IF EXISTS "Club admins can remove members" ON public.club_members;
DROP POLICY IF EXISTS "Club creators can remove members" ON public.club_members;
DROP POLICY IF EXISTS club_members_delete_creator ON public.club_members;
DROP POLICY IF EXISTS "Users can remove themselves from clubs" ON public.club_members;
DROP POLICY IF EXISTS club_members_delete_self ON public.club_members;

-- Policy: Show approved members publicly, users see own requests, club creators see all
CREATE POLICY club_members_select_approved
ON public.club_members
FOR SELECT
USING (
  status = 'approved'
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = club_members.club_id
    AND created_by = auth.uid()
  )
);

COMMENT ON POLICY club_members_select_approved ON club_members IS 'Show approved members publicly, users see their own requests, club creators see all';

-- Policy: Club creators can add members
CREATE POLICY club_members_insert_creator
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

COMMENT ON POLICY club_members_insert_creator ON club_members IS 'Club creators can add members to their clubs';

-- Policy: Users can join clubs (as pending member)
CREATE POLICY club_members_insert_self
ON public.club_members
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND user_id = auth.uid()
  AND role = 'member'
);

COMMENT ON POLICY club_members_insert_self ON club_members IS 'Users can join clubs as regular members (pending approval)';

-- Policy: Club creators can update member roles and status
CREATE POLICY club_members_update_creator
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

COMMENT ON POLICY club_members_update_creator ON club_members IS 'Club creators can update member roles and approve/reject membership requests';

-- Policy: Club creators can remove members
CREATE POLICY club_members_delete_creator
ON public.club_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = club_members.club_id
    AND created_by = auth.uid()
  )
);

COMMENT ON POLICY club_members_delete_creator ON club_members IS 'Club creators can remove members from their clubs';

-- Policy: Users can remove themselves from clubs
CREATE POLICY club_members_delete_self
ON public.club_members
FOR DELETE
USING (auth.uid() = user_id);

COMMENT ON POLICY club_members_delete_self ON club_members IS 'Users can remove themselves from clubs';

-- ---------------------------------------------------------------------
-- 7.5: EVENT_REGISTRATIONS TABLE POLICIES
-- ---------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Event registrations are publicly viewable" ON public.event_registrations;
DROP POLICY IF EXISTS event_registrations_select_public ON public.event_registrations;
DROP POLICY IF EXISTS "Authenticated users can register for events" ON public.event_registrations;
DROP POLICY IF EXISTS event_registrations_insert ON public.event_registrations;
DROP POLICY IF EXISTS "Users can unregister from events" ON public.event_registrations;
DROP POLICY IF EXISTS event_registrations_delete_self ON public.event_registrations;
DROP POLICY IF EXISTS "Event creators can remove registrations" ON public.event_registrations;
DROP POLICY IF EXISTS event_registrations_delete_creator ON public.event_registrations;

-- Policy: Anyone can view registrations
CREATE POLICY event_registrations_select_public
ON public.event_registrations
FOR SELECT
USING (true);

COMMENT ON POLICY event_registrations_select_public ON event_registrations IS 'Anyone can view event registrations';

-- Policy: Authenticated users can register for events
CREATE POLICY event_registrations_insert
ON public.event_registrations
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND user_id = auth.uid()
);

COMMENT ON POLICY event_registrations_insert ON event_registrations IS 'Authenticated users can register for events';

-- Policy: Users can unregister from events
CREATE POLICY event_registrations_delete_self
ON public.event_registrations
FOR DELETE
USING (auth.uid() = user_id);

COMMENT ON POLICY event_registrations_delete_self ON event_registrations IS 'Users can unregister from events';

-- Policy: Event creators can remove registrations
CREATE POLICY event_registrations_delete_creator
ON public.event_registrations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE id = event_registrations.event_id
    AND created_by = auth.uid()
  )
);

COMMENT ON POLICY event_registrations_delete_creator ON event_registrations IS 'Event creators can remove user registrations';

-- ---------------------------------------------------------------------
-- 7.6: CLUB_FLAGS TABLE POLICIES
-- ---------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS club_flags_select_own ON public.club_flags;
DROP POLICY IF EXISTS club_flags_select_creator ON public.club_flags;
DROP POLICY IF EXISTS club_flags_select_admin ON public.club_flags;
DROP POLICY IF EXISTS club_flags_insert ON public.club_flags;
DROP POLICY IF EXISTS club_flags_update_admin ON public.club_flags;
DROP POLICY IF EXISTS club_flags_delete_own ON public.club_flags;

-- Policy: Users can view their own flags
CREATE POLICY club_flags_select_own
ON public.club_flags
FOR SELECT
USING (auth.uid() = user_id);

COMMENT ON POLICY club_flags_select_own ON club_flags IS 'Users can view flags they created';

-- Policy: Club creators can view all flags for their clubs
CREATE POLICY club_flags_select_creator
ON public.club_flags
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clubs
    WHERE clubs.id = club_flags.club_id
    AND clubs.created_by = auth.uid()
  )
);

COMMENT ON POLICY club_flags_select_creator ON club_flags IS 'Club creators can view all flags for their clubs';

-- Policy: Admins can view all flags
CREATE POLICY club_flags_select_admin
ON public.club_flags
FOR SELECT
USING (is_admin(auth.uid()));

COMMENT ON POLICY club_flags_select_admin ON club_flags IS 'Admins can view all club flags';

-- Policy: Authenticated users can create flags
CREATE POLICY club_flags_insert
ON public.club_flags
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND auth.uid() IS NOT NULL
);

COMMENT ON POLICY club_flags_insert ON club_flags IS 'Authenticated users can flag clubs';

-- Policy: Admins can update flags (for review/resolution)
CREATE POLICY club_flags_update_admin
ON public.club_flags
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

COMMENT ON POLICY club_flags_update_admin ON club_flags IS 'Admins can update flag status and review information';

-- Policy: Users can delete their own pending flags
CREATE POLICY club_flags_delete_own
ON public.club_flags
FOR DELETE
USING (
  auth.uid() = user_id
  AND status = 'pending'
);

COMMENT ON POLICY club_flags_delete_own ON club_flags IS 'Users can delete their own pending flags';

-- ---------------------------------------------------------------------
-- 7.7: EVENT_FLAGS TABLE POLICIES
-- ---------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS event_flags_select_own ON public.event_flags;
DROP POLICY IF EXISTS event_flags_select_event_creator ON public.event_flags;
DROP POLICY IF EXISTS event_flags_select_admin ON public.event_flags;
DROP POLICY IF EXISTS event_flags_insert ON public.event_flags;
DROP POLICY IF EXISTS event_flags_update_event_creator ON public.event_flags;
DROP POLICY IF EXISTS event_flags_update_admin ON public.event_flags;
DROP POLICY IF EXISTS event_flags_delete_own_pending ON public.event_flags;

-- Policy: Users can view flags they created
CREATE POLICY event_flags_select_own
ON public.event_flags
FOR SELECT
USING (auth.uid() = user_id);

COMMENT ON POLICY event_flags_select_own ON event_flags IS 'Users can view flags they created to check status';

-- Policy: Event creators can view all flags for their events
CREATE POLICY event_flags_select_event_creator
ON public.event_flags
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_flags.event_id
    AND events.created_by = auth.uid()
  )
);

COMMENT ON POLICY event_flags_select_event_creator ON event_flags IS 'Event creators can view all flags for their events';

-- Policy: Admins can view all flags
CREATE POLICY event_flags_select_admin
ON public.event_flags
FOR SELECT
USING (is_admin(auth.uid()));

COMMENT ON POLICY event_flags_select_admin ON event_flags IS 'Admins can view all event flags for moderation';

-- Policy: Authenticated users can create flags
CREATE POLICY event_flags_insert
ON public.event_flags
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND user_id = auth.uid()
);

COMMENT ON POLICY event_flags_insert ON event_flags IS 'Authenticated users can flag events they find inappropriate';

-- Policy: Event creators can update flags for their events
CREATE POLICY event_flags_update_event_creator
ON public.event_flags
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_flags.event_id
    AND events.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_flags.event_id
    AND events.created_by = auth.uid()
  )
);

COMMENT ON POLICY event_flags_update_event_creator ON event_flags IS 'Event creators can update flag status for their events';

-- Policy: Admins can update any flag
CREATE POLICY event_flags_update_admin
ON public.event_flags
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

COMMENT ON POLICY event_flags_update_admin ON event_flags IS 'Admins can update any flag for moderation purposes';

-- Policy: Users can delete their own pending flags
CREATE POLICY event_flags_delete_own_pending
ON public.event_flags
FOR DELETE
USING (
  auth.uid() = user_id
  AND status = 'pending'
);

COMMENT ON POLICY event_flags_delete_own_pending ON event_flags IS 'Users can delete their own pending flags if submitted by mistake';

-- ---------------------------------------------------------------------
-- 7.8: MODERATION_LOGS TABLE POLICIES
-- ---------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS moderation_logs_select_admin ON public.moderation_logs;
DROP POLICY IF EXISTS moderation_logs_insert_admin ON public.moderation_logs;

-- Policy: Only admins can view moderation logs
CREATE POLICY moderation_logs_select_admin
ON public.moderation_logs
FOR SELECT
USING (is_admin(auth.uid()));

COMMENT ON POLICY moderation_logs_select_admin ON moderation_logs IS 'Only admins can view moderation logs';

-- Policy: Only admins can insert moderation logs
CREATE POLICY moderation_logs_insert_admin
ON public.moderation_logs
FOR INSERT
WITH CHECK (is_admin(auth.uid()) AND auth.uid() = admin_id);

COMMENT ON POLICY moderation_logs_insert_admin ON moderation_logs IS 'Only admins can create moderation log entries';

-- =====================================================================
-- SECTION 8: GRANTS AND PERMISSIONS
-- =====================================================================

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.event_registrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_flags TO authenticated;
GRANT SELECT, INSERT ON public.moderation_logs TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION log_moderation_action(UUID, TEXT, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION update_club_flags_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION update_event_flags_updated_at() TO authenticated;

-- =====================================================================
-- SECTION 9: BACKFILL DATA
-- =====================================================================

-- Backfill profiles for existing users
INSERT INTO public.profiles (id, email, full_name)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Update existing club members to 'approved' status (grandfather existing memberships)
UPDATE public.club_members SET status = 'approved' WHERE status IS NULL;

COMMIT;

-- =====================================================================
-- SECTION 10: VERIFICATION QUERIES
-- =====================================================================
-- Run these queries to verify the setup was successful

-- Check all tables exist
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'clubs', 'events', 'club_members', 'event_registrations',
                   'club_flags', 'event_flags', 'moderation_logs')
ORDER BY table_name;

-- Check RLS is enabled on all tables
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'clubs', 'events', 'club_members', 'event_registrations',
                  'club_flags', 'event_flags', 'moderation_logs')
ORDER BY tablename;

-- Count policies per table
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'clubs', 'events', 'club_members', 'event_registrations',
                  'club_flags', 'event_flags', 'moderation_logs')
GROUP BY tablename
ORDER BY tablename;

-- Check indexes
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'clubs', 'events', 'club_members', 'event_registrations',
                  'club_flags', 'event_flags', 'moderation_logs')
ORDER BY tablename, indexname;

-- Check functions exist
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('is_admin', 'log_moderation_action', 'handle_new_user',
                     'update_club_flags_updated_at', 'update_event_flags_updated_at',
                     'log_club_approval_change', 'log_club_flag_resolution',
                     'log_event_flag_resolution')
ORDER BY routine_name;

-- Check triggers
SELECT
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table IN ('users', 'clubs', 'club_flags', 'event_flags')
ORDER BY event_object_table, trigger_name;

-- Check critical columns exist
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND (
  (table_name = 'profiles' AND column_name = 'is_admin')
  OR (table_name = 'clubs' AND column_name IN ('approval_status', 'approved_by'))
  OR (table_name = 'events' AND column_name IN ('category', 'is_free', 'price'))
  OR (table_name = 'club_members' AND column_name = 'status')
  OR (table_name = 'event_flags' AND column_name = 'status')
  OR (table_name = 'club_flags' AND column_name = 'status')
)
ORDER BY table_name, column_name;

-- Check constraint names for event_flags (verify fix)
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'event_flags'::regclass
AND conname IN ('event_flags_status_check', 'event_flags_unique_user_event')
ORDER BY conname;

-- Count profiles vs users (should match)
SELECT
  (SELECT COUNT(*) FROM auth.users) as user_count,
  (SELECT COUNT(*) FROM public.profiles) as profile_count,
  CASE
    WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM public.profiles)
    THEN 'MATCH ✓'
    ELSE 'MISMATCH - backfill may have failed'
  END as status;

-- =====================================================================
-- SETUP COMPLETE
-- =====================================================================
--
-- Your ASU Connect database is now fully configured with:
-- ✓ All 8 tables created with proper constraints
-- ✓ All indexes for performance optimization
-- ✓ All helper functions (is_admin, log_moderation_action, etc.)
-- ✓ All triggers for automation (except auth.users - see note below)
-- ✓ RLS enabled on all tables
-- ✓ All RLS policies with proper naming
-- ✓ Proper grants and permissions
-- ✓ Profiles backfilled from auth.users
-- ✓ Existing club members grandfathered as 'approved'
--
-- IMPORTANT: Profile Creation for New Users
-- The automatic profile creation trigger on auth.users was NOT created
-- because regular users lack permissions on the auth schema.
-- See Section 5.1 for three options to handle profile creation:
--   1. Handle in your application code (recommended)
--   2. Manually create via Supabase Dashboard (if you have admin access)
--   3. Use Supabase Auth Hooks (if available on your plan)
--
-- Next steps:
-- 1. Review the verification query results above
-- 2. Implement profile creation (see Section 5.1 for options)
-- 3. Test your application endpoints
-- 4. Create your first admin user:
--    UPDATE profiles SET is_admin = true WHERE email = 'your-email@asu.edu';
-- 5. Test the moderation workflow
--
-- =====================================================================
