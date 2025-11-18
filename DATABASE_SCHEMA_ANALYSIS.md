# ASU Connect Database Schema Analysis Report

**Date:** 2025-11-17
**Error Context:** `ERROR: 42704: constraint "event_flags_unique_user_event" for table "event_flags" does not exist`

---

## Executive Summary

The database has **critical inconsistencies** across multiple schema definition files. The `event_flags` table has been defined in **5 different files with conflicting constraint names**, leading to the reported error. Additionally, there are conflicts in table definitions, RLS policies, and migration dependencies.

**Root Cause of Current Error:**
- **Migration 005** creates the constraint as `event_flags_unique_user_event` (named constraint)
- **APPLY_THIS_TO_SUPABASE.sql** and **CRITICAL_SCHEMA_FIXES.sql** create it as `UNIQUE(event_id, user_id)` (unnamed constraint)
- When an unnamed constraint is created, PostgreSQL auto-generates a name like `event_flags_event_id_user_id_key`
- The migration 005 tries to add a comment to `event_flags_unique_user_event` which doesn't exist if the unnamed version was created first

---

## Critical Issues Found

### Issue 1: event_flags Table - CONSTRAINT NAME MISMATCH (PRIMARY ISSUE)

**The Problem:**
The `event_flags` table is created in multiple files with **different constraint naming patterns**.

**Files with NAMED constraint (event_flags_unique_user_event):**
1. `/Users/ellarushing/downloads/asu-connect/supabase/migrations/005_add_event_flags_table.sql`
   - Line 38-39: `CONSTRAINT event_flags_unique_user_event UNIQUE (event_id, user_id)`
   - Line 55: `COMMENT ON CONSTRAINT event_flags_unique_user_event...`

2. `/Users/ellarushing/downloads/asu-connect/supabase/standalone_event_flags_setup.sql`
   - Line 46-47: `CONSTRAINT event_flags_unique_user_event UNIQUE (event_id, user_id)`

**Files with UNNAMED constraint:**
3. `/Users/ellarushing/downloads/asu-connect/APPLY_THIS_TO_SUPABASE.sql`
   - Line 336: `UNIQUE(event_id, user_id)` (no constraint name specified)

4. `/Users/ellarushing/downloads/asu-connect/CRITICAL_SCHEMA_FIXES.sql`
   - Line 76: `UNIQUE(event_id, user_id)` (no constraint name specified)

**Impact:**
- If `CRITICAL_SCHEMA_FIXES.sql` or `APPLY_THIS_TO_SUPABASE.sql` was run first, the constraint gets an auto-generated name
- When migration 005 tries to comment on `event_flags_unique_user_event`, it fails because that named constraint doesn't exist
- This causes the exact error reported: `ERROR: 42704: constraint "event_flags_unique_user_event" for table "event_flags" does not exist`

---

### Issue 2: Multiple Schema Definition Files with Overlapping Content

**Problem:** The same tables are being created in different files without proper coordination.

#### event_flags table created in:
1. **005_add_event_flags_table.sql** (Line 23-40) - Migration with full setup
2. **APPLY_THIS_TO_SUPABASE.sql** (Line 325-337) - Standalone full schema
3. **CRITICAL_SCHEMA_FIXES.sql** (Line 65-77) - "Critical fixes"
4. **standalone_event_flags_setup.sql** (Line 31-48) - Standalone setup

#### clubs table modifications:
- **004_admin_moderation_system.sql** adds approval columns (Line 92-96):
  - `approval_status`, `approved_by`, `approved_at`, `rejection_reason`
- **APPLY_THIS_TO_SUPABASE.sql** does NOT have these columns (Line 27-34)
- **001_initial_schema.sql** does NOT have these columns (Line 2-9)

**Impact:** Depending on which file was executed, the database could have different schemas.

---

### Issue 3: profiles Table - Missing from Core Migrations

**Problem:** The `profiles` table is defined in `FIX_PROFILES_TABLE.sql` but NOT in any migration file.

**Location:**
- `/Users/ellarushing/downloads/asu-connect/FIX_PROFILES_TABLE.sql` (Line 18-25)

