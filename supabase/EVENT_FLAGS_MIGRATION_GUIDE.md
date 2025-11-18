# Event Flags Migration Guide

This guide explains how to apply the event flags table migration to your Supabase database.

## Overview

The event flags system allows users to report inappropriate events for moderation. This migration creates:

- `event_flags` table with full schema
- Performance-optimized indexes
- Row Level Security (RLS) policies
- Automatic timestamp updates
- Moderation audit logging
- Comprehensive access control

## Prerequisites

Before running this migration, ensure:

1. Your Supabase project has the `events` table
2. Migration `004_admin_moderation_system.sql` has been applied (provides `is_admin()` function)
3. You have admin access to your Supabase project

## Option 1: Using Supabase CLI (Recommended for Development)

This is the proper way to apply migrations in a version-controlled manner.

### Steps:

1. **Ensure you have Supabase CLI installed:**
   ```bash
   npm install -g supabase
   ```

2. **Link your project (if not already linked):**
   ```bash
   cd /Users/ellarushing/Downloads/asu-connect
   supabase link --project-ref your-project-ref
   ```

3. **Apply the migration:**
   ```bash
   supabase db push
   ```

   Or apply this specific migration:
   ```bash
   supabase migration up
   ```

4. **Verify the migration:**
   ```bash
   supabase db diff
   ```

### Advantages:
- Version controlled
- Reversible (can create down migrations)
- Tracks migration history
- Works well in team environments
- Safe for CI/CD pipelines

## Option 2: Using Supabase SQL Editor (Quick Setup)

This is the fastest way to get started, ideal for rapid prototyping or testing.

### Steps:

1. **Open Supabase Dashboard:**
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Select your project
   - Navigate to **SQL Editor** in the left sidebar

2. **Copy the standalone script:**
   - Open `/Users/ellarushing/Downloads/asu-connect/supabase/standalone_event_flags_setup.sql`
   - Copy the entire file contents

3. **Paste and run:**
   - Paste into the SQL Editor
   - Click **Run** button (or press Cmd/Ctrl + Enter)
   - Wait for "Success" message

4. **Verify installation:**
   Uncomment and run the verification queries at the bottom of the script.

### Advantages:
- Fastest method
- No CLI setup required
- Good for quick fixes or hotfixes
- Can be run from anywhere

### Disadvantages:
- Not version controlled
- Harder to track in team environments
- Manual rollback if needed

## Option 3: Direct SQL File Execution

If you prefer to use the actual migration file:

### Steps:

1. **Open Supabase Dashboard > SQL Editor**

2. **Copy the migration file:**
   - Open `/Users/ellarushing/Downloads/asu-connect/supabase/migrations/005_add_event_flags_table.sql`
   - Copy entire contents

3. **Paste and run in SQL Editor**

4. **Manually track the migration:**
   You may want to record in your `supabase_migrations` table:
   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version, name)
   VALUES ('005', 'add_event_flags_table');
   ```

## What Gets Created

### Tables
- **event_flags**: Stores flag reports with fields:
  - `id`: UUID primary key
  - `event_id`: Reference to events table
  - `user_id`: User who created the flag
  - `reason`: Primary reason for flagging
  - `details`: Additional context
  - `status`: pending | reviewed | resolved | dismissed
  - `reviewed_by`: Admin who reviewed
  - `reviewed_at`: Review timestamp
  - `created_at`: Creation timestamp
  - `updated_at`: Last update timestamp (auto-managed)

### Indexes (for Performance)
- `idx_event_flags_event_id`: Fast lookup by event
- `idx_event_flags_user_id`: Fast lookup by user
- `idx_event_flags_status`: Fast filtering by status
- `idx_event_flags_created_at`: Fast chronological ordering
- `idx_event_flags_status_created`: Optimized for admin dashboard queries

### RLS Policies (Security)

| Policy Name | Action | Who Can Access |
|------------|--------|----------------|
| `event_flags_select_own` | SELECT | Users viewing their own flags |
| `event_flags_select_event_creator` | SELECT | Event creators viewing flags on their events |
| `event_flags_select_admin` | SELECT | Admins viewing all flags |
| `event_flags_insert` | INSERT | Authenticated users creating flags |
| `event_flags_update_event_creator` | UPDATE | Event creators updating flags on their events |
| `event_flags_update_admin` | UPDATE | Admins updating any flag |
| `event_flags_delete_own_pending` | DELETE | Users deleting their own pending flags |

### Triggers
- **updated_at trigger**: Automatically updates `updated_at` timestamp
- **resolution logging trigger**: Logs to `moderation_logs` when flags are resolved/dismissed

## Verification

After applying the migration, verify everything works:

### 1. Check Table Exists
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'event_flags';
```

Expected: 1 row returned

