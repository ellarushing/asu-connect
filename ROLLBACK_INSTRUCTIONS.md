# COMPLETE ROLLBACK TO WORKING STATE

This guide will rollback ALL changes made around 3:30 PM today (2025-11-18) and restore your project to a working state.

## Current Situation

**Uncommitted Changes (need to be reverted):**
- `app/admin/page.tsx` - Modified
- `app/api/admin/flags/route.ts` - Modified
- `app/api/admin/logs/route.ts` - Modified
- `app/api/admin/stats/route.ts` - Modified
- `app/api/clubs/[id]/membership/route.ts` - Modified (added rejoin logic)
- `app/api/clubs/route.ts` - Modified
- `app/api/events/[id]/register/route.ts` - Modified
- `app/api/events/route.ts` - Modified
- `app/dashboard/page.tsx` - Modified
- `next.config.ts` - Modified

**New Files (need to be deleted):**
- 12+ troubleshooting markdown files
- 2 new admin component files
- 12 migration files (009-020)

**Last Known Good State:**
- Commit: `358a49c` (Flag and Member errors resolved - 2025-11-18 11:58 AM)
- Last good migration: `008_add_club_members_status.sql`

---

## ROLLBACK STEPS

### Step 1: Rollback Code Files (Uncommitted Changes)

Run these commands from your project root:

```bash
# Navigate to project root
cd /Users/ellarushing/downloads/asu-connect

# Restore all modified files to their last committed state
git restore app/admin/page.tsx
git restore app/api/admin/flags/route.ts
git restore app/api/admin/logs/route.ts
git restore app/api/admin/stats/route.ts
git restore app/api/clubs/[id]/membership/route.ts
git restore app/api/clubs/route.ts
git restore app/api/events/[id]/register/route.ts
git restore app/api/events/route.ts
git restore app/dashboard/page.tsx
git restore next.config.ts

# Verify changes were reverted
git status
```

**Expected output:** Should show "nothing to commit, working tree clean" for the modified files.

---

### Step 2: Delete Troubleshooting Documentation Files

```bash
# Delete all troubleshooting markdown files created today
rm CLUB_JOIN_FIX_GUIDE.md
rm CLUB_MEMBERSHIP_POLICIES_DIAGRAM.md
rm CLUB_REJOIN_FIX.md
rm FIXES_SUMMARY.md
rm INVESTIGATION_SUMMARY.md
rm MIGRATION_014_INSTRUCTIONS.md
rm MIGRATION_015_GUIDE.md
rm QUICK_FIX_GUIDE.md
rm QUICK_FIX_STEPS.md
rm REJOIN_FIX_SUMMARY.md

# Delete admin component files (can recreate later if needed)
rm components/admin-flags-client.tsx
rm components/admin-logs-client.tsx

# Verify files are deleted
git status
```

---

### Step 3: Rollback Database (Run Migration 021)

**IMPORTANT:** This migration is safe to run and will restore your database to the state after migration 008.

```bash
# The migration file has been created at:
# /Users/ellarushing/downloads/asu-connect/supabase/migrations/021_complete_rollback_to_008.sql

# Apply the rollback migration via Supabase CLI or Dashboard
# Option A: Using Supabase CLI (if you have it set up)
supabase db push

# Option B: Using Supabase Dashboard
# 1. Go to your Supabase project dashboard
# 2. Navigate to SQL Editor
# 3. Copy the contents of supabase/migrations/021_complete_rollback_to_008.sql
# 4. Paste and run the SQL
# 5. Check the NOTICE messages for confirmation
```

**What this migration does:**
1. Drops all policies created by migrations 009-020
2. Reverts the `club_members.status` constraint back to original (removes 'left' status)
3. Updates any records with 'left' status back to 'approved'
4. Recreates the original policies from migrations 001-008
5. Provides verification output

---

### Step 4: Delete Bad Migration Files

**After successfully running migration 021**, delete the problematic migration files:

```bash
# Delete migrations 009-020
rm supabase/migrations/009_optimize_admin_rls_policies.sql
rm supabase/migrations/010_add_left_status_to_members.sql
rm supabase/migrations/011_fix_clubs_insert_policy.sql
rm supabase/migrations/012_complete_rls_optimization.sql
rm supabase/migrations/013_fix_infinite_recursion.sql
rm supabase/migrations/014_fix_rls_and_membership.sql
rm supabase/migrations/015_fix_club_join_insert_policy.sql
rm supabase/migrations/015_test_queries.sql
rm supabase/migrations/016_diagnose_club_join_issue.sql
rm supabase/migrations/017_fix_club_join_final.sql
rm supabase/migrations/018_rollback_to_015.sql
rm supabase/migrations/019_test_club_join.sql
rm supabase/migrations/020_add_rejoin_policy.sql

# Verify remaining migrations
ls supabase/migrations/
```

**You should see only:**
- 001 through 008 (original good migrations)
- 021_complete_rollback_to_008.sql (the rollback migration)

---

### Step 5: Verify Rollback Success

Run these verification checks:

