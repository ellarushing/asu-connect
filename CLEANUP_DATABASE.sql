-- ============================================================================
-- ASU CONNECT DATABASE CLEANUP/RESET SCRIPT
-- ============================================================================
--
-- PURPOSE: Safely prepares the database for a fresh installation by removing
--          all custom tables, functions, triggers, and data while preserving
--          the Supabase Auth system.
--
-- ============================================================================
-- CRITICAL WARNINGS
-- ============================================================================
--
-- 1. THIS SCRIPT WILL PERMANENTLY DELETE ALL DATA
-- 2. THIS ACTION CANNOT BE UNDONE
-- 3. ALWAYS CREATE A BACKUP BEFORE RUNNING THIS SCRIPT
-- 4. THIS SCRIPT IS IN ROLLBACK MODE BY DEFAULT FOR SAFETY
-- 5. YOU MUST MANUALLY CHANGE "ROLLBACK" TO "COMMIT" TO EXECUTE
--
-- ============================================================================
-- BACKUP INSTRUCTIONS
-- ============================================================================
--
-- Before running this script, create a backup:
--
-- Option 1: Supabase Dashboard
--   1. Go to Database → Backups
--   2. Click "Create backup"
--   3. Wait for backup to complete
--
-- Option 2: pg_dump (if you have direct database access)
--   pg_dump -h your-db.supabase.co -U postgres -d postgres > backup.sql
--
-- ============================================================================
-- HOW TO USE THIS SCRIPT
-- ============================================================================
--
-- STEP 1: REVIEW WHAT WILL BE DELETED (see safety check below)
-- STEP 2: CREATE A BACKUP (see backup instructions above)
-- STEP 3: Copy this entire file
-- STEP 4: Open Supabase Dashboard → SQL Editor → New Query
-- STEP 5: Paste the entire contents
-- STEP 6: Click "Run" - script will execute in DRY RUN mode (no changes made)
-- STEP 7: Review the output and verification queries
-- STEP 8: If you're ABSOLUTELY SURE, change line 167 from "ROLLBACK;" to "COMMIT;"
-- STEP 9: Run the script again to actually perform the cleanup
--
-- ============================================================================
-- SAFETY CHECK: WHAT WILL BE DELETED
-- ============================================================================
--
-- TABLES TO BE DROPPED (in order):
--   1. moderation_logs       - All admin action audit logs
--   2. club_flags            - All club reports/flags
--   3. event_flags           - All event reports/flags
--   4. event_registrations   - All event sign-ups
--   5. club_members          - All club memberships and requests
--   6. events                - All events
--   7. clubs                 - All clubs
--   8. profiles              - All user profile data (admin flags, etc.)
--
-- WHAT WILL BE PRESERVED:
--   - auth.users             - All user accounts (NEVER TOUCHED)
--   - auth.sessions          - User login sessions
--   - auth.identities        - OAuth/SSO identities
--   - auth.* (all tables)    - Complete Supabase Auth system
--   - storage.*              - File storage system
--   - _supabase_migrations   - Migration tracking
--
-- FUNCTIONS TO BE DROPPED:
--   - log_moderation_action()  - Logs admin actions to moderation_logs
--   - is_admin()               - Checks if user is an admin
--   - handle_new_user()        - Trigger function for new user profiles (if exists)
--
-- TRIGGERS TO BE DROPPED:
--   - Any triggers on profiles table
--   - Any triggers on moderation_logs table
--   - Any auto-timestamp triggers
--
-- INDEXES:
--   - All indexes will be dropped automatically with CASCADE
--
-- RLS POLICIES:
--   - All RLS policies will be dropped automatically with CASCADE
--
-- ============================================================================
-- DATA LOSS SUMMARY
-- ============================================================================
--
-- Running this script will result in the loss of:
--   - ALL clubs and club data
--   - ALL events and event data
--   - ALL club memberships
--   - ALL event registrations
--   - ALL flagged content reports
--   - ALL moderation logs
--   - ALL user profile data (avatars, bio, admin status)
--
-- Running this script will PRESERVE:
--   - User accounts (email, password, authentication)
--   - User sessions
--   - OAuth connections
--   - Uploaded files in storage (though references will be lost)
--
-- ============================================================================

-- ============================================================================
-- BEGIN TRANSACTION (SAFETY MODE: WILL ROLLBACK BY DEFAULT)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DISPLAY CURRENT DATA COUNTS (Before Deletion)
-- ============================================================================

DO $$
DECLARE
    clubs_count INTEGER;
    events_count INTEGER;
    members_count INTEGER;
    registrations_count INTEGER;
    event_flags_count INTEGER;
    club_flags_count INTEGER;
    moderation_logs_count INTEGER;
    profiles_count INTEGER;
