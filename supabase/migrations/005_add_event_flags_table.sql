-- =====================================================================
-- Migration: 005_add_event_flags_table.sql
-- Description: Event flagging system for community moderation
-- Created: 2025-11-17
-- Dependencies: 004_admin_moderation_system.sql (requires is_admin function)
-- =====================================================================

-- This migration adds:
-- 1. Event flags table for reporting inappropriate events
-- 2. Indexes for query performance optimization
-- 3. RLS policies for secure access control
-- 4. Trigger for automatic timestamp updates
-- 5. Audit logging trigger for flag resolution

BEGIN;

-- =====================================================================
-- SECTION 1: CREATE EVENT_FLAGS TABLE
-- =====================================================================

-- Create event_flags table for reporting inappropriate events
-- This allows users to flag events that may violate community guidelines
CREATE TABLE IF NOT EXISTS event_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT event_flags_status_check
        CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    CONSTRAINT event_flags_unique_user_event
        UNIQUE (event_id, user_id)
);

-- Add table and column comments for documentation
COMMENT ON TABLE event_flags IS 'Stores user reports/flags for events that may violate community guidelines or contain inappropriate content';
COMMENT ON COLUMN event_flags.id IS 'Unique identifier for the flag record';
COMMENT ON COLUMN event_flags.event_id IS 'Reference to the flagged event (cascades on delete)';
COMMENT ON COLUMN event_flags.user_id IS 'User who created the flag (cascades on delete)';
COMMENT ON COLUMN event_flags.reason IS 'Primary reason for flagging (e.g., inappropriate content, spam, misleading information)';
COMMENT ON COLUMN event_flags.details IS 'Additional context or details provided by the reporter';
COMMENT ON COLUMN event_flags.status IS 'Current status: pending (awaiting review), reviewed (seen by admin), resolved (action taken), dismissed (no action needed)';
COMMENT ON COLUMN event_flags.reviewed_by IS 'Admin user who reviewed this flag';
COMMENT ON COLUMN event_flags.reviewed_at IS 'Timestamp when the flag was reviewed by an admin';
COMMENT ON COLUMN event_flags.created_at IS 'Timestamp when the flag was created';
COMMENT ON COLUMN event_flags.updated_at IS 'Timestamp when the flag was last updated (auto-updated by trigger)';
COMMENT ON CONSTRAINT event_flags_status_check ON event_flags IS 'Ensures status is one of the valid values';
COMMENT ON CONSTRAINT event_flags_unique_user_event ON event_flags IS 'Prevents duplicate flags from the same user for the same event';

-- =====================================================================
-- SECTION 2: CREATE INDEXES FOR PERFORMANCE
-- =====================================================================

-- Index for looking up all flags for a specific event
-- Used when: viewing flags for an event, counting flags per event
CREATE INDEX IF NOT EXISTS idx_event_flags_event_id
ON event_flags(event_id);

COMMENT ON INDEX idx_event_flags_event_id IS 'Optimizes queries filtering by event_id (e.g., viewing all flags for an event)';

-- Index for looking up all flags created by a specific user
-- Used when: viewing user's flag history, checking if user already flagged
CREATE INDEX IF NOT EXISTS idx_event_flags_user_id
ON event_flags(user_id);

COMMENT ON INDEX idx_event_flags_user_id IS 'Optimizes queries filtering by user_id (e.g., viewing flags created by a user)';

-- Index for filtering flags by status (e.g., pending flags queue)
-- Used when: admin dashboard showing pending flags, statistics
CREATE INDEX IF NOT EXISTS idx_event_flags_status
ON event_flags(status);

COMMENT ON INDEX idx_event_flags_status IS 'Optimizes queries filtering by status (e.g., admin viewing pending flags)';

-- Index for ordering flags by creation date (most recent first)
-- Used when: displaying flags in chronological order
CREATE INDEX IF NOT EXISTS idx_event_flags_created_at
ON event_flags(created_at DESC);

COMMENT ON INDEX idx_event_flags_created_at IS 'Optimizes queries ordering by creation date (DESC for most recent first)';

-- Composite index for admin dashboard: pending flags ordered by date
-- This index significantly improves the most common admin query
CREATE INDEX IF NOT EXISTS idx_event_flags_status_created
ON event_flags(status, created_at DESC)
WHERE status = 'pending';

