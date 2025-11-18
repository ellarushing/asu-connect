-- =====================================================================
-- Migration: 004_admin_moderation_system.sql
-- Description: Comprehensive admin moderation system for ASU Connect
-- Created: 2025-11-17
-- =====================================================================

-- This migration adds:
-- 1. Admin role management in profiles
-- 2. Club flagging system (parallel to event flags)
-- 3. Club approval workflow
-- 4. Moderation audit logs
-- 5. RLS policies for moderation features
-- 6. Helper functions for admin checks and logging

BEGIN;

-- =====================================================================
-- SECTION 1: ADMIN PROFILES ENHANCEMENT
-- =====================================================================

-- Add is_admin column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN profiles.is_admin IS 'Indicates if user has admin privileges for moderation';

-- Create index for admin queries (improves performance when filtering by admin status)
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin
ON profiles(is_admin)
WHERE is_admin = TRUE;

COMMENT ON INDEX idx_profiles_is_admin IS 'Optimizes queries filtering for admin users';

-- =====================================================================
-- SECTION 2: CLUB FLAGS TABLE
-- =====================================================================

-- Create club_flags table for reporting inappropriate clubs
CREATE TABLE IF NOT EXISTS club_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
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

-- Add comments for documentation
COMMENT ON TABLE club_flags IS 'Stores user reports/flags for clubs that may violate community guidelines';
COMMENT ON COLUMN club_flags.reason IS 'Primary reason for flagging (e.g., inappropriate content, spam)';
COMMENT ON COLUMN club_flags.details IS 'Additional details or context provided by the reporter';
COMMENT ON COLUMN club_flags.status IS 'Current status: pending (new), reviewed (seen by admin), resolved (action taken), dismissed (no action needed)';
COMMENT ON COLUMN club_flags.reviewed_by IS 'Admin who reviewed this flag';
COMMENT ON COLUMN club_flags.reviewed_at IS 'Timestamp when flag was reviewed';
COMMENT ON CONSTRAINT club_flags_unique_user_club ON club_flags IS 'Prevents duplicate flags from same user for same club';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_club_flags_club_id ON club_flags(club_id);
CREATE INDEX IF NOT EXISTS idx_club_flags_user_id ON club_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_club_flags_status ON club_flags(status);
CREATE INDEX IF NOT EXISTS idx_club_flags_created_at ON club_flags(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_club_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER club_flags_updated_at_trigger
    BEFORE UPDATE ON club_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_club_flags_updated_at();

-- =====================================================================
-- SECTION 3: CLUB APPROVAL SYSTEM
-- =====================================================================

-- Add approval workflow columns to clubs table
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' NOT NULL,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add constraint for approval_status values
ALTER TABLE clubs
DROP CONSTRAINT IF EXISTS clubs_approval_status_check;

ALTER TABLE clubs
ADD CONSTRAINT clubs_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Add comments
COMMENT ON COLUMN clubs.approval_status IS 'Approval workflow status: pending (awaiting review), approved (published), rejected (denied)';
COMMENT ON COLUMN clubs.approved_by IS 'Admin who approved or rejected the club';
COMMENT ON COLUMN clubs.approved_at IS 'Timestamp when approval decision was made';
COMMENT ON COLUMN clubs.rejection_reason IS 'Reason provided if club was rejected';

-- Create index for filtering by approval status
CREATE INDEX IF NOT EXISTS idx_clubs_approval_status ON clubs(approval_status);

COMMENT ON INDEX idx_clubs_approval_status IS 'Optimizes queries filtering clubs by approval status';

-- =====================================================================
-- SECTION 4: MODERATION LOGS TABLE (AUDIT TRAIL)
-- =====================================================================

-- Create moderation_logs table for audit trail
CREATE TABLE IF NOT EXISTS moderation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add comments
COMMENT ON TABLE moderation_logs IS 'Audit trail for all moderation actions performed by admins';
COMMENT ON COLUMN moderation_logs.admin_id IS 'Admin who performed the action';
COMMENT ON COLUMN moderation_logs.action IS 'Type of action: flag_resolved, flag_dismissed, club_approved, club_rejected, event_approved, etc.';
COMMENT ON COLUMN moderation_logs.entity_type IS 'Type of entity affected: event, club, user, flag';
COMMENT ON COLUMN moderation_logs.entity_id IS 'UUID of the affected entity';
COMMENT ON COLUMN moderation_logs.details IS 'Additional context stored as JSON (reason, notes, previous state, etc.)';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_moderation_logs_admin_id ON moderation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_action ON moderation_logs(action);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_entity_type ON moderation_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_entity_id ON moderation_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON moderation_logs(created_at DESC);

-- Composite index for common query pattern (entity lookups)
CREATE INDEX IF NOT EXISTS idx_moderation_logs_entity_lookup
ON moderation_logs(entity_type, entity_id, created_at DESC);

-- =====================================================================
-- SECTION 5: HELPER FUNCTIONS
-- =====================================================================

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
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

-- Function to automatically log moderation actions
CREATE OR REPLACE FUNCTION log_moderation_action(
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

-- =====================================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- Enable RLS on club_flags table
ALTER TABLE club_flags ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own flags
CREATE POLICY club_flags_select_own
ON club_flags
FOR SELECT
USING (auth.uid() = user_id);

COMMENT ON POLICY club_flags_select_own ON club_flags IS 'Users can view flags they created';

-- Policy: Club creators can view all flags for their clubs
CREATE POLICY club_flags_select_creator
ON club_flags
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
ON club_flags
FOR SELECT
USING (is_admin(auth.uid()));

COMMENT ON POLICY club_flags_select_admin ON club_flags IS 'Admins can view all club flags';

-- Policy: Authenticated users can create flags
CREATE POLICY club_flags_insert
ON club_flags
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() IS NOT NULL
);

COMMENT ON POLICY club_flags_insert ON club_flags IS 'Authenticated users can flag clubs';

-- Policy: Admins can update flags (for review/resolution)
CREATE POLICY club_flags_update_admin
ON club_flags
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

COMMENT ON POLICY club_flags_update_admin ON club_flags IS 'Admins can update flag status and review information';

-- Policy: Users can delete their own pending flags
CREATE POLICY club_flags_delete_own
ON club_flags
FOR DELETE
USING (
    auth.uid() = user_id
    AND status = 'pending'
);

COMMENT ON POLICY club_flags_delete_own ON club_flags IS 'Users can delete their own pending flags';

-- Enable RLS on moderation_logs table
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view moderation logs
CREATE POLICY moderation_logs_select_admin
ON moderation_logs
FOR SELECT
USING (is_admin(auth.uid()));

COMMENT ON POLICY moderation_logs_select_admin ON moderation_logs IS 'Only admins can view moderation logs';

-- Policy: Only admins can insert moderation logs
CREATE POLICY moderation_logs_insert_admin
ON moderation_logs
FOR INSERT
WITH CHECK (is_admin(auth.uid()) AND auth.uid() = admin_id);

COMMENT ON POLICY moderation_logs_insert_admin ON moderation_logs IS 'Only admins can create moderation log entries';

-- Update profiles policies to allow admin checks
-- Policy: Users can view their own profile
DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- Policy: Admins can view all profiles
DROP POLICY IF EXISTS profiles_select_admin ON profiles;
CREATE POLICY profiles_select_admin
ON profiles
FOR SELECT
USING (is_admin(auth.uid()));

COMMENT ON POLICY profiles_select_admin ON profiles IS 'Admins can view all user profiles';

-- Policy: Users can update their own profile (but not is_admin field)
DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id
    -- Prevent users from self-promoting to admin
    AND is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
);