**Dependencies:**
- **004_admin_moderation_system.sql** adds `is_admin` column to `profiles` (Line 22-23)
- But migration 004 assumes `profiles` table already exists
- If migration 004 runs before `FIX_PROFILES_TABLE.sql`, it will fail

**Missing from:**
- No `001_initial_profiles.sql` migration exists
- Not in `APPLY_THIS_TO_SUPABASE.sql`
- Not in `CRITICAL_SCHEMA_FIXES.sql`

---

### Issue 4: RLS Policy Conflicts and Duplicates

**Problem:** Multiple files drop and recreate the same RLS policies with slightly different logic.

#### clubs Table Policies

**Policy Name:** "Clubs are publicly viewable"
- Defined in: 001_initial_schema.sql (Line 61-64)
- Dropped in: 004_admin_moderation_system.sql (Line 322)
- Recreated as: "clubs_select_approved" in 004 (Line 323-330) with different logic

**Original (001):**
```sql
CREATE POLICY "Clubs are publicly viewable"
  ON public.clubs FOR SELECT USING (true);
```

**Replaced (004):**
```sql
CREATE POLICY clubs_select_approved ON clubs FOR SELECT
USING (
  approval_status = 'approved'
  OR created_by = auth.uid()
  OR is_admin(auth.uid())
);
```

**Impact:** If migrations run out of order, policies could conflict or be missing.

#### club_members Table Policies

**Policy Name:** "Club admins can add members"
- Created in: 001_initial_schema.sql (Line 128-139) - queries club_members table (RECURSIVE)
- Dropped in: 002_fix_rls_infinite_recursion.sql (Line 6)
- Recreated as: "Club creators can add members" in 002 (Line 26-36) - queries clubs table (FIXED)

**Impact:** The initial migration creates a policy with infinite recursion, which is immediately fixed in migration 002. This is by design but could cause issues if 002 doesn't run.

---

### Issue 5: Function Dependencies Not Enforced

**Problem:** Functions are called before they're defined.

**is_admin() function:**
- Defined in: 004_admin_moderation_system.sql (Line 156-167)
- Used in: 005_add_event_flags_table.sql (Line 229) - Policy "event_flags_select_admin"
- Also used in: standalone_event_flags_setup.sql (Line 171, 207)

**log_moderation_action() function:**
- Defined in: 004_admin_moderation_system.sql (Line 172-189)
- Used in: 005_add_event_flags_table.sql (Line 129) - Trigger function
- Also used in: standalone_event_flags_setup.sql (Line 102)

**Impact:** If migration 005 or standalone script runs before migration 004, these function calls will fail.

---

### Issue 6: club_flags vs event_flags Inconsistency

**Problem:** club_flags and event_flags have parallel structures but different constraint names.

**club_flags (in 004):**
- Constraint: `club_flags_unique_user_club` (Line 54 in 004_admin_moderation_system.sql)

**event_flags (in 005):**
- Constraint: `event_flags_unique_user_event` (Line 38 in 005_add_event_flags_table.sql)

**But in APPLY_THIS_TO_SUPABASE.sql and CRITICAL_SCHEMA_FIXES.sql:**
- No named constraint for event_flags (just `UNIQUE(event_id, user_id)`)

**Impact:** Inconsistent naming makes maintenance harder and causes the current error.

---

### Issue 7: Multiple Revised/Fixed Versions of Same File

**Files Found:**
1. `001_initial_schema.sql`
2. `001_initial_schema_REVISED.sql`

**Differences:**
- Same table definitions
- Same RLS policies
- No clear indication which one should be used
- Both could potentially be applied, causing conflicts

**Impact:** Confusion about which file is the "source of truth."

---

## Correct Schema Definition (What SHOULD Exist)

### Core Tables (in order of dependency)

#### 1. profiles table
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,  -- Added by migration 004
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Source:** FIX_PROFILES_TABLE.sql + 004_admin_moderation_system.sql

#### 2. clubs table
```sql
CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Added by migration 004:
  approval_status TEXT DEFAULT 'pending' NOT NULL CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT
);
```
**Sources:** 001_initial_schema.sql + 004_admin_moderation_system.sql