COMMENT ON INDEX idx_event_flags_status_created IS 'Optimizes admin dashboard query for pending flags ordered by date';

-- =====================================================================
-- SECTION 3: CREATE TRIGGERS
-- =====================================================================

-- Trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_event_flags_updated_at() IS 'Automatically updates the updated_at timestamp when a flag record is modified';

-- Create trigger to call the function before each update
DROP TRIGGER IF EXISTS event_flags_updated_at_trigger ON event_flags;
CREATE TRIGGER event_flags_updated_at_trigger
    BEFORE UPDATE ON event_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_event_flags_updated_at();

COMMENT ON TRIGGER event_flags_updated_at_trigger ON event_flags IS 'Ensures updated_at is automatically set on every update';

-- Trigger function to log event flag resolution to moderation_logs
-- This creates an audit trail when admins resolve or dismiss flags
CREATE OR REPLACE FUNCTION log_event_flag_resolution()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log when status changes from pending to resolved/dismissed
    IF OLD.status = 'pending' AND NEW.status IN ('resolved', 'dismissed') THEN
        -- Call the log_moderation_action function from migration 004
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

-- Create trigger for automatic logging
DROP TRIGGER IF EXISTS event_flag_resolution_logging_trigger ON event_flags;
CREATE TRIGGER event_flag_resolution_logging_trigger
    AFTER UPDATE ON event_flags
    FOR EACH ROW
    WHEN (OLD.status = 'pending' AND NEW.status IN ('resolved', 'dismissed'))
    EXECUTE FUNCTION log_event_flag_resolution();

COMMENT ON TRIGGER event_flag_resolution_logging_trigger ON event_flags IS 'Automatically logs event flag resolution/dismissal to moderation_logs table';

-- =====================================================================
-- SECTION 4: ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================================

-- Enable RLS to enforce access control at the database level
ALTER TABLE event_flags ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- SECTION 5: CREATE RLS POLICIES
-- =====================================================================

-- Policy 1: Users can view flags they created
-- This allows users to see the status of their own flag reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'event_flags'
    AND policyname = 'event_flags_select_own'
  ) THEN
    CREATE POLICY event_flags_select_own
      ON event_flags
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON POLICY event_flags_select_own ON event_flags IS 'Users can view flags they created to check status';

-- Policy 2: Event creators can view all flags for their events
-- This allows event organizers to see feedback and concerns about their events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'event_flags'
    AND policyname = 'event_flags_select_event_creator'
  ) THEN
    CREATE POLICY event_flags_select_event_creator
      ON event_flags
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM events
          WHERE events.id = event_flags.event_id
          AND events.created_by = auth.uid()
        )
      );
  END IF;
END $$;

COMMENT ON POLICY event_flags_select_event_creator ON event_flags IS 'Event creators can view all flags for their events';

-- Policy 3: Admins can view all flags
-- This is required for the moderation dashboard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'event_flags'
    AND policyname = 'event_flags_select_admin'
  ) THEN
    CREATE POLICY event_flags_select_admin
      ON event_flags
      FOR SELECT
      USING (is_admin(auth.uid()));
  END IF;
END $$;

COMMENT ON POLICY event_flags_select_admin ON event_flags IS 'Admins can view all event flags for moderation';

-- Policy 4: Authenticated users can create flags
-- Any logged-in user can report inappropriate events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'event_flags'
    AND policyname = 'event_flags_insert'
  ) THEN
    CREATE POLICY event_flags_insert
      ON event_flags
      FOR INSERT
      WITH CHECK (
        auth.role() = 'authenticated'
        AND user_id = auth.uid()
      );
  END IF;
END $$;

COMMENT ON POLICY event_flags_insert ON event_flags IS 'Authenticated users can flag events they find inappropriate';

-- Policy 5: Event creators can update flags for their events
-- This allows event creators to mark flags as reviewed or add notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'event_flags'
    AND policyname = 'event_flags_update_event_creator'
  ) THEN
    CREATE POLICY event_flags_update_event_creator
      ON event_flags
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
  END IF;
END $$;

COMMENT ON POLICY event_flags_update_event_creator ON event_flags IS 'Event creators can update flag status for their events';

