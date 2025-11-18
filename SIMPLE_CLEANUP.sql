-- SIMPLE_CLEANUP.sql
-- Simple, robust cleanup script for ASU Connect database
-- Run this in Supabase SQL Editor to completely reset the database
-- No transactions, no error handling - just straightforward DROP statements

-- ============================================
-- DROP TABLES (in dependency order)
-- ============================================
-- CASCADE automatically handles triggers and dependencies

-- Drop junction tables first (they reference other tables)
DROP TABLE IF EXISTS club_members CASCADE;
DROP TABLE IF EXISTS club_tags CASCADE;
DROP TABLE IF EXISTS event_attendees CASCADE;
DROP TABLE IF EXISTS event_tags CASCADE;
DROP TABLE IF EXISTS user_interests CASCADE;

-- Drop main entity tables
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS clubs CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS messages CASCADE;

-- Drop reference/lookup tables
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Drop admin tables
DROP TABLE IF EXISTS flagged_content CASCADE;
DROP TABLE IF EXISTS admin_actions CASCADE;

-- Drop user-related tables last (many tables reference profiles)
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- DROP FUNCTIONS
-- ============================================

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS increment_member_count() CASCADE;
DROP FUNCTION IF EXISTS decrement_member_count() CASCADE;
DROP FUNCTION IF EXISTS increment_attendee_count() CASCADE;
DROP FUNCTION IF EXISTS decrement_attendee_count() CASCADE;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify everything is gone

-- Check remaining tables (should only show system tables)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check remaining functions (should be empty or only system functions)
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Check remaining triggers (should be empty)
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- If you see this, the cleanup completed without errors
SELECT 'Cleanup completed successfully!' as status;