#### Code Verification
```bash
# Check git status - should be clean
git status

# Expected output:
# On branch feature/flagged-content-admin-dashboard
# nothing to commit, working tree clean

# Verify you're on the right commit
git log --oneline -1

# Expected output:
# 358a49c Flag and Member errors resolved...
```

#### Database Verification

Run these queries in your Supabase SQL Editor:

```sql
-- 1. Check club_members status constraint (should only allow pending, approved, rejected)
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'club_members'
AND con.conname = 'club_members_status_check';

-- Expected: CHECK (status IN ('pending', 'approved', 'rejected'))
-- Should NOT include 'left'

-- 2. Count policies on each table
SELECT
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('clubs', 'events', 'club_members', 'event_registrations')
GROUP BY schemaname, tablename
ORDER BY tablename;

-- 3. List all policies (should match original state)
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('clubs', 'events', 'club_members', 'event_registrations')
ORDER BY tablename, policyname;

-- 4. Check for any records with 'left' status (should be 0)
SELECT COUNT(*) as left_status_count
FROM club_members
WHERE status = 'left';

-- Expected: 0
```

#### Functional Verification

Test basic functionality:

1. **Login** - Can you log in successfully?
2. **View Clubs** - Can you see the list of clubs?
3. **Join Club** - Try joining a club (should work without errors)
4. **View Events** - Can you see events?
5. **Admin Features** - Check if admin dashboard still works

---

## What You'll Lose

By rolling back, you will lose:

1. **"Left" Status Feature** - The ability to track when users leave clubs
2. **Rejoin Logic** - Special handling for users rejoining clubs they previously left
3. **RLS Optimizations** - Any policy optimizations attempted in migrations 009-020
4. **Admin Route Changes** - Any modifications made to admin endpoints today
5. **Troubleshooting Documentation** - All the markdown files created during debugging

---

## What You'll Keep

Everything from before 3:30 PM today:

1. **All Core Functionality** - Clubs, events, memberships, registrations
2. **Admin Features** - Admin dashboard, moderation, flagging (from earlier work)
3. **User Authentication** - Login/logout functionality
4. **Status Tracking** - pending, approved, rejected statuses for club members
5. **All Commits** - All committed work through commit 358a49c

---

## After Rollback - Next Steps

Once rollback is complete:

1. **Test Everything** - Make sure basic functionality works
2. **Identify Root Issues** - If you want to add "left" status or rejoin logic later, plan it carefully
3. **One Change at a Time** - When adding new features, do one small migration at a time
4. **Test After Each Migration** - Don't apply multiple migrations without testing
5. **Backup Before Changes** - Consider creating a database backup before major changes

---

## Emergency: If Rollback Fails

If migration 021 fails to apply:

### Option 1: Manual Policy Cleanup
```sql
-- Drop ALL policies on the affected tables
DROP POLICY IF EXISTS ALL ON public.clubs;
DROP POLICY IF EXISTS ALL ON public.events;
DROP POLICY IF EXISTS ALL ON public.club_members;
DROP POLICY IF EXISTS ALL ON public.event_registrations;

-- Then run migration 021 again
```

### Option 2: Full Database Reset (NUCLEAR OPTION)
```bash
# This will reset your ENTIRE database to migration 001
# Use only as last resort
supabase db reset
```

---

## Questions?

If you encounter any issues during rollback:

1. **Check Error Messages** - Read them carefully, they often explain the problem
2. **Check Policy Conflicts** - Run: `SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('clubs', 'events', 'club_members', 'event_registrations');`
3. **Check for Leftover Policies** - The rollback might have missed some custom-named policies
4. **Contact Support** - If stuck, share the specific error message

---

## Quick Command Summary

```bash
# Step 1: Rollback code
cd /Users/ellarushing/downloads/asu-connect
git restore app/admin/page.tsx app/api/admin/flags/route.ts app/api/admin/logs/route.ts app/api/admin/stats/route.ts app/api/clubs/[id]/membership/route.ts app/api/clubs/route.ts app/api/events/[id]/register/route.ts app/api/events/route.ts app/dashboard/page.tsx next.config.ts

# Step 2: Delete troubleshooting files
rm CLUB_*.md FIXES_SUMMARY.md INVESTIGATION_SUMMARY.md MIGRATION_*.md QUICK_*.md REJOIN_*.md
rm components/admin-flags-client.tsx components/admin-logs-client.tsx

# Step 3: Apply database rollback
# Run supabase/migrations/021_complete_rollback_to_008.sql in Supabase Dashboard

# Step 4: Delete bad migrations
rm supabase/migrations/009_*.sql supabase/migrations/010_*.sql supabase/migrations/011_*.sql supabase/migrations/012_*.sql supabase/migrations/013_*.sql supabase/migrations/014_*.sql supabase/migrations/015_*.sql supabase/migrations/016_*.sql supabase/migrations/017_*.sql supabase/migrations/018_*.sql supabase/migrations/019_*.sql supabase/migrations/020_*.sql

# Step 5: Verify
git status
ls supabase/migrations/
```

---

**Rollback Date:** 2025-11-18
**Last Good Commit:** 358a49c (2025-11-18 11:58 AM)
**Last Good Migration:** 008_add_club_members_status.sql