#### 3. events table
```sql
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Added by migration 003:
  category TEXT CHECK (category IN ('Academic', 'Social', 'Sports', 'Arts', 'Career', 'Community Service', 'Other')),
  is_free BOOLEAN DEFAULT true,
  price DECIMAL(10, 2) CHECK (price >= 0)
);
```
**Sources:** 001_initial_schema.sql + 003_add_event_categories_pricing.sql

#### 4. club_members table
```sql
CREATE TABLE public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),  -- Added later
  UNIQUE(club_id, user_id)
);
```
**Sources:** 001_initial_schema.sql + CRITICAL_SCHEMA_FIXES.sql

#### 5. event_registrations table
```sql
CREATE TABLE public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);
```
**Source:** 001_initial_schema.sql

#### 6. club_flags table
```sql
CREATE TABLE public.club_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT club_flags_status_check CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  CONSTRAINT club_flags_unique_user_club UNIQUE (club_id, user_id)
);
```
**Source:** 004_admin_moderation_system.sql (Line 39-56)

#### 7. event_flags table (CORRECT VERSION)
```sql
CREATE TABLE public.event_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT event_flags_status_check CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  CONSTRAINT event_flags_unique_user_event UNIQUE (event_id, user_id)  -- ⚠️ MUST BE NAMED
);
```
**Source:** 005_add_event_flags_table.sql (Line 23-40)

#### 8. moderation_logs table
```sql
CREATE TABLE public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```
**Source:** 004_admin_moderation_system.sql (Line 122-130)

---

## File-by-File Conflict Analysis

### Migration Files (Correct Order)

#### ✅ 001_initial_schema.sql
- **Status:** BASE SCHEMA - Creates core tables
- **Tables:** clubs, events, club_members, event_registrations
- **Issues:**
  - RLS policies have infinite recursion (fixed in 002)
  - Missing newer columns (added in later migrations)

#### ✅ 002_fix_rls_infinite_recursion.sql
- **Status:** REQUIRED FIX - Corrects RLS policies
- **Changes:** Drops and recreates club_members policies to query clubs table instead
- **Issues:** None (correctly depends on 001)

#### ✅ 003_add_event_categories_pricing.sql
- **Status:** FEATURE ADDITION
- **Changes:** Adds category, is_free, price to events table
- **Issues:** None

#### ⚠️ 004_admin_moderation_system.sql
- **Status:** COMPLEX MIGRATION - Adds admin system
- **Tables:** club_flags, moderation_logs
- **Changes:**
  - Adds is_admin to profiles (assumes profiles exists)
  - Adds approval columns to clubs
  - Creates is_admin() and log_moderation_action() functions
- **Issues:**
  - **DEPENDENCY NOT MET:** Requires profiles table which doesn't exist in migrations
  - Line 22: `ALTER TABLE profiles ADD COLUMN...` will fail if profiles doesn't exist

#### ⚠️ 005_add_event_flags_table.sql
- **Status:** FEATURE ADDITION
- **Tables:** event_flags
- **Dependencies:**
  - Requires is_admin() function (from 004)
  - Requires log_moderation_action() function (from 004)
- **Issues:**
  - Line 55: `COMMENT ON CONSTRAINT event_flags_unique_user_event...` fails if table was created with unnamed constraint
  - Line 229: Uses is_admin() function (dependency on 004)
  - Line 129: Calls log_moderation_action() (dependency on 004)

#### ❓ 001_initial_schema_REVISED.sql
- **Status:** DUPLICATE/CONFUSION
- **Content:** Identical to 001_initial_schema.sql
- **Issues:**
  - Not clear if this should replace 001 or is just a backup
  - Could cause confusion about which file to use

### Standalone Schema Files (Should NOT Mix with Migrations)

#### ⚠️ APPLY_THIS_TO_SUPABASE.sql
- **Status:** COMPLETE STANDALONE SCHEMA (should not be used with migrations)
- **Problem:**
  - Creates event_flags with **unnamed constraint** (Line 336)
  - Missing approval columns on clubs table
  - Adds club membership approval with status column (Line 394-398)
