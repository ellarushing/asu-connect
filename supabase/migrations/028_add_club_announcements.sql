-- =====================================================================
-- Migration: 028_add_club_announcements.sql
-- Description: Club announcements system for ASU Connect
-- Created: 2025-11-20
-- =====================================================================

-- This migration adds:
-- 1. Club announcements table for updates and news
-- 2. RLS policies allowing club admins, student leaders (if members), and platform admins to post
-- 3. Indexes for efficient querying
-- 4. Helper function to check posting permissions

BEGIN;

-- =====================================================================
-- SECTION 1: CLUB ANNOUNCEMENTS TABLE
-- =====================================================================

-- Create club_announcements table
CREATE TABLE IF NOT EXISTS club_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT club_announcements_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
    CONSTRAINT club_announcements_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 5000)
);

-- Add comments for documentation
COMMENT ON TABLE club_announcements IS 'Stores announcements and updates posted by club admins, student leaders, and platform admins';
COMMENT ON COLUMN club_announcements.club_id IS 'The club this announcement belongs to';
COMMENT ON COLUMN club_announcements.created_by IS 'User who created the announcement';
COMMENT ON COLUMN club_announcements.title IS 'Announcement title (1-200 characters)';
COMMENT ON COLUMN club_announcements.content IS 'Announcement content/body (1-5000 characters)';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_club_announcements_club_id ON club_announcements(club_id);
CREATE INDEX IF NOT EXISTS idx_club_announcements_created_by ON club_announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_club_announcements_created_at ON club_announcements(created_at DESC);

-- Composite index for common query pattern (club announcements sorted by date)
CREATE INDEX IF NOT EXISTS idx_club_announcements_club_date
ON club_announcements(club_id, created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_club_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER club_announcements_updated_at_trigger
    BEFORE UPDATE ON club_announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_club_announcements_updated_at();

COMMENT ON TRIGGER club_announcements_updated_at_trigger ON club_announcements IS 'Automatically updates updated_at timestamp on announcement modifications';

-- =====================================================================
-- SECTION 2: HELPER FUNCTION FOR POSTING PERMISSIONS
-- =====================================================================

-- Function to check if a user can post announcements to a club
-- Returns TRUE if:
-- 1. User is a platform admin (profiles.role = 'admin'), OR
-- 2. User is a club admin for this club (club_members.role = 'admin'), OR
-- 3. User is a student leader (profiles.role = 'student_leader') AND is a member of the club
CREATE OR REPLACE FUNCTION can_post_announcement(user_uuid UUID, target_club_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_profile_role user_role;
    club_membership_role TEXT;
    is_club_member BOOLEAN;
BEGIN
    -- Get user's profile role
    SELECT role INTO user_profile_role
    FROM profiles
    WHERE id = user_uuid;

    -- Platform admins can post to any club
    IF user_profile_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Check club membership
    SELECT role, TRUE INTO club_membership_role, is_club_member
    FROM club_members
    WHERE user_id = user_uuid
    AND club_id = target_club_id
    AND status = 'approved';

    -- If not a member, cannot post
    IF NOT is_club_member THEN
        RETURN FALSE;
    END IF;

    -- Club admins can post
    IF club_membership_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Student leaders who are members can post
    IF user_profile_role = 'student_leader' AND is_club_member THEN
        RETURN TRUE;
    END IF;

    -- Otherwise, cannot post
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_post_announcement(UUID, UUID) IS 'Returns TRUE if user can post announcements to the specified club (platform admins, club admins, or student leaders who are members)';

-- =====================================================================
-- SECTION 3: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- Enable RLS on club_announcements table
ALTER TABLE club_announcements ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view announcements for approved clubs
CREATE POLICY club_announcements_select_public
ON club_announcements
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM clubs
        WHERE clubs.id = club_announcements.club_id
        AND clubs.approval_status = 'approved'
    )
);

COMMENT ON POLICY club_announcements_select_public ON club_announcements IS 'Anyone can view announcements for approved clubs';

