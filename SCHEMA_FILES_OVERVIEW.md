# ASU Connect Schema Files Overview

## File Organization Map

```
asu-connect/
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql              ✅ BASE - Core tables
│       ├── 001_initial_schema_REVISED.sql      ❓ DUPLICATE - Same as 001
│       ├── 002_fix_rls_infinite_recursion.sql  ✅ FIX - Fixes RLS policies
│       ├── 003_add_event_categories_pricing.sql ✅ FEATURE - Adds event filters
│       ├── 004_admin_moderation_system.sql     ⚠️  ADMIN - Requires profiles table
│       ├── 005_add_event_flags_table.sql       ⚠️  FEATURE - Has constraint issue
│       └── standalone_event_flags_setup.sql    ✅ STANDALONE - Alternative to 005
│
├── APPLY_THIS_TO_SUPABASE.sql                  ⚠️  FULL SCHEMA - Conflicts with migrations
├── CRITICAL_SCHEMA_FIXES.sql                   ⚠️  FIXES - Conflicts with migrations
├── FIX_PROFILES_TABLE.sql                      ⚠️  MISSING - Should be migration 000
├── fix-admin-permissions.sql                   ✅ UTILITY - Fixes admin roles
│
└── (New diagnostic/fix files created today)
    ├── DATABASE_SCHEMA_ANALYSIS.md             📊 REPORT - Full analysis
    ├── COMPREHENSIVE_DIAGNOSTIC.sql            🔍 CHECK - Run to diagnose
    ├── FIX_EVENT_FLAGS_CONSTRAINT.sql          🔧 FIX - Run to fix error
    ├── QUICK_FIX_GUIDE.md                      📖 GUIDE - Quick reference
    └── SCHEMA_FILES_OVERVIEW.md                📋 THIS FILE
```

---

## File Categories

### 1. Migration Files (Sequential)
**Location:** `/Users/ellarushing/downloads/asu-connect/supabase/migrations/`

| File | Status | Purpose | Dependencies |
|------|--------|---------|--------------|
| **001_initial_schema.sql** | ✅ Use | Creates: clubs, events, club_members, event_registrations | None |
| **002_fix_rls_infinite_recursion.sql** | ✅ Use | Fixes RLS policies on club_members | Requires 001 |
| **003_add_event_categories_pricing.sql** | ✅ Use | Adds: category, is_free, price to events | Requires 001 |
| **004_admin_moderation_system.sql** | ⚠️ Use (with fix) | Creates: club_flags, moderation_logs, admin system | **Missing: profiles table** |
| **005_add_event_flags_table.sql** | ⚠️ Use (after fix) | Creates: event_flags table | Requires 004 (is_admin function) |

**Order to run:** 001 → 002 → 003 → **[CREATE PROFILES]** → 004 → 005

---

### 2. Standalone Schema Files (All-in-One)
**These conflict with migrations - choose ONE approach:**

| File | Status | Purpose | Issues |
|------|--------|---------|--------|
| **APPLY_THIS_TO_SUPABASE.sql** | ⚠️ Conflicts | Complete schema with all features | Wrong constraint names, missing approval columns |
| **CRITICAL_SCHEMA_FIXES.sql** | ⚠️ Conflicts | Emergency fixes for missing columns | Wrong constraint names |
| **standalone_event_flags_setup.sql** | ✅ Alternative | Just event_flags table | Can use instead of migration 005 |

**⚠️ WARNING:** Do NOT mix standalone files with migration files!

---

### 3. Fix/Utility Files

| File | Status | Purpose | When to Use |
|------|--------|---------|-------------|
| **FIX_PROFILES_TABLE.sql** | ⚠️ Should be migration 000 | Creates profiles table | Before migration 004 |
| **fix-admin-permissions.sql** | ✅ Utility | Ensures club creators are admins | After clubs created |
| **001_initial_schema_REVISED.sql** | ❓ Unknown | Duplicate of 001 | Don't use (confusion) |

---