COMMENT ON POLICY profiles_update_own ON profiles IS 'Users can update their own profile but cannot change admin status';

-- Policy: Admins can update any profile
DROP POLICY IF EXISTS profiles_update_admin ON profiles;
CREATE POLICY profiles_update_admin
ON profiles
FOR UPDATE
USING (is_admin(auth.uid()));

COMMENT ON POLICY profiles_update_admin ON profiles IS 'Admins can update any profile including admin status';

-- Update clubs policies to respect approval status
-- Policy: Public can view approved clubs only
DROP POLICY IF EXISTS clubs_select_approved ON clubs;
CREATE POLICY clubs_select_approved
ON clubs
FOR SELECT
USING (
    approval_status = 'approved'
    OR created_by = auth.uid()
    OR is_admin(auth.uid())
);

COMMENT ON POLICY clubs_select_approved ON clubs IS 'Users can view approved clubs, their own clubs (any status), admins can view all';

-- Policy: Authenticated users can create clubs (will be pending by default)
DROP POLICY IF EXISTS clubs_insert ON clubs;
CREATE POLICY clubs_insert
ON clubs
FOR INSERT
WITH CHECK (
    auth.uid() = created_by
    AND approval_status = 'pending'
);

COMMENT ON POLICY clubs_insert ON clubs IS 'Authenticated users can create clubs which start as pending';