BEGIN
    -- Get counts from each table (if they exist)
    SELECT COUNT(*) INTO clubs_count FROM public.clubs WHERE true;
    SELECT COUNT(*) INTO events_count FROM public.events WHERE true;
    SELECT COUNT(*) INTO members_count FROM public.club_members WHERE true;
    SELECT COUNT(*) INTO registrations_count FROM public.event_registrations WHERE true;
    SELECT COUNT(*) INTO event_flags_count FROM public.event_flags WHERE true;
    SELECT COUNT(*) INTO club_flags_count FROM public.club_flags WHERE true;
    SELECT COUNT(*) INTO moderation_logs_count FROM public.moderation_logs WHERE true;
    SELECT COUNT(*) INTO profiles_count FROM public.profiles WHERE true;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'CURRENT DATA COUNTS (BEFORE CLEANUP)';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Clubs: %', clubs_count;
    RAISE NOTICE 'Events: %', events_count;
    RAISE NOTICE 'Club Members: %', members_count;
    RAISE NOTICE 'Event Registrations: %', registrations_count;
    RAISE NOTICE 'Event Flags: %', event_flags_count;
    RAISE NOTICE 'Club Flags: %', club_flags_count;
    RAISE NOTICE 'Moderation Logs: %', moderation_logs_count;
    RAISE NOTICE 'User Profiles: %', profiles_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ALL OF THIS DATA WILL BE PERMANENTLY DELETED!';
    RAISE NOTICE '========================================';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Note: Some tables may not exist yet, which is okay.';
END $$;

-- ============================================================================
-- STEP 2: DROP TRIGGERS (Must be done before dropping functions)
-- ============================================================================

-- Drop triggers on profiles table (if they exist)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS handle_updated_at ON public.profiles CASCADE;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles CASCADE;

-- Drop any other custom triggers
DROP TRIGGER IF EXISTS update_clubs_updated_at ON public.clubs CASCADE;
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events CASCADE;
DROP TRIGGER IF EXISTS update_event_flags_updated_at ON public.event_flags CASCADE;
DROP TRIGGER IF EXISTS update_club_flags_updated_at ON public.club_flags CASCADE;

DO $$ BEGIN RAISE NOTICE 'Step 2: Dropped all triggers'; END $$;

-- ============================================================================
-- STEP 3: DROP CUSTOM FUNCTIONS
-- ============================================================================

-- Drop moderation logging function
DROP FUNCTION IF EXISTS public.log_moderation_action(UUID, TEXT, TEXT, UUID, JSONB) CASCADE;

-- Drop admin check function
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;

-- Drop profile creation trigger function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Drop any timestamp update functions
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.moddatetime() CASCADE;

DO $$ BEGIN RAISE NOTICE 'Step 3: Dropped all custom functions'; END $$;

-- ============================================================================
-- STEP 4: DROP TABLES (In Reverse Dependency Order)
-- ============================================================================

-- Drop child tables first (those with foreign keys to other tables)

-- Level 4: Tables that depend on multiple other tables
DROP TABLE IF EXISTS public.moderation_logs CASCADE;
DO $$ BEGIN RAISE NOTICE 'Step 4.1: Dropped moderation_logs table'; END $$;

-- Level 3: Flag tables (depend on clubs/events and users)
DROP TABLE IF EXISTS public.club_flags CASCADE;
DO $$ BEGIN RAISE NOTICE 'Step 4.2: Dropped club_flags table'; END $$;

DROP TABLE IF EXISTS public.event_flags CASCADE;
DO $$ BEGIN RAISE NOTICE 'Step 4.3: Dropped event_flags table'; END $$;

-- Level 2: Registration/membership tables (depend on clubs/events and users)
DROP TABLE IF EXISTS public.event_registrations CASCADE;
DO $$ BEGIN RAISE NOTICE 'Step 4.4: Dropped event_registrations table'; END $$;

DROP TABLE IF EXISTS public.club_members CASCADE;
DO $$ BEGIN RAISE NOTICE 'Step 4.5: Dropped club_members table'; END $$;

-- Level 1: Events table (depends on clubs and users)
DROP TABLE IF EXISTS public.events CASCADE;
DO $$ BEGIN RAISE NOTICE 'Step 4.6: Dropped events table'; END $$;

-- Level 0: Base tables
DROP TABLE IF EXISTS public.clubs CASCADE;
DO $$ BEGIN RAISE NOTICE 'Step 4.7: Dropped clubs table'; END $$;

DROP TABLE IF EXISTS public.profiles CASCADE;
DO $$ BEGIN RAISE NOTICE 'Step 4.8: Dropped profiles table'; END $$;

DO $$ BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Step 4: All custom tables dropped';
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- STEP 5: DROP CUSTOM TYPES (If any were created)
-- ============================================================================

-- Drop any custom enum types
DROP TYPE IF EXISTS public.flag_status CASCADE;
DROP TYPE IF EXISTS public.club_approval_status CASCADE;
DROP TYPE IF EXISTS public.member_role CASCADE;