### 4. Diagnostic/Fix Files (Created Today)

| File | Purpose | How to Use |
|------|---------|------------|
| **QUICK_FIX_GUIDE.md** | Quick reference for fixing the constraint error | Read first ⭐ |
| **FIX_EVENT_FLAGS_CONSTRAINT.sql** | Automated fix for the constraint error | Run in Supabase SQL Editor |
| **COMPREHENSIVE_DIAGNOSTIC.sql** | Check database state and get specific fix | Run before fixing |
| **DATABASE_SCHEMA_ANALYSIS.md** | Complete analysis of all issues | Read for full understanding |
| **SCHEMA_FILES_OVERVIEW.md** | This file - overview of all files | Reference |

---

## The Constraint Error Explained

### What's Wrong

**Migration 005** expects:
```sql
CONSTRAINT event_flags_unique_user_event UNIQUE (event_id, user_id)
```

**But these files created:**
```sql
UNIQUE(event_id, user_id)  -- No name specified
```

PostgreSQL auto-generated name: `event_flags_event_id_user_id_key` ❌

### Files with WRONG constraint (unnamed):
- ❌ `APPLY_THIS_TO_SUPABASE.sql` (Line 336)
- ❌ `CRITICAL_SCHEMA_FIXES.sql` (Line 76)

### Files with CORRECT constraint (named):
- ✅ `005_add_event_flags_table.sql` (Line 38-39)
- ✅ `standalone_event_flags_setup.sql` (Line 46-47)

### Why It Fails

When migration 005 tries to run:
```sql
COMMENT ON CONSTRAINT event_flags_unique_user_event ON event_flags IS '...';
```

PostgreSQL says: "Constraint `event_flags_unique_user_event` doesn't exist!"

Because it's actually named `event_flags_event_id_user_id_key` (auto-generated).

---

## Decision Tree: Which Files Should I Use?

### Option A: Using Migrations (Recommended)

```
✅ DO USE:
- 001_initial_schema.sql
- 002_fix_rls_infinite_recursion.sql
- 003_add_event_categories_pricing.sql
- FIX_PROFILES_TABLE.sql (before 004)
- 004_admin_moderation_system.sql
- FIX_EVENT_FLAGS_CONSTRAINT.sql (to fix constraint)
- 005_add_event_flags_table.sql

❌ DO NOT USE:
- APPLY_THIS_TO_SUPABASE.sql
- CRITICAL_SCHEMA_FIXES.sql
- 001_initial_schema_REVISED.sql
```

**Steps:**
1. Run migrations 001, 002, 003 in order
2. Run FIX_PROFILES_TABLE.sql
3. Run migration 004
4. Run FIX_EVENT_FLAGS_CONSTRAINT.sql (if needed)
5. Run migration 005

---

### Option B: Using Standalone Schema

```
✅ DO USE:
- APPLY_THIS_TO_SUPABASE.sql (after fixing constraint names)
- FIX_PROFILES_TABLE.sql

❌ DO NOT USE:
- Any migration files
- CRITICAL_SCHEMA_FIXES.sql
```

**Steps:**
1. Fix constraint names in APPLY_THIS_TO_SUPABASE.sql:
   - Line 336: Add `CONSTRAINT event_flags_unique_user_event` before `UNIQUE`
2. Run FIX_PROFILES_TABLE.sql
3. Run modified APPLY_THIS_TO_SUPABASE.sql

---

### Option C: Fresh Start

```
✅ DO THIS:
1. Drop all tables (backup first!)
2. Create 000_create_profiles.sql migration
3. Run migrations 001, 002, 003, 000, 004, 005 in order
4. Never use standalone files
```

---

## Tables Created by Each File

### 001_initial_schema.sql
- `clubs` (basic columns)
- `events` (basic columns)
- `club_members` (basic columns)
- `event_registrations`

### 003_add_event_categories_pricing.sql
- Adds to `events`: category, is_free, price