-- Policy: Club creators can view announcements for their clubs (any status)
CREATE POLICY club_announcements_select_creator
ON club_announcements
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM clubs
        WHERE clubs.id = club_announcements.club_id
        AND clubs.created_by = auth.uid()
    )
);

COMMENT ON POLICY club_announcements_select_creator ON club_announcements IS 'Club creators can view announcements for their clubs regardless of approval status';

-- Policy: Club members can view announcements for their clubs
CREATE POLICY club_announcements_select_members
ON club_announcements
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM club_members
        WHERE club_members.club_id = club_announcements.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'approved'
    )
);

COMMENT ON POLICY club_announcements_select_members ON club_announcements IS 'Club members can view announcements for clubs they belong to';

-- Policy: Platform admins can view all announcements
CREATE POLICY club_announcements_select_admin
ON club_announcements
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

COMMENT ON POLICY club_announcements_select_admin ON club_announcements IS 'Platform admins can view all announcements';

-- Policy: Users with posting permissions can create announcements
CREATE POLICY club_announcements_insert
ON club_announcements
FOR INSERT
WITH CHECK (
    auth.uid() = created_by
    AND auth.uid() IS NOT NULL
    AND can_post_announcement(auth.uid(), club_id)
);

COMMENT ON POLICY club_announcements_insert ON club_announcements IS 'Club admins, student leader members, and platform admins can create announcements';

-- Policy: Users with posting permissions can update their own announcements
CREATE POLICY club_announcements_update_own
ON club_announcements
FOR UPDATE
USING (
    auth.uid() = created_by
    AND can_post_announcement(auth.uid(), club_id)
)
WITH CHECK (
    auth.uid() = created_by
    AND can_post_announcement(auth.uid(), club_id)
    -- Prevent changing club_id or created_by
    AND club_id = (SELECT club_id FROM club_announcements WHERE id = club_announcements.id)
    AND created_by = (SELECT created_by FROM club_announcements WHERE id = club_announcements.id)
);

COMMENT ON POLICY club_announcements_update_own ON club_announcements IS 'Authorized users can update their own announcements (but cannot change club or author)';

-- Policy: Platform admins can update any announcement
CREATE POLICY club_announcements_update_admin
ON club_announcements
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

COMMENT ON POLICY club_announcements_update_admin ON club_announcements IS 'Platform admins can update any announcement';

-- Policy: Users with posting permissions can delete their own announcements
CREATE POLICY club_announcements_delete_own
ON club_announcements
FOR DELETE
USING (
    auth.uid() = created_by
    AND can_post_announcement(auth.uid(), club_id)
);

COMMENT ON POLICY club_announcements_delete_own ON club_announcements IS 'Authorized users can delete their own announcements';

-- Policy: Platform admins can delete any announcement
CREATE POLICY club_announcements_delete_admin
ON club_announcements
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

COMMENT ON POLICY club_announcements_delete_admin ON club_announcements IS 'Platform admins can delete any announcement';

-- =====================================================================
-- SECTION 4: GRANTS AND PERMISSIONS
-- =====================================================================

-- Grant usage on public schema (if needed)
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- Grant appropriate permissions on tables
GRANT SELECT ON club_announcements TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON club_announcements TO authenticated;

-- Grant execute on helper function
GRANT EXECUTE ON FUNCTION can_post_announcement(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_club_announcements_updated_at() TO authenticated;

-- =====================================================================
-- MIGRATION COMPLETE
-- =====================================================================

COMMIT;

-- Summary of changes:
-- - Created club_announcements table with title, content, timestamps
-- - Added can_post_announcement() helper function for permission checks
-- - Implemented comprehensive RLS policies:
--   * Anyone can view announcements for approved clubs
--   * Club creators and members can view announcements for their clubs
--   * Platform admins can view all announcements
--   * Club admins, student leader members, and platform admins can create/update/delete
-- - Added indexes for efficient querying
-- - Added automatic updated_at trigger
