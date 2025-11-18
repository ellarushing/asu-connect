# ASU Connect Database Recovery Guide

## Overview

This guide helps you recover from database issues in the ASU Connect project. Whether you're dealing with constraint errors, missing tables, or complete database corruption, this guide provides step-by-step solutions.

**Current Situation**: You mentioned "lots of database issues" - this guide will help you assess the damage and choose the right recovery path.

---

## Table of Contents

1. [Assessment: Check Your Database State](#1-assessment-check-your-database-state)
2. [Decision Tree: Which Option to Use](#2-decision-tree-which-option-to-use)
3. [Option A: Quick Fix (Constraint Error Only)](#3-option-a-quick-fix-constraint-error-only)
4. [Option B: Partial Rebuild (Some Tables Wrong)](#4-option-b-partial-rebuild-some-tables-wrong)
5. [Option C: Full Rebuild (Nuclear Option - RECOMMENDED)](#5-option-c-full-rebuild-nuclear-option)
6. [Data Backup Instructions](#6-data-backup-instructions)
7. [Verification Checklist](#7-verification-checklist)
8. [Troubleshooting](#8-troubleshooting)
9. [Prevention Tips](#9-prevention-tips)

---

## 1. Assessment: Check Your Database State

Before making any changes, let's understand what's wrong.

### Step 1.1: Run the Comprehensive Diagnostic

Copy and run this SQL query in Supabase SQL Editor:

```sql
-- File: COMPREHENSIVE_DIAGNOSTIC.sql (located in project root)
-- This checks: tables, constraints, functions, columns, RLS policies
```

**Where to find it**: `/Users/ellarushing/Downloads/asu-connect/COMPREHENSIVE_DIAGNOSTIC.sql`

**What to run**:
1. Open Supabase Dashboard → SQL Editor
2. Copy the entire contents of `COMPREHENSIVE_DIAGNOSTIC.sql`
3. Click "Run"
4. Review the output

### Step 1.2: Interpret the Results

Look for these indicators:

#### GREEN FLAGS (Minor Issues)
- ✅ All tables exist (profiles, clubs, events, club_members, event_registrations, club_flags, event_flags, moderation_logs)
- ✅ Functions exist (is_admin, log_moderation_action)
- ❌ One constraint has wrong name (e.g., "event_flags_event_id_user_id_key" instead of "event_flags_unique_user_event")

**→ Go to Option A**

#### YELLOW FLAGS (Moderate Issues)
- ✅ Most tables exist
- ❌ Some tables missing columns (e.g., events missing category/is_free, profiles missing is_admin)
- ❌ Some constraints wrong
- ❌ Some functions missing

**→ Go to Option B**

#### RED FLAGS (Severe Issues)
- ❌ Multiple tables missing
- ❌ Many missing columns
- ❌ Multiple functions missing
- ❌ RLS policies not working
- ❌ Can't create clubs/events in the app
- ❌ Getting multiple different errors

**→ Go to Option C (RECOMMENDED FOR YOUR CASE)**

---

## 2. Decision Tree: Which Option to Use

```
START: Do you have database issues?
│
├─ Can you create clubs/events? → YES
│  │
│  └─ Just getting one specific error? → YES
│     │
│     └─ Error about "constraint does not exist"? → YES
│        └─ → Use Option A (Quick Fix)
│
├─ Can you create clubs/events? → NO
│  │
│  └─ Diagnostic shows missing columns/functions? → YES
│     │
│     └─ Most tables exist, just some features broken? → YES
│        └─ → Use Option B (Partial Rebuild)
│
└─ Multiple errors, can't figure out what's wrong? → YES
   │
   └─ Want a clean slate that definitely works? → YES
      └─ → Use Option C (Full Rebuild) ⭐ RECOMMENDED
```

**When in doubt, use Option C.** It's the safest approach and takes about 5-10 minutes.

---

## 3. Option A: Quick Fix (Constraint Error Only)

**Use this when**: You're getting error "constraint event_flags_unique_user_event does not exist" but everything else works.

### When to Use Option A
- ✅ Basic app functionality works (can view clubs/events)
- ✅ Only ONE specific error about constraints
- ✅ Diagnostic shows "event_flags table EXISTS" but constraint name is wrong
- ❌ Don't use if multiple things are broken

### Steps

#### Step A.1: Run the Fix Script

```bash
# File location
/Users/ellarushing/Downloads/asu-connect/FIX_EVENT_FLAGS_CONSTRAINT.sql
```

**Instructions**:
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `FIX_EVENT_FLAGS_CONSTRAINT.sql`
3. Click "Run"
4. Look for message: "YOUR ERROR SHOULD NOW BE FIXED!"

#### Step A.2: What This Script Does

```sql
-- 1. Checks current constraint names
-- 2. Drops incorrectly named constraint (e.g., "event_flags_event_id_user_id_key")
-- 3. Creates correctly named constraint: "event_flags_unique_user_event"
-- 4. Adds comment to constraint
-- 5. Verifies the fix
```

#### Step A.3: Verify the Fix

Run this query:

```sql
-- Check if constraint now has correct name
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'event_flags'::regclass
  AND conname = 'event_flags_unique_user_event';
```

**Expected output**: One row showing the constraint exists.

#### Step A.4: Test in Your App

1. Try to flag an event (if you have the UI for it)
2. Or run this test query:

```sql
-- Test insert (should work)
INSERT INTO event_flags (event_id, user_id, reason)
VALUES (
  (SELECT id FROM events LIMIT 1),
  auth.uid(),
  'Test flag'
);

-- Clean up test
DELETE FROM event_flags WHERE reason = 'Test flag';
```

#### When Option A Fails

If you still get errors after running the fix:
- → Move to Option B or C
- The issue is likely more widespread than just one constraint

---

## 4. Option B: Partial Rebuild (Some Tables Wrong)

**Use this when**: Some features work, but specific tables are missing columns or constraints.

### When to Use Option B
- ✅ Some tables exist and work correctly
- ✅ You can identify specific tables that are problematic
- ✅ You're comfortable with SQL and want to preserve as much data as possible
- ❌ Don't use if you want a guaranteed clean state

### Before You Start

**IMPORTANT**: Back up your data first! See [Section 6: Data Backup](#6-data-backup-instructions).

### Steps

#### Step B.1: Identify Problematic Tables

Based on your diagnostic output, identify which tables need fixing. Common issues:

| Table | Common Issues | Migration to Rerun |
|-------|--------------|-------------------|
| `profiles` | Missing `is_admin` column | 004_admin_moderation_system.sql |
| `clubs` | Missing `approval_status` columns | 004_admin_moderation_system.sql |
| `events` | Missing `category`, `is_free`, `price` | 003_add_event_categories_pricing.sql |
| `club_flags` | Entire table missing | 004_admin_moderation_system.sql |
| `event_flags` | Wrong constraint name or missing | 005_add_event_flags_table.sql |
| `moderation_logs` | Entire table missing | 004_admin_moderation_system.sql |

#### Step B.2: Drop Problematic Tables/Columns

**Example: Fixing event_flags table**

```sql
BEGIN;

-- Drop the problematic table
DROP TABLE IF EXISTS event_flags CASCADE;

COMMIT;
```

**Example: Fixing events table (just missing columns)**

```sql
BEGIN;

-- Check if columns exist before dropping
ALTER TABLE events DROP COLUMN IF EXISTS category;
ALTER TABLE events DROP COLUMN IF EXISTS is_free;
ALTER TABLE events DROP COLUMN IF EXISTS price;

-- Drop any related constraints/indexes
DROP INDEX IF EXISTS idx_events_category;
DROP INDEX IF EXISTS idx_events_is_free;

COMMIT;
```

#### Step B.3: Rerun Specific Migrations

After dropping problematic parts, rerun the relevant migration:

**For event_flags issues:**
```bash
# Run this file in Supabase SQL Editor
/Users/ellarushing/Downloads/asu-connect/supabase/migrations/005_add_event_flags_table.sql
```

**For events category/pricing issues:**
```bash
# Run this file in Supabase SQL Editor
/Users/ellarushing/Downloads/asu-connect/supabase/migrations/003_add_event_categories_pricing.sql
```

**For admin/moderation issues:**
```bash
# Run this file in Supabase SQL Editor
/Users/ellarushing/Downloads/asu-connect/supabase/migrations/004_admin_moderation_system.sql
```

#### Step B.4: Verify Each Fixed Table

After rerunning each migration, verify:

```sql
-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'event_flags'  -- Replace with your table name
ORDER BY ordinal_position;

-- Check constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'event_flags'::regclass;  -- Replace with your table name

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'event_flags';  -- Replace with your table name
```

#### Step B.5: Restore Data (if applicable)

If you backed up data from these tables, restore it now. See [Section 6.3](#63-restoring-backed-up-data).

### Risks of Option B

- ⚠️ May miss interdependencies between tables
- ⚠️ Policies/triggers might reference dropped tables
- ⚠️ More complex, more room for error
- ⚠️ May need multiple iterations

**If Option B becomes too complex → Switch to Option C**

---

## 5. Option C: Full Rebuild (Nuclear Option)

**⭐ RECOMMENDED FOR YOUR SITUATION** - This is the cleanest, most reliable approach.

### When to Use Option C
- ✅ You're experiencing "lots of database issues" (your words!)
- ✅ You want a guaranteed clean working state
- ✅ You're okay losing test data
- ✅ You want to start fresh with correct schema
- ✅ Other options failed or seemed too complex

### Why Option C is Best for You

Given that you mentioned "lots of database issues":
- ✅ Takes 5-10 minutes total
- ✅ Guaranteed to work correctly
- ✅ Follows the exact migration sequence
- ✅ No risk of missing dependencies
- ✅ Clean slate, no hidden problems
- ❌ Will lose existing data (but you can back it up first)

### Full Rebuild Process

#### Step C.1: Back Up Your Data (CRITICAL!)

Even if it's just test data, back it up just in case. See [Section 6: Data Backup](#6-data-backup-instructions).

**Quick backup command** (run in Supabase SQL Editor):

```sql
-- Export all data to JSON (you can copy results)
SELECT json_build_object(
  'profiles', (SELECT json_agg(row_to_json(profiles.*)) FROM profiles),
  'clubs', (SELECT json_agg(row_to_json(clubs.*)) FROM clubs),
  'events', (SELECT json_agg(row_to_json(events.*)) FROM events),
  'club_members', (SELECT json_agg(row_to_json(club_members.*)) FROM club_members),
  'event_registrations', (SELECT json_agg(row_to_json(event_registrations.*)) FROM event_registrations)
) as backup_data;
```

Copy the result and save to a file: `database_backup_2025-11-17.json`

#### Step C.2: Create the Cleanup Script

Create a new file in Supabase SQL Editor with this content:

```sql
-- =====================================================================
-- COMPLETE DATABASE CLEANUP FOR ASU CONNECT
-- =====================================================================
-- WARNING: This will DROP ALL tables, functions, policies, and triggers
-- Only run this if you want to completely reset your database
-- Make sure you backed up your data first!
-- =====================================================================

BEGIN;

-- Drop all tables in dependency order
DROP TABLE IF EXISTS moderation_logs CASCADE;
DROP TABLE IF EXISTS event_flags CASCADE;
DROP TABLE IF EXISTS club_flags CASCADE;
DROP TABLE IF EXISTS event_registrations CASCADE;
DROP TABLE IF EXISTS club_members CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS clubs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop all custom functions
DROP FUNCTION IF EXISTS is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS log_moderation_action(UUID, TEXT, TEXT, UUID, JSONB) CASCADE;
DROP FUNCTION IF EXISTS update_club_flags_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_event_flags_updated_at() CASCADE;
DROP FUNCTION IF EXISTS log_club_approval_change() CASCADE;
DROP FUNCTION IF EXISTS log_club_flag_resolution() CASCADE;
DROP FUNCTION IF EXISTS log_event_flag_resolution() CASCADE;

COMMIT;

-- Verify cleanup
SELECT 'Cleanup complete!' as status;

-- Check remaining tables (should be empty or system tables only)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Save this as**: You can copy-paste directly into SQL Editor, or save to a file first.

**Run the cleanup**:
1. Open Supabase Dashboard → SQL Editor
2. Paste the cleanup script
3. Click "Run"
4. Verify you see "Cleanup complete!"

#### Step C.3: Run All Migrations in Order

Now rebuild the database correctly by running each migration file in sequence:

**Migration 1: Initial Schema**
```bash
File: /Users/ellarushing/Downloads/asu-connect/supabase/migrations/001_initial_schema.sql
```
- Creates: clubs, events, club_members, event_registrations tables
- Creates: Basic RLS policies
- Creates: Indexes for performance

**Migration 2: Fix RLS Infinite Recursion**
```bash
File: /Users/ellarushing/Downloads/asu-connect/supabase/migrations/002_fix_rls_infinite_recursion.sql
```
- Fixes: RLS policy infinite loop issues (if this migration exists)

**Migration 3: Event Categories & Pricing**
```bash
File: /Users/ellarushing/Downloads/asu-connect/supabase/migrations/003_add_event_categories_pricing.sql
```
- Adds to events: category, is_free, price columns
- Creates: Indexes for category and pricing filtering
- Adds: Price validation constraint

**Migration 4: Admin Moderation System**
```bash
File: /Users/ellarushing/Downloads/asu-connect/supabase/migrations/004_admin_moderation_system.sql
```
- Adds to profiles: is_admin column
- Creates: club_flags table
- Creates: moderation_logs table
- Adds to clubs: approval_status, approved_by, approved_at, rejection_reason
- Creates: is_admin() function
- Creates: log_moderation_action() function
- Creates: RLS policies for moderation
- Creates: Triggers for logging

**Migration 5: Event Flags Table**
```bash
File: /Users/ellarushing/Downloads/asu-connect/supabase/migrations/005_add_event_flags_table.sql
```
- Creates: event_flags table with CORRECT constraint name
- Creates: Indexes for performance
- Creates: RLS policies for event flags
- Creates: Triggers for updates and logging

**HOW TO RUN MIGRATIONS:**

For each migration file:
1. Open Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy entire contents of migration file
4. Click "Run"
5. Wait for "Success" message
6. Move to next migration

**DO NOT SKIP MIGRATIONS!** Run them in order: 001 → 002 → 003 → 004 → 005

#### Step C.4: Create Initial Profiles

After migrations complete, you need to create profiles for your auth users:

```sql
-- Create profiles for existing auth users
INSERT INTO profiles (id, email, full_name, is_admin)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email) as full_name,
  false as is_admin
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Make yourself an admin (replace with your email)
UPDATE profiles
SET is_admin = true
WHERE email = 'your-email@asu.edu';  -- ← CHANGE THIS!

-- Verify
SELECT id, email, full_name, is_admin
FROM profiles
ORDER BY created_at;
```

#### Step C.5: Restore Your Data (Optional)

If you backed up data and want to restore it:

**⚠️ WARNING**: Only restore if the schema matches! Since you're rebuilding with new columns (category, is_free, price, approval_status, etc.), you may need to adjust your restore queries.

See [Section 6.3: Restoring Data](#63-restoring-backed-up-data) for details.

#### Step C.6: Verify Everything Works

Jump to [Section 7: Verification Checklist](#7-verification-checklist).

### Expected Time for Option C

- ⏱️ Step C.1 (Backup): 2 minutes
- ⏱️ Step C.2 (Cleanup): 1 minute
- ⏱️ Step C.3 (Migrations): 5 minutes
- ⏱️ Step C.4 (Profiles): 1 minute
- ⏱️ Step C.5 (Restore): Variable (or skip)
- ⏱️ Step C.6 (Verify): 2 minutes

**Total: ~10 minutes for a completely clean database**

---

## 6. Data Backup Instructions

### 6.1: Quick Backup (All Tables)

Run this in Supabase SQL Editor:

```sql
-- Profiles
SELECT * FROM profiles;
-- Copy results, save as CSV: profiles_backup.csv

-- Clubs
SELECT * FROM clubs;
-- Copy results, save as CSV: clubs_backup.csv

-- Events
SELECT * FROM events;
-- Copy results, save as CSV: events_backup.csv

-- Club Members
SELECT * FROM club_members;
-- Copy results, save as CSV: club_members_backup.csv

-- Event Registrations
SELECT * FROM event_registrations;
-- Copy results, save as CSV: event_registrations_backup.csv
```

### 6.2: Advanced Backup (SQL INSERT Statements)

For easier restore, generate INSERT statements:

```sql
-- Backup profiles with INSERT statements
SELECT format(
  'INSERT INTO profiles (id, email, full_name, is_admin, created_at) VALUES (%L, %L, %L, %L, %L);',
  id, email, full_name, is_admin, created_at
)
FROM profiles;
-- Copy all results, save to: restore_profiles.sql

-- Backup clubs with INSERT statements
SELECT format(
  'INSERT INTO clubs (id, name, description, created_by, approval_status, created_at) VALUES (%L, %L, %L, %L, %L, %L);',
  id, name, description, created_by, COALESCE(approval_status, 'approved'), created_at
)
FROM clubs;
-- Copy all results, save to: restore_clubs.sql

-- Backup events with INSERT statements
SELECT format(
  'INSERT INTO events (id, title, description, event_date, location, club_id, created_by, category, is_free, price, created_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L);',
  id, title, description, event_date, location, club_id, created_by,
  COALESCE(category, 'Other'),
  COALESCE(is_free, true),
  price,
  created_at
)
FROM events;
-- Copy all results, save to: restore_events.sql

-- Backup club_members
SELECT format(
  'INSERT INTO club_members (id, club_id, user_id, role, joined_at) VALUES (%L, %L, %L, %L, %L);',
  id, club_id, user_id, role, joined_at
)
FROM club_members;
-- Copy all results, save to: restore_club_members.sql

-- Backup event_registrations
SELECT format(
  'INSERT INTO event_registrations (id, event_id, user_id, registered_at) VALUES (%L, %L, %L, %L);',
  id, event_id, user_id, registered_at
)
FROM event_registrations;
-- Copy all results, save to: restore_event_registrations.sql
```

### 6.3: Restoring Backed-Up Data

After rebuilding database, restore in dependency order:

```sql
-- 1. Restore profiles (run restore_profiles.sql)
-- 2. Restore clubs (run restore_clubs.sql)
-- 3. Restore club_members (run restore_club_members.sql)
-- 4. Restore events (run restore_events.sql)
-- 5. Restore event_registrations (run restore_event_registrations.sql)
```

**Note**: You may need to adjust INSERT statements if schema changed (new required columns, etc.)

### 6.4: Quick Check - What Data Do You Have?

```sql
-- Count rows in each table
SELECT
  'profiles' as table_name,
  COUNT(*) as row_count
FROM profiles
UNION ALL
SELECT 'clubs', COUNT(*) FROM clubs
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'club_members', COUNT(*) FROM club_members
UNION ALL
SELECT 'event_registrations', COUNT(*) FROM event_registrations
UNION ALL
SELECT 'club_flags', COUNT(*) FROM club_flags
UNION ALL
SELECT 'event_flags', COUNT(*) FROM event_flags
UNION ALL
SELECT 'moderation_logs', COUNT(*) FROM moderation_logs;
```

If all counts are 0 or small, you may not need to back up (just test data).

---

## 7. Verification Checklist

After any recovery option, run these checks to ensure everything works.

### 7.1: Verify All Tables Exist

```sql
-- Expected tables (should show all 8)
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'profiles', 'clubs', 'events', 'club_members',
    'event_registrations', 'club_flags', 'event_flags', 'moderation_logs'
  )
ORDER BY table_name;
```

**Expected output**: 8 rows (all table names listed above)

### 7.2: Verify All Critical Columns

```sql
-- Check profiles has is_admin
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'is_admin';
-- Expected: 1 row

-- Check clubs has approval_status
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'clubs' AND column_name = 'approval_status';
-- Expected: 1 row

-- Check events has category, is_free, price
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN ('category', 'is_free', 'price')
ORDER BY column_name;
-- Expected: 3 rows
```

### 7.3: Verify All Functions Exist

```sql
-- Check critical functions
SELECT proname as function_name, pronargs as arg_count
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'is_admin',
    'log_moderation_action',
    'update_event_flags_updated_at',
    'log_event_flag_resolution'
  )
ORDER BY proname;
```

**Expected output**: 4 rows

### 7.4: Verify Constraints Are Correct

```sql
-- Check the notorious event_flags constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'event_flags'::regclass
  AND conname = 'event_flags_unique_user_event';
```

**Expected output**: 1 row with constraint name "event_flags_unique_user_event"

### 7.5: Verify RLS is Enabled

```sql
-- Check RLS is enabled on all tables
SELECT
  tablename,
  CASE
    WHEN rowsecurity THEN 'ENABLED ✅'
    ELSE 'DISABLED ❌'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'clubs', 'events', 'club_members',
    'event_registrations', 'club_flags', 'event_flags', 'moderation_logs'
  )
ORDER BY tablename;
```

**Expected output**: All tables should show "ENABLED ✅"

### 7.6: Verify RLS Policies Exist

```sql
-- Count policies per table
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

**Expected output** (approximate):
- clubs: ~4-5 policies
- club_flags: ~5-6 policies
- club_members: ~5-6 policies
- event_flags: ~7 policies
- event_registrations: ~3 policies
- events: ~4-5 policies
- moderation_logs: ~2 policies
- profiles: ~3-4 policies

### 7.7: Test Basic Functionality

**Test 1: Can create a club?**

```sql
-- Try to create a test club
INSERT INTO clubs (name, description, created_by, approval_status)
VALUES (
  'Test Club - DELETE ME',
  'This is a test club for verification',
  auth.uid(),
  'pending'
);

-- Verify it was created
SELECT id, name, approval_status
FROM clubs
WHERE name = 'Test Club - DELETE ME';

-- Clean up
DELETE FROM clubs WHERE name = 'Test Club - DELETE ME';
```

**Test 2: Can create an event?**

```sql
-- First, create or use an existing club
-- Then try to create a test event
INSERT INTO events (
  title, description, event_date, location, club_id, created_by,
  category, is_free, price
)
VALUES (
  'Test Event - DELETE ME',
  'Test event description',
  NOW() + INTERVAL '7 days',
  'Test Location',
  (SELECT id FROM clubs WHERE created_by = auth.uid() LIMIT 1),
  auth.uid(),
  'Other',
  true,
  NULL
);

-- Verify it was created
SELECT id, title, category, is_free
FROM events
WHERE title = 'Test Event - DELETE ME';

-- Clean up
DELETE FROM events WHERE title = 'Test Event - DELETE ME';
```

**Test 3: Can flag an event?**

```sql
-- Create a test flag
INSERT INTO event_flags (event_id, user_id, reason, details)
VALUES (
  (SELECT id FROM events LIMIT 1),
  auth.uid(),
  'Test flag - DELETE ME',
  'This is a test flag for verification'
);

-- Verify it was created
SELECT id, reason, status
FROM event_flags
WHERE reason = 'Test flag - DELETE ME';

-- Clean up
DELETE FROM event_flags WHERE reason = 'Test flag - DELETE ME';
```

### 7.8: Test App End-to-End

1. **Start your dev server**: `npm run dev`
2. **Log in** with your account
3. **Try to view clubs** - Should see existing clubs or empty state
4. **Try to create a club** - Should succeed (will be pending approval)
5. **Try to view events** - Should see existing events or empty state
6. **Try to create an event** - Should succeed if you're a club admin
7. **Check for errors in browser console** - Should be clean
8. **Check for errors in terminal** - Should be clean

### 7.9: Final Sanity Check

```sql
-- This query should return with no errors
SELECT
  'profiles' as check_type,
  COUNT(*) as count,
  'OK' as status
FROM profiles
UNION ALL
SELECT 'clubs', COUNT(*), 'OK' FROM clubs
UNION ALL
SELECT 'events', COUNT(*), 'OK' FROM events
UNION ALL
SELECT 'is_admin function', 1, 'OK'
WHERE EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin')
UNION ALL
SELECT 'event_flags table', 1, 'OK'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_flags')
UNION ALL
SELECT 'event_flags constraint', 1, 'OK'
WHERE EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conrelid = 'event_flags'::regclass
  AND conname = 'event_flags_unique_user_event'
);
```

**Expected**: All rows should show "OK" status

---

## 8. Troubleshooting

### Common Errors and Solutions

#### Error: "relation does not exist"

**Symptom**: `ERROR: relation "public.profiles" does not exist`

**Cause**: Table was never created or was dropped

**Solution**:
1. Run `COMPREHENSIVE_DIAGNOSTIC.sql` to see which tables are missing
2. If many tables missing → Use Option C (Full Rebuild)
3. If just one table → Use Option B (drop and rerun specific migration)

---

#### Error: "column does not exist"

**Symptom**: `ERROR: column "is_admin" does not exist`

**Cause**: Migration that adds that column was never run or failed

**Solution**:
```sql
-- Check which migration adds the column
-- For is_admin → migration 004
-- For category/is_free/price → migration 003
-- For approval_status → migration 004

-- Option 1: Add just the missing column
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Option 2: Rerun the entire migration
-- Run migration 004_admin_moderation_system.sql
```

---

#### Error: "constraint already exists"

**Symptom**: `ERROR: constraint "event_flags_unique_user_event" already exists`

**Cause**: Trying to run migration that's already been applied

**Solution**:
```sql
-- Check if constraint exists
SELECT conname FROM pg_constraint
WHERE conrelid = 'event_flags'::regclass;

-- If it exists with correct name, you're good - skip that part of migration
-- If it exists with wrong name, use FIX_EVENT_FLAGS_CONSTRAINT.sql
```

---

#### Error: "function does not exist"

**Symptom**: `ERROR: function is_admin(uuid) does not exist`

**Cause**: Migration 004 wasn't run or function was dropped

**Solution**:
```sql
-- Rerun migration 004 or just create the function:
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
```

---

#### Error: "permission denied for table"

**Symptom**: `ERROR: permission denied for table event_flags`

**Cause**: RLS policies not set up correctly or grants missing

**Solution**:
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'event_flags';

-- If not enabled:
ALTER TABLE event_flags ENABLE ROW LEVEL SECURITY;

-- Add grants:
GRANT SELECT, INSERT, UPDATE, DELETE ON event_flags TO authenticated;

-- If still failing, rerun migration 005 completely
```

---

#### Error: "infinite recursion detected in policy"

**Symptom**: `ERROR: infinite recursion detected in policy for relation "clubs"`

**Cause**: RLS policy references itself in a loop

**Solution**:
- This should be fixed by migration 002
- If still happening, check if migration 002 was run:
```sql
-- Look for migration 002 file
-- Run: supabase/migrations/002_fix_rls_infinite_recursion.sql
```

---

#### Error: Migration runs but app still broken

**Symptom**: Migration succeeds but features don't work in the app

**Cause**: Frontend TypeScript types out of sync with database

**Solution**:
```bash
# Regenerate TypeScript types from database
npx supabase gen types typescript --local > lib/types/database.ts

# Or if using remote database:
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/types/database.ts

# Restart your dev server
npm run dev
```

---

#### Error: Can't flag events

**Symptom**: Click flag button, nothing happens or error

**Cause**: Event flags table or RLS policies missing

**Solution**:
1. Run `COMPREHENSIVE_DIAGNOSTIC.sql`
2. Check if `event_flags` table exists
3. If not, run migration 005
4. Check if RLS policies exist:
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'event_flags';
-- Should return 7 policies
```

---

### What If Everything Fails?

If you've tried everything and still have issues:

1. **Take a screenshot** of your error
2. **Run the diagnostic**:
```sql
-- Run COMPREHENSIVE_DIAGNOSTIC.sql
-- Copy ALL output
```
3. **Check migration history** (if using Supabase CLI):
```bash
supabase db history
```
4. **Nuclear option** - Use Option C (Full Rebuild)

**Still stuck?** You might need to:
- Check Supabase dashboard for service issues
- Verify your environment variables are correct
- Check if you're connecting to the right database

---

## 9. Prevention Tips

### How to Avoid This in the Future

#### 9.1: Use Migrations Properly

**DO:**
- ✅ Always run migrations in order: 001 → 002 → 003 → 004 → 005
- ✅ Use migration files from `supabase/migrations/` folder
- ✅ Test migrations on local database first
- ✅ Commit migrations to git
- ✅ Document what each migration does

**DON'T:**
- ❌ Don't manually create tables in SQL editor (use migrations)
- ❌ Don't skip migrations or run out of order
- ❌ Don't edit migrations after they've been run
- ❌ Don't run random SQL from the internet without understanding it

#### 9.2: Migration Best Practices

**When to create a new migration:**
- Adding a new table
- Adding new columns to existing table
- Changing constraints
- Adding indexes
- Creating functions or triggers
- Updating RLS policies

**When to use standalone SQL files:**
- One-time fixes (like `FIX_EVENT_FLAGS_CONSTRAINT.sql`)
- Diagnostic queries (like `COMPREHENSIVE_DIAGNOSTIC.sql`)
- Data migrations (moving data between columns)
- Emergency repairs

**Naming convention:**
```
###_descriptive_name.sql

Examples:
001_initial_schema.sql
002_fix_rls_infinite_recursion.sql
003_add_event_categories_pricing.sql
004_admin_moderation_system.sql
005_add_event_flags_table.sql
```

#### 9.3: Before Running Any SQL

**Checklist:**
1. ✅ Do I understand what this SQL does?
2. ✅ Have I backed up my data? (if dropping/modifying tables)
3. ✅ Am I running this on the correct database? (local vs production)
4. ✅ Is this SQL idempotent? (safe to run multiple times)
5. ✅ Have I tested this locally first?

#### 9.4: Using Supabase CLI for Migrations

If you're not using it yet, consider setting up Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Link your project
supabase link --project-ref YOUR_PROJECT_ID

# Create new migration
supabase migration new add_feature_name

# Apply migrations
supabase db push

# Check migration status
supabase migration list
```

Benefits:
- ✅ Tracks which migrations have been run
- ✅ Prevents running same migration twice
- ✅ Easier to manage multiple environments
- ✅ Version control for database schema

#### 9.5: Regular Backups

Set up automatic backups:

**Option 1: Supabase built-in backups**
- Pro plan and above: Daily automatic backups
- Check Settings → Database → Backups

**Option 2: Manual backup script**
```bash
# Create a backup script
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y-%m-%d)
OUTPUT_FILE="backups/backup-$DATE.sql"

# Export schema
supabase db dump > "$OUTPUT_FILE"

echo "Backup saved to $OUTPUT_FILE"
```

Run weekly: `chmod +x backup-db.sh && ./backup-db.sh`

#### 9.6: Testing Before Production

**Always test schema changes locally first:**

```bash
# 1. Start local Supabase
supabase start

# 2. Apply migration locally
supabase migration up

# 3. Test in your app (connected to local DB)
npm run dev

# 4. If works, apply to production
supabase db push --remote
```

#### 9.7: Documentation

Keep a file like `DATABASE_CHANGELOG.md`:

```markdown
# Database Changelog

## 2025-11-17
- Added event_flags table (migration 005)
- Fixed constraint naming issue
- Added RLS policies for event flagging

## 2025-11-15
- Added admin moderation system (migration 004)
- Added club approval workflow
- Created is_admin() function

## 2025-11-10
- Added event categories and pricing (migration 003)
- Added category enum: Academic, Social, Sports, Arts, etc.
```

This helps you remember what changed and when.

#### 9.8: Code Review for Schema Changes

Before running migrations on production:
1. Review the migration file
2. Check for:
   - `DROP TABLE` statements (data loss!)
   - `CASCADE` keywords (can drop related data)
   - Missing `IF NOT EXISTS` (might fail if run twice)
   - Correct constraint names
   - Proper RLS policies

---

## Quick Reference

### File Locations

```
/Users/ellarushing/Downloads/asu-connect/
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_fix_rls_infinite_recursion.sql
│       ├── 003_add_event_categories_pricing.sql
│       ├── 004_admin_moderation_system.sql
│       └── 005_add_event_flags_table.sql
├── COMPREHENSIVE_DIAGNOSTIC.sql         ← Run this first!
├── FIX_EVENT_FLAGS_CONSTRAINT.sql       ← Quick fix for constraint error
└── DATABASE_RECOVERY_GUIDE.md           ← This file
```

### Quick Commands

```sql
-- Check what tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Check what functions exist
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace;

-- Check constraint on event_flags
SELECT conname FROM pg_constraint WHERE conrelid = 'event_flags'::regclass;

-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Count your data
SELECT 'clubs' as table_name, COUNT(*) FROM clubs
UNION ALL SELECT 'events', COUNT(*) FROM events;
```

### Decision Tree (Simple)

```
Having database issues?
│
├─ One small error? → Try Option A (Quick Fix)
├─ Multiple errors but some things work? → Try Option B (Partial Rebuild)
└─ "Lots of issues" / Want clean slate? → Use Option C (Full Rebuild) ⭐
```

### Time Estimates

- **Option A**: 5 minutes
- **Option B**: 15-30 minutes (depends on complexity)
- **Option C**: 10 minutes (recommended!)

---

## Summary

You mentioned you're having "lots of database issues" - here's my recommendation:

### Recommended Path for You: Option C (Full Rebuild)

**Why:**
- ✅ Fastest path to a working database (10 minutes)
- ✅ Guaranteed correct schema
- ✅ No more mysterious errors
- ✅ Clean slate
- ✅ All migrations run in correct order

**Steps:**
1. Run `COMPREHENSIVE_DIAGNOSTIC.sql` (so you know what you had)
2. Back up any data you care about (even if just test data)
3. Run cleanup script (drops everything)
4. Run all 5 migrations in order
5. Create profiles for auth users
6. Verify everything works
7. Start fresh with a working database!

**When to do it:**
- Right now! The longer you wait, the more confusing it gets.

**What you'll lose:**
- Test data (but you can back it up)
- Broken schema (good riddance!)

**What you'll gain:**
- Working database
- Peace of mind
- Ability to actually build features
- Proper foundation for your app

---

Good luck with your recovery! If you choose Option C (recommended), it should take about 10 minutes and you'll have a completely clean, working database.

Remember: When in doubt, **Option C** is your friend. It's better to spend 10 minutes doing it right than hours troubleshooting a partially broken database.