-- Policy: Creators can update their own clubs (except approval fields)
DROP POLICY IF EXISTS clubs_update_own ON clubs;
CREATE POLICY clubs_update_own
ON clubs
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
DROP POLICY IF EXISTS clubs_update_admin ON clubs;
CREATE POLICY clubs_update_admin
ON clubs
FOR UPDATE
USING (is_admin(auth.uid()));

COMMENT ON POLICY clubs_update_admin ON clubs IS 'Admins can update any club including approval workflow fields';

-- =====================================================================
-- SECTION 7: TRIGGERS FOR AUTOMATIC LOGGING
-- =====================================================================

-- Trigger function to log club approval/rejection
CREATE OR REPLACE FUNCTION log_club_approval_change()
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

CREATE TRIGGER club_approval_logging_trigger
    AFTER UPDATE ON clubs
    FOR EACH ROW
    WHEN (OLD.approval_status IS DISTINCT FROM NEW.approval_status)
    EXECUTE FUNCTION log_club_approval_change();

COMMENT ON TRIGGER club_approval_logging_trigger ON clubs IS 'Automatically logs club approval/rejection to moderation_logs';

-- Trigger function to log club flag resolution
CREATE OR REPLACE FUNCTION log_club_flag_resolution()
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

CREATE TRIGGER club_flag_resolution_logging_trigger
    AFTER UPDATE ON club_flags
    FOR EACH ROW
    WHEN (OLD.status = 'pending' AND NEW.status IN ('resolved', 'dismissed'))
    EXECUTE FUNCTION log_club_flag_resolution();

COMMENT ON TRIGGER club_flag_resolution_logging_trigger ON club_flags IS 'Automatically logs club flag resolution/dismissal to moderation_logs';

-- =====================================================================
-- SECTION 8: GRANTS AND PERMISSIONS
-- =====================================================================

-- Grant usage on public schema (if needed)
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- Grant appropriate permissions on tables
GRANT SELECT, INSERT ON club_flags TO authenticated;
GRANT UPDATE, DELETE ON club_flags TO authenticated;

GRANT SELECT ON moderation_logs TO authenticated;
GRANT INSERT ON moderation_logs TO authenticated;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION log_moderation_action(UUID, TEXT, TEXT, UUID, JSONB) TO authenticated;

-- =====================================================================
-- MIGRATION COMPLETE
-- =====================================================================

COMMIT;

-- Summary of changes:
-- - Added is_admin column to profiles with index
-- - Created club_flags table with full CRUD policies
-- - Added approval workflow columns to clubs table
-- - Created moderation_logs table for audit trail
-- - Created is_admin() and log_moderation_action() helper functions
-- - Implemented comprehensive RLS policies for all moderation features
-- - Added automatic triggers for logging approval and flag resolution
-- - Updated existing policies to respect admin privileges