### 004_admin_moderation_system.sql
- Adds to `profiles`: is_admin
- Adds to `clubs`: approval_status, approved_by, approved_at, rejection_reason
- Creates `club_flags`
- Creates `moderation_logs`
- Creates functions: is_admin(), log_moderation_action()

### 005_add_event_flags_table.sql
- Creates `event_flags` (with correct constraint name)

### FIX_PROFILES_TABLE.sql
- Creates `profiles` (should run before 004)

### APPLY_THIS_TO_SUPABASE.sql
- Creates ALL tables at once (conflicts with migrations)
- Missing: approval columns on clubs
- Wrong: constraint name on event_flags

---

## Constraint Names Comparison

| Table | Constraint | 005 Migration | APPLY_THIS | Status |
|-------|-----------|---------------|------------|--------|
| **event_flags** | Unique (event_id, user_id) | `event_flags_unique_user_event` ✅ | Unnamed (auto-generated) ❌ | **ERROR** |
| **club_flags** | Unique (club_id, user_id) | `club_flags_unique_user_club` ✅ | N/A (not in file) | OK |
| **club_members** | Unique (club_id, user_id) | Unnamed | Unnamed | OK |
| **event_registrations** | Unique (event_id, user_id) | Unnamed | Unnamed | OK |

**Only event_flags has the mismatch!**

---

## Functions and Their Dependencies

```
is_admin(UUID)
├── Created in: 004_admin_moderation_system.sql (Line 156)
├── Used in: 005_add_event_flags_table.sql (Line 229)
└── Used in: standalone_event_flags_setup.sql (Line 171)

log_moderation_action(UUID, TEXT, TEXT, UUID, JSONB)
├── Created in: 004_admin_moderation_system.sql (Line 172)
├── Used in: 005_add_event_flags_table.sql (Line 129)
└── Used in: standalone_event_flags_setup.sql (Line 102)
```

**⚠️ Migration 005 REQUIRES migration 004 to run first!**

---

## Summary Table: All Issues Found

| Issue # | Description | Affected Files | Severity |
|---------|-------------|----------------|----------|
| **1** | Constraint name mismatch | 005, APPLY_THIS, CRITICAL_SCHEMA_FIXES | 🔴 CRITICAL |
| **2** | Multiple schema definitions | All 5 schema files | 🟠 HIGH |
| **3** | Missing profiles migration | 004 requires profiles | 🟠 HIGH |
| **4** | RLS policy conflicts | 001, 004, APPLY_THIS | 🟡 MEDIUM |
| **5** | Function dependencies not enforced | 004, 005 | 🟡 MEDIUM |
| **6** | club_flags vs event_flags naming | 004, 005 | 🟢 LOW |
| **7** | Duplicate REVISED file | 001, 001_REVISED | 🟢 LOW |

---

## Next Steps

### Immediate (Fix the Error)
1. ✅ Run `FIX_EVENT_FLAGS_CONSTRAINT.sql` in Supabase
2. ✅ Verify with `COMPREHENSIVE_DIAGNOSTIC.sql`

### Soon (Prevent Future Issues)
3. ⚠️ Create `000_create_profiles.sql` migration
4. ⚠️ Choose migration OR standalone approach (not both)
5. ⚠️ Fix or delete conflicting files

### Later (Cleanup)
6. 📝 Delete or archive unused files
7. 📝 Document which files are canonical
8. 📝 Add dependency checks to migrations

---

## Quick Reference: File Paths

All files in: `/Users/ellarushing/downloads/asu-connect/`

**To run a file in Supabase:**
1. Open file in editor
2. Copy contents
3. Go to Supabase Dashboard > SQL Editor
4. Paste and click "Run"

**Recommended order:**
1. Read: `QUICK_FIX_GUIDE.md`
2. Run: `COMPREHENSIVE_DIAGNOSTIC.sql` (optional, to see the problem)
3. Run: `FIX_EVENT_FLAGS_CONSTRAINT.sql` (fixes the error)
4. Read: `DATABASE_SCHEMA_ANALYSIS.md` (full details)