### 2. Check All Columns
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'event_flags'
ORDER BY ordinal_position;
```

Expected: 10 columns

### 3. Check Indexes
```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'event_flags';
```

Expected: 6 indexes (1 primary key + 5 created indexes)

### 4. Check RLS Policies
```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'event_flags';
```

Expected: 7 policies

### 5. Test Flag Creation (via API or psql)
```sql
-- This should work if you're authenticated
INSERT INTO event_flags (event_id, user_id, reason, details)
VALUES (
  'existing-event-uuid',
  auth.uid(),
  'Inappropriate content',
  'This event contains offensive language'
);
```

## Troubleshooting

### Error: function is_admin(uuid) does not exist

**Cause:** Migration 004 (admin moderation system) hasn't been applied yet.

**Solution:**
1. Apply migration 004 first:
   ```bash
   supabase db push migrations/004_admin_moderation_system.sql
   ```
2. Then apply this migration

**Alternative:** If you don't need admin features yet, comment out these sections in the standalone script:
- Policy 3: `event_flags_select_admin`
- Policy 6: `event_flags_update_admin`
- The `log_event_flag_resolution()` trigger function

### Error: relation "events" does not exist

**Cause:** The events table hasn't been created yet.

**Solution:** Run earlier migrations first:
```bash
supabase db push migrations/001_initial_schema.sql
```

### Error: duplicate key value violates unique constraint

**Cause:** A user is trying to flag the same event twice.

**Solution:** This is expected behavior. The unique constraint prevents duplicate flags.

### Error: new row violates row-level security policy

**Cause:** RLS policies are blocking the operation.

**Solution:** Verify:
1. User is authenticated (`auth.uid()` returns a value)
2. User is setting `user_id` to their own UUID
3. For admin operations, verify user has `is_admin = true` in profiles table

### RLS Policies Not Working

**Debug steps:**
1. Check if RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE tablename = 'event_flags';
   ```

2. View your current user:
   ```sql
   SELECT auth.uid();
   ```

3. Test policy conditions manually:
   ```sql
   -- Test if you're an admin
   SELECT is_admin(auth.uid());
   ```

## Integration with Your Application

### API Endpoints

Your Next.js API routes should be at:
- `POST /api/events/[id]/flag` - Create a flag
- `GET /api/events/[id]/flags` - Get flags for an event (creator/admin only)
- `GET /api/admin/flags` - Get all flags (admin only)
- `PATCH /api/admin/flags/[id]` - Update flag status (admin only)

### Example Supabase Client Code

```typescript
// Create a flag
const { data, error } = await supabase
  .from('event_flags')
  .insert({
    event_id: eventId,
    user_id: userId,
    reason: 'Inappropriate content',
    details: 'Contains offensive language'
  });

// Get flags for an event (as creator)
const { data, error } = await supabase
  .from('event_flags')
  .select('*')
  .eq('event_id', eventId);

// Update flag status (as admin)
const { data, error } = await supabase
  .from('event_flags')
  .update({
    status: 'resolved',
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString()
  })
  .eq('id', flagId);
```

## Rollback (if needed)

If you need to undo this migration:

```sql
-- Drop all policies
DROP POLICY IF EXISTS event_flags_select_own ON event_flags;
DROP POLICY IF EXISTS event_flags_select_event_creator ON event_flags;
DROP POLICY IF EXISTS event_flags_select_admin ON event_flags;
DROP POLICY IF EXISTS event_flags_insert ON event_flags;
DROP POLICY IF EXISTS event_flags_update_event_creator ON event_flags;
DROP POLICY IF EXISTS event_flags_update_admin ON event_flags;
DROP POLICY IF EXISTS event_flags_delete_own_pending ON event_flags;

-- Drop triggers
DROP TRIGGER IF EXISTS event_flags_updated_at_trigger ON event_flags;
DROP TRIGGER IF EXISTS event_flag_resolution_logging_trigger ON event_flags;

-- Drop functions
DROP FUNCTION IF EXISTS update_event_flags_updated_at();
DROP FUNCTION IF EXISTS log_event_flag_resolution();

-- Drop table (this will cascade delete all flags!)
DROP TABLE IF EXISTS event_flags;
```

**WARNING:** This will permanently delete all flag data!

## Support

If you encounter issues:

1. Check the Supabase logs: Dashboard > Database > Logs
2. Review the PostgreSQL error messages carefully
3. Verify all prerequisites are met
4. Check that earlier migrations were applied successfully
5. Ensure your user has appropriate permissions in Supabase

## Files in This Migration

| File | Purpose | When to Use |
|------|---------|-------------|
| `migrations/005_add_event_flags_table.sql` | Official migration file | Use with Supabase CLI or version control |
| `standalone_event_flags_setup.sql` | Self-contained setup script | Quick setup via SQL Editor |
| `EVENT_FLAGS_MIGRATION_GUIDE.md` | This guide | Reference documentation |

## Next Steps

After successfully applying this migration:

1. Test flag creation in your app
2. Verify RLS policies work as expected
3. Set up admin dashboard to view/manage flags
4. Consider adding email notifications for new flags
5. Add flag count badges to event displays
6. Implement automated content moderation triggers

---

**Migration Version:** 005
**Created:** 2025-11-17
**Dependencies:** 004_admin_moderation_system.sql
**Idempotent:** Yes (safe to run multiple times)