-- Policy 6: Admins can update any flag
-- This allows admins to review, resolve, or dismiss flags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'event_flags'
    AND policyname = 'event_flags_update_admin'
  ) THEN
    CREATE POLICY event_flags_update_admin
      ON event_flags
      FOR UPDATE
      USING (is_admin(auth.uid()))
      WITH CHECK (is_admin(auth.uid()));
  END IF;
END $$;

COMMENT ON POLICY event_flags_update_admin ON event_flags IS 'Admins can update any flag for moderation purposes';

-- Policy 7: Users can delete their own pending flags
-- This allows users to retract flags they submitted by mistake
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'event_flags'
    AND policyname = 'event_flags_delete_own_pending'
  ) THEN
    CREATE POLICY event_flags_delete_own_pending
      ON event_flags
      FOR DELETE
      USING (
        auth.uid() = user_id
        AND status = 'pending'
      );
  END IF;
END $$;

COMMENT ON POLICY event_flags_delete_own_pending ON event_flags IS 'Users can delete their own pending flags if submitted by mistake';

-- =====================================================================
-- SECTION 6: GRANTS AND PERMISSIONS
-- =====================================================================

-- Grant appropriate permissions on the event_flags table
-- These work in conjunction with RLS policies
GRANT SELECT, INSERT ON event_flags TO authenticated;
GRANT UPDATE, DELETE ON event_flags TO authenticated;

-- Grant usage on the schema (if not already granted)
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- Grant execute on trigger functions
GRANT EXECUTE ON FUNCTION update_event_flags_updated_at() TO authenticated;

-- Note: log_event_flag_resolution uses SECURITY DEFINER and doesn't need explicit grants
-- Note: is_admin function is granted in migration 004

-- =====================================================================
-- SECTION 7: VERIFICATION QUERIES (COMMENTED OUT)
-- =====================================================================

-- Uncomment these queries to verify the migration was successful:

-- -- Check if event_flags table exists
-- SELECT table_name, table_type
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name = 'event_flags';

-- -- Check all columns and their properties
-- SELECT
--     column_name,
--     data_type,
--     is_nullable,
--     column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND table_name = 'event_flags'
-- ORDER BY ordinal_position;

-- -- Check all indexes
-- SELECT
--     indexname,
--     indexdef
-- FROM pg_indexes
-- WHERE tablename = 'event_flags'
-- ORDER BY indexname;

-- -- Check all constraints
-- SELECT
--     conname AS constraint_name,
--     contype AS constraint_type,
--     pg_get_constraintdef(oid) AS constraint_definition
-- FROM pg_constraint
-- WHERE conrelid = 'event_flags'::regclass
-- ORDER BY conname;

-- -- Check RLS is enabled
-- SELECT
--     tablename,
--     rowsecurity
-- FROM pg_tables
-- WHERE tablename = 'event_flags';

-- -- Check all RLS policies
-- SELECT
--     schemaname,
--     tablename,
--     policyname,
--     permissive,
--     roles,
--     cmd,
--     qual,
--     with_check
-- FROM pg_policies
-- WHERE tablename = 'event_flags'
-- ORDER BY policyname;

-- -- Check triggers
-- SELECT
--     trigger_name,
--     event_manipulation,
--     event_object_table,
--     action_timing,
--     action_statement
-- FROM information_schema.triggers
-- WHERE event_object_table = 'event_flags'
-- ORDER BY trigger_name;

-- =====================================================================
-- MIGRATION COMPLETE
-- =====================================================================

COMMIT;

-- Summary of changes:
-- - Created event_flags table with comprehensive structure
-- - Added 5 indexes for query performance optimization
-- - Enabled Row Level Security (RLS)
-- - Created 7 RLS policies for fine-grained access control:
--   * Users can view their own flags
--   * Event creators can view flags for their events
--   * Admins can view all flags
--   * Authenticated users can create flags
--   * Event creators can update flags for their events
--   * Admins can update any flag
--   * Users can delete their own pending flags
-- - Created trigger for automatic updated_at timestamp
-- - Created trigger for automatic moderation logging
-- - Granted appropriate permissions
-- - Added comprehensive comments for documentation

-- Next steps:
-- 1. Test flag creation via API
-- 2. Test RLS policies with different user roles
-- 3. Verify admin moderation workflow
-- 4. Monitor index performance in production