- **Conflicts with:**
  - Migration 004 (missing approval columns on clubs)
  - Migration 005 (constraint name mismatch)

#### ⚠️ CRITICAL_SCHEMA_FIXES.sql
- **Status:** EMERGENCY FIXES (should not be used with migrations)
- **Problem:**
  - Creates event_flags with **unnamed constraint** (Line 76)
  - Adds missing columns that should come from migrations
- **Conflicts with:**
  - Migration 005 (constraint name mismatch)

#### ⚠️ FIX_PROFILES_TABLE.sql
- **Status:** MISSING MIGRATION - Should be migration 001 or earlier
- **Problem:**
  - profiles table should be created BEFORE migration 004
  - Currently exists as a standalone fix
- **Should be:** Migration 000_create_profiles.sql or similar

#### ✅ standalone_event_flags_setup.sql
- **Status:** STANDALONE VERSION (for manual setup)
- **Correct usage:** Only if not using migration 005
- **Has correct constraint:** `event_flags_unique_user_event` (Line 46)

---

## Specific Error Analysis: event_flags_unique_user_event

### What Happened

1. **Likely scenario:**
   - Either `CRITICAL_SCHEMA_FIXES.sql` or `APPLY_THIS_TO_SUPABASE.sql` was executed
   - These files create event_flags with: `UNIQUE(event_id, user_id)` (unnamed)
   - PostgreSQL auto-generates constraint name: `event_flags_event_id_user_id_key`

2. **When migration 005 tries to run:**
   - Line 55: `COMMENT ON CONSTRAINT event_flags_unique_user_event ON event_flags IS '...'`
   - PostgreSQL looks for constraint named `event_flags_unique_user_event`
   - Constraint doesn't exist (it's named `event_flags_event_id_user_id_key` instead)
   - **ERROR: 42704: constraint "event_flags_unique_user_event" for table "event_flags" does not exist**

### Why It Matters

PostgreSQL distinguishes between:
- **Named constraints:** `CONSTRAINT name UNIQUE (cols)`
- **Unnamed constraints:** `UNIQUE (cols)` → PostgreSQL generates name

The migration expects a specific constraint name to add a comment, but finds a different name.

---

## Recommendations

### Immediate Fix (Choose ONE approach)

#### Option A: Fix Existing Database (If Already Applied Wrong Schema)

```sql
-- Step 1: Check current constraint name
SELECT conname
FROM pg_constraint
WHERE conrelid = 'event_flags'::regclass
  AND contype = 'u';

-- Step 2: Drop the auto-generated constraint
ALTER TABLE event_flags
DROP CONSTRAINT event_flags_event_id_user_id_key;  -- or whatever name you found

-- Step 3: Add the correctly named constraint
ALTER TABLE event_flags
ADD CONSTRAINT event_flags_unique_user_event UNIQUE (event_id, user_id);

-- Step 4: Add the comment (now it will work)
COMMENT ON CONSTRAINT event_flags_unique_user_event ON event_flags
IS 'Prevents duplicate flags from the same user for the same event';
```

#### Option B: Fix Migration Files (Prevent Future Issues)

**Update APPLY_THIS_TO_SUPABASE.sql** (Line 336):
```sql
-- OLD:
UNIQUE(event_id, user_id)

-- NEW:
CONSTRAINT event_flags_unique_user_event UNIQUE (event_id, user_id)
```

**Update CRITICAL_SCHEMA_FIXES.sql** (Line 76):
```sql
-- OLD:
UNIQUE(event_id, user_id)

-- NEW:
CONSTRAINT event_flags_unique_user_event UNIQUE (event_id, user_id)
```

### Long-Term Fixes

#### 1. Consolidate Schema Management

**Choose ONE approach:**

**Approach A: Use Migrations Only**
- Delete: APPLY_THIS_TO_SUPABASE.sql, CRITICAL_SCHEMA_FIXES.sql
- Create: 000_create_profiles.sql (before migration 004)
- Keep: Migration files 001-005 as source of truth
- Update: All constraint names to be consistent

