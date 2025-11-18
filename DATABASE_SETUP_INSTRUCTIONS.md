# Database Setup Instructions

## Quick Start

You have two options depending on whether you have existing tables:

### Option A: Fresh Database (No Existing Tables)

If you don't have `event_flags` or `club_flags` tables yet:

1. Go to Supabase Dashboard > SQL Editor
2. Copy and paste **COMPLETE_DATABASE_SETUP.sql**
3. Click "Run"
4. Done!

### Option B: Existing Tables (Fix Constraint Names First)

If you already have `event_flags` or `club_flags` tables with auto-generated constraint names:

1. Go to Supabase Dashboard > SQL Editor
2. **FIRST**: Copy and paste **FIX_EXISTING_TABLES.sql**
3. Click "Run"
4. Review the verification output
5. **THEN**: Copy and paste **COMPLETE_DATABASE_SETUP.sql**
6. Click "Run"
7. Done!

## What Each Script Does

### FIX_EXISTING_TABLES.sql

**Purpose**: Emergency fix for existing tables with wrong constraint names

**What it fixes**:
- Finds and drops ANY unique constraint on `event_flags(event_id, user_id)` regardless of name
- Recreates it with correct name: `event_flags_unique_user_event`
- Does the same for `club_flags(club_id, user_id)` with name: `club_flags_unique_user_club`

**Safety features**:
- Handles cases where tables don't exist (no error)
- Handles cases where constraints already have correct names (no-op)
- Idempotent - safe to run multiple times
- Uses dynamic SQL with DO blocks to find constraint names

**When to use**:
- Before running COMPLETE_DATABASE_SETUP.sql if you have existing tables
- If you get errors about constraint names not existing

### COMPLETE_DATABASE_SETUP.sql

**Purpose**: Complete database schema setup from scratch

**What it creates**:
- All 8 tables with proper constraints
- All indexes for performance
- All helper functions (is_admin, log_moderation_action, etc.)
- All triggers for automation
- RLS policies on all tables
- Proper grants and permissions

**Safety features**:
- Uses IF NOT EXISTS everywhere
- Idempotent (safe to run multiple times)
- Comprehensive error handling
- Includes verification queries

## Common Issues

### Error: "constraint X does not exist"

**Solution**: Run FIX_EXISTING_TABLES.sql first

This happens when your tables were created with auto-generated constraint names (like `event_flags_event_id_user_id_key`) but the setup script expects specific names (like `event_flags_unique_user_event`).

### Error: "relation X already exists"

**Solution**: This is normal! The script uses IF NOT EXISTS to safely skip existing objects.

The script will only create what doesn't exist yet.

### Error: "duplicate key value violates unique constraint"

**Solution**: You have duplicate data in your tables

Before running FIX_EXISTING_TABLES.sql, clean up any duplicate entries:

```sql
-- Find duplicate event flags
SELECT event_id, user_id, COUNT(*)
FROM event_flags
GROUP BY event_id, user_id
HAVING COUNT(*) > 1;

-- Find duplicate club flags
SELECT club_id, user_id, COUNT(*)
FROM club_flags
GROUP BY club_id, user_id
HAVING COUNT(*) > 1;

-- Delete duplicates (keep only the first one)
DELETE FROM event_flags a USING event_flags b
WHERE a.id < b.id
AND a.event_id = b.event_id
AND a.user_id = b.user_id;

DELETE FROM club_flags a USING club_flags b
WHERE a.id < b.id
AND a.club_id = b.club_id
AND a.user_id = b.user_id;
```

## Verification

After running the scripts, verify everything is correct:

```sql
-- Check constraint names on event_flags
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'event_flags'::regclass
AND contype = 'u';

-- Should show: event_flags_unique_user_event

-- Check constraint names on club_flags
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'club_flags'::regclass
AND contype = 'u';

-- Should show: club_flags_unique_user_club
```

## Still Having Issues?

If you continue to have problems:

1. Run the diagnostic queries in the verification section of COMPLETE_DATABASE_SETUP.sql
2. Check the Supabase logs for detailed error messages
3. Ensure you're running the scripts in the correct order
4. Make sure you have proper permissions on your Supabase database

## Files in This Directory

- **FIX_EXISTING_TABLES.sql** - Emergency fix for constraint naming issues
- **COMPLETE_DATABASE_SETUP.sql** - Complete database schema setup
- **DATABASE_SETUP_INSTRUCTIONS.md** - This file
- **FIX_EVENT_FLAGS_CONSTRAINT.sql** - Old fix (superseded by FIX_EXISTING_TABLES.sql)

## Order of Operations

```
1. FIX_EXISTING_TABLES.sql (if you have existing tables)
   ↓
2. COMPLETE_DATABASE_SETUP.sql
   ↓
3. Create your first admin:
   UPDATE profiles SET is_admin = true WHERE email = 'your-email@asu.edu';
```
