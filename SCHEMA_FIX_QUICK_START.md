# Quick Start: Fixing Schema Errors

## TL;DR - The Problem
Your RLS policies have infinite recursion caused by policies querying the same table they're protecting.

## TL;DR - The Solution
Apply the migration file that queries the `clubs` table instead of recursively querying `club_members`.

## Immediate Action Items

### Step 1: Apply the Fix
```bash
cd asu-connect
supabase migration up
```

This applies the file: `supabase/migrations/002_fix_rls_infinite_recursion.sql`

### Step 2: Verify It Works
```bash
# Connect to your Supabase project
psql postgresql://[connection_string]

# Test if you can query tables
SELECT COUNT(*) FROM public.clubs;
SELECT COUNT(*) FROM public.event_registrations;
SELECT COUNT(*) FROM public.club_members;
```

### Step 3: Test Your Application
Start your app and verify:
- [ ] Can create a club
- [ ] Can view clubs
- [ ] Can create events
- [ ] Can register for events
- [ ] Can join clubs
- [ ] Can remove yourself from clubs

## What Changed?

### Authorization Model
**Before** (Broken):
- Any 'admin' user could manage members (recursive check)

**After** (Fixed):
- Only the club creator can manage members (single-table check)

### Functionality Preserved
- ✅ Users can still join clubs as members
- ✅ Users can still remove themselves
- ✅ Club creators can still manage everything
- ✅ Public read access still works
- ✅ Events can be created and registered

## Files to Know About

| File | Purpose |
|------|---------|
| `supabase/migrations/002_fix_rls_infinite_recursion.sql` | **Apply this** - fixes the broken schema |
| `supabase/migrations/001_initial_schema_REVISED.sql` | Clean version - use for new projects |
| `DATABASE_SCHEMA_FIXES.md` | Detailed explanation of issues and fixes |
| `supabase/migrations/001_initial_schema.sql` | **Don't use** - has the infinite recursion bug |

## If You Still Have Problems

### Error: "Could not find table 'public.event_registrations'"
1. Check if the initial migration (001) was applied
2. Apply migration 002 to fix RLS issues
3. The table will then be accessible

### Error: "infinite recursion detected in policy"
1. Apply migration 002 to drop the bad policies
2. The new policies use the clubs table instead

### Error: Policy prevents my authorized operation
1. Remember: only **club creators** can manage members now (not all admins)
2. This is by design for simplicity and to avoid recursion

## Authorization Rules After Fix

| Operation | Who Can Do It | How It's Checked |
|-----------|-------------|-----------------|
| View clubs | Anyone | Always allowed |
| Create club | Authenticated users | Query auth.uid() |
| Update own club | Club creator | Query clubs.created_by |
| Delete own club | Club creator | Query clubs.created_by |
| View club members | Anyone | Always allowed |
| Join a club | Authenticated users | Check auth.uid() matches user_id |
| Remove yourself | You | Check auth.uid() matches user_id |
| Add/remove/edit members | Club creator | Query clubs.created_by |
| View events | Anyone | Always allowed |
| Create event | Club creator | Query clubs.created_by |
| View registrations | Anyone | Always allowed |
| Register for event | Authenticated users | Check auth.uid() matches user_id |

## Database Schema

```
clubs (owner: created_by)
  ├── club_members (join table)
  └── events (owner: created_by)
       └── event_registrations (owner: user_id)
```

## Support

For more details, see: `DATABASE_SCHEMA_FIXES.md`

This document explains:
- Root cause of infinite recursion
- Why the fix works
- Performance implications
- Testing procedures