**Approach B: Use Single Comprehensive Schema File**
- Delete: All migration files
- Keep: Updated APPLY_THIS_TO_SUPABASE.sql with all corrections
- Remove: Migration-based deployment
- Use: Single-file schema deployment

#### 2. Create Missing profiles Migration

**Create: 000_create_profiles.sql**
```sql
-- Should run BEFORE 004_admin_moderation_system.sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies...
-- Trigger function...
```

#### 3. Fix Migration Dependencies

Update migration file headers with dependencies:

```sql
-- Migration: 005_add_event_flags_table.sql
-- Dependencies:
--   - 004_admin_moderation_system.sql (requires is_admin function)
--   - Must run AFTER 004 completes
-- DO NOT run standalone schema files (APPLY_THIS_TO_SUPABASE.sql) before this
```

#### 4. Standardize Constraint Naming

**Convention to adopt:**
```
{table_name}_{columns}_{constraint_type}

Examples:
- event_flags_unique_user_event → event_flags_event_id_user_id_unique
- club_flags_unique_user_club → club_flags_club_id_user_id_unique
```

Or keep current names but **always use named constraints**.

#### 5. Create Schema Verification Script

```sql
-- diagnostic_check.sql (create this file)
-- Verifies all tables, constraints, and functions exist

SELECT 'profiles table' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles')
    THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
UNION ALL
SELECT 'is_admin function',
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin')
    THEN '✓ EXISTS' ELSE '✗ MISSING' END
UNION ALL
SELECT 'event_flags_unique_user_event constraint',
  CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_flags_unique_user_event')
    THEN '✓ EXISTS' ELSE '✗ MISSING' END;
```

---

## Migration Execution Order (Correct Sequence)

If starting fresh:

```
1. 000_create_profiles.sql (CREATE THIS - currently missing)
2. 001_initial_schema.sql
3. 002_fix_rls_infinite_recursion.sql
4. 003_add_event_categories_pricing.sql
5. 004_admin_moderation_system.sql (depends on profiles)
6. 005_add_event_flags_table.sql (depends on is_admin and log_moderation_action)
```

**DO NOT RUN:**
- APPLY_THIS_TO_SUPABASE.sql (conflicts with migrations)
- CRITICAL_SCHEMA_FIXES.sql (conflicts with migrations)
- standalone_event_flags_setup.sql (unless skipping migration 005)
- FIX_PROFILES_TABLE.sql (unless skipping migration 000)

---

## Summary of Action Items

### Critical (Fix Immediately)
1. ✅ **Fix constraint name mismatch** - Choose Option A or B above
2. ✅ **Create 000_create_profiles.sql migration** - Required before 004 runs
3. ✅ **Document which files should be used** - Migrations XOR standalone files

### Important (Fix Soon)
4. ⚠️ **Remove or rename 001_initial_schema_REVISED.sql** - Causes confusion
5. ⚠️ **Add dependency checks to migration files** - Prevent running out of order
6. ⚠️ **Update APPLY_THIS_TO_SUPABASE.sql** - Fix constraint names

### Nice to Have (Maintenance)
7. 📝 **Standardize constraint naming** - Across all tables
8. 📝 **Create verification script** - Check schema health
9. 📝 **Add migration rollback scripts** - For each migration
10. 📝 **Document which approach to use** - Migrations vs single-file

---

## Conclusion

The database schema has evolved organically with multiple attempts to fix issues, resulting in:
- **5 different files** creating event_flags table with **inconsistent constraints**
- **Missing profiles table** in migration sequence
- **Conflicting RLS policies** across files
- **Unclear dependencies** between migrations

The immediate error is caused by constraint name mismatch. The long-term solution requires:
1. Choosing ONE schema management approach (migrations or single-file)
2. Creating missing profiles migration
3. Fixing all constraint names to be consistent
4. Removing conflicting standalone files

**Recommended Path Forward:**
- Use migrations 001-005 as source of truth
- Create 000_create_profiles.sql
- Fix constraint names in all files
- Archive/delete APPLY_THIS_TO_SUPABASE.sql and CRITICAL_SCHEMA_FIXES.sql
- Run diagnostic script to verify database state
