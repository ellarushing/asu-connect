-- Migration: Add student leader role system
-- Created: 2025-11-19
-- Description: Adds user_role enum to profiles table to support student leaders
--
-- User Roles:
-- - student: Default role, can join clubs and register for events
-- - student_leader: Can create clubs and events, manage clubs
-- - admin: Platform admin with full moderation powers

BEGIN;

-- Create enum type for user roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'student_leader', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role column to profiles table (default to 'student')
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'student' NOT NULL;

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role)
WHERE role IN ('student_leader', 'admin');

-- Migrate existing is_admin users to 'admin' role
UPDATE profiles
SET role = 'admin'
WHERE is_admin = TRUE;

-- Keep is_admin for backward compatibility but derive from role
-- Create function to keep is_admin in sync with role
CREATE OR REPLACE FUNCTION sync_is_admin_with_role()
RETURNS TRIGGER AS $$
BEGIN
    NEW.is_admin := (NEW.role = 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-sync is_admin field
DROP TRIGGER IF EXISTS profiles_sync_is_admin ON profiles;
CREATE TRIGGER profiles_sync_is_admin
    BEFORE INSERT OR UPDATE OF role ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_is_admin_with_role();

-- Add comments for documentation
COMMENT ON COLUMN profiles.role IS 'User role: student (default), student_leader (can create clubs/events), admin (platform admin)';
COMMENT ON INDEX idx_profiles_role IS 'Optimizes queries filtering by elevated roles';
COMMENT ON FUNCTION sync_is_admin_with_role() IS 'Keeps is_admin field synchronized with role enum for backward compatibility';

COMMIT;

-- Verification query (run separately to check results)
-- SELECT role, COUNT(*) as count
-- FROM profiles
-- GROUP BY role;