DO $$ BEGIN RAISE NOTICE 'Step 5: Dropped custom types (if any existed)'; END $$;

-- ============================================================================
-- STEP 6: VERIFICATION QUERIES
-- ============================================================================

-- This section runs queries to verify the cleanup was successful

DO $$
DECLARE
    remaining_tables TEXT;
    auth_users_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICATION RESULTS';
    RAISE NOTICE '========================================';

    -- Check for remaining custom tables
    SELECT string_agg(tablename, ', ')
    INTO remaining_tables
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE 'sql_%'
    AND tablename != '_supabase_migrations';

    IF remaining_tables IS NULL THEN
        RAISE NOTICE 'Custom tables: NONE (cleanup successful)';
    ELSE
        RAISE NOTICE 'WARNING: Remaining custom tables: %', remaining_tables;
    END IF;

    -- Verify auth.users table is still intact
    SELECT COUNT(*) INTO auth_users_count FROM auth.users;
    RAISE NOTICE 'Auth users preserved: % user accounts', auth_users_count;

    -- Check for remaining custom functions
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN ('log_moderation_action', 'is_admin', 'handle_new_user')
    ) THEN
        RAISE NOTICE 'WARNING: Some custom functions may still exist';
    ELSE
        RAISE NOTICE 'Custom functions: NONE (cleanup successful)';
    END IF;

    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- STEP 7: SAFETY ROLLBACK (CHANGE TO COMMIT TO EXECUTE)
-- ============================================================================

-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- CRITICAL: BY DEFAULT, THIS SCRIPT DOES NOT MAKE ANY CHANGES
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- To actually perform the cleanup:
-- 1. Review all warnings above
-- 2. Ensure you have a backup
-- 3. Change the line below from "ROLLBACK;" to "COMMIT;"
-- 4. Run the script again
--

ROLLBACK;  -- ← CHANGE THIS TO "COMMIT;" TO ACTUALLY DELETE DATA

-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

-- ============================================================================
-- POST-CLEANUP INSTRUCTIONS
-- ============================================================================
--
-- After running this script successfully (with COMMIT), you should:
--
-- 1. Apply your fresh schema by running:
--    APPLY_THIS_TO_SUPABASE.sql
--    or
--    supabase/migrations/004_admin_moderation_system.sql
--
-- 2. Create an admin user:
--    UPDATE profiles SET is_admin = true WHERE email = 'admin@asu.edu';
--
-- 3. Test the application thoroughly:
--    - User registration
--    - Club creation
--    - Event creation
--    - Flagging system
--    - Admin dashboard
--
-- 4. Restore any backup data if needed (selective restore)
--
-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================
--
-- If you encounter errors:
--
-- 1. "relation does not exist" - This is okay, it means the table was
--    already deleted or never existed.
--
-- 2. "cannot drop table because other objects depend on it" - The CASCADE
--    option should handle this, but if it persists, check for views or
--    other database objects depending on these tables.
--
-- 3. "permission denied" - Ensure you're running as the database owner
--    (typically 'postgres' user in Supabase).
--
-- 4. Foreign key violations - This shouldn't happen with CASCADE, but if
--    it does, you may need to drop tables in a different order.
--
-- ============================================================================
-- EMERGENCY ROLLBACK
-- ============================================================================
--
-- If something goes wrong DURING execution:
--
-- 1. If running in Supabase SQL Editor:
--    - The transaction should auto-rollback on error
--    - Check the error message and fix the issue
--
-- 2. If you accidentally ran with COMMIT and need to restore:
--    - Go to Database → Backups in Supabase Dashboard
--    - Select your backup
--    - Click "Restore"
--    - WARNING: This will restore the ENTIRE database
--
-- ============================================================================
-- ADDITIONAL SAFETY CHECKS
-- ============================================================================

-- Query to list all tables that will be affected (run before cleanup):
--
-- SELECT tablename, schemaname
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN (
--   'clubs', 'events', 'club_members', 'event_registrations',
--   'event_flags', 'club_flags', 'moderation_logs', 'profiles'
-- );

-- Query to export data counts before deletion:
--
-- SELECT 'clubs' as table_name, COUNT(*) as row_count FROM public.clubs
-- UNION ALL
-- SELECT 'events', COUNT(*) FROM public.events
-- UNION ALL
-- SELECT 'club_members', COUNT(*) FROM public.club_members
-- UNION ALL
-- SELECT 'event_registrations', COUNT(*) FROM public.event_registrations
-- UNION ALL
-- SELECT 'event_flags', COUNT(*) FROM public.event_flags
-- UNION ALL
-- SELECT 'club_flags', COUNT(*) FROM public.club_flags
-- UNION ALL
-- SELECT 'moderation_logs', COUNT(*) FROM public.moderation_logs
-- UNION ALL
-- SELECT 'profiles', COUNT(*) FROM public.profiles;

-- ============================================================================
-- END OF CLEANUP SCRIPT
-- ============================================================================
