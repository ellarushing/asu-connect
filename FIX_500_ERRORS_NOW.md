# Fix 500 Errors - Action Plan

## The Problem
Your app is throwing **500 Internal Server Error** when:
- Creating events
- Creating clubs
- Joining clubs
- Flagging events

## The Cause
The API code expects database columns that don't exist yet in Supabase.

## The Solution (5 minutes)

### Step 1: Run the SQL Fix

1. Open your Supabase project: https://app.supabase.com
2. Click **SQL Editor** in the left sidebar
3. Click **New Query** button
4. Open this file: `/Users/ellarushing/Downloads/asu-connect/CRITICAL_SCHEMA_FIXES.sql`
5. Copy the ENTIRE contents
6. Paste into Supabase SQL Editor
7. Click **Run** (the play button)
8. Wait for green checkmarks (should take ~5 seconds)

### Step 2: Test Your App

1. **Create a Club**
   - Go to create club page
   - Fill out the form
   - Should succeed (no 500 error)

2. **Create an Event**
   - Go to a club you created
   - Click create event
   - Add category and pricing info
   - Should succeed (no 500 error)

3. **Join a Club**
   - Go to a club you didn't create
   - Click "Join Club"
   - Should succeed with "Pending" status

## What the Fix Does

Adds these missing database elements:

| Table | What's Added | Why It's Needed |
|-------|-------------|-----------------|
| `events` | `category`, `is_free`, `price` columns | Event creation API needs these (line 148, 209-211 in events route) |
| `club_members` | `status` column (default: 'approved') | Club membership API needs approval workflow (line 42, 114 in membership route) |
| `event_flags` | Entire new table | Event flagging API needs this table (line 30-35 in flag route) |

## Why It's Failing Now

Your code was updated to use new features, but the database wasn't. Here's what's happening:

### Example: Creating an Event

**API Code (lines 200-212 in `/app/api/events/route.ts`):**
```typescript
const { data: newEvent, error } = await supabase
  .from('events')
  .insert({
    title,
    description,
    event_date,
    location,
    club_id,
    created_by: user.id,
    category: category || null,    // ← Column doesn't exist!
    is_free: isFree,               // ← Column doesn't exist!
    price: !isFree ? price : null  // ← Column doesn't exist!
  })
```

**Supabase Error:**
```
column "category" of relation "events" does not exist
```

**Result:** 500 Internal Server Error shown to user

## Important Details

### Why DEFAULT 'approved' for status?

When you create a club, the code automatically adds you as admin:

```typescript
// /app/api/clubs/route.ts line 289-295
await supabase.from('club_members').insert({
  club_id: club.id,
  user_id: user.id,
  role: 'admin'
  // NOTE: status is NOT set here
});
```

The code doesn't specify `status`, so it uses the DEFAULT value.

- ✅ DEFAULT 'approved' = Club creators are instantly admins (correct!)
- ❌ DEFAULT 'pending' = Club creators need to approve themselves (broken!)

When regular users join, the API explicitly sets `status: 'pending'` (line 114 in membership route).

## Verification Queries

After running the fix, verify it worked:

```sql
-- Check events columns (should return 3 rows)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'events'
AND column_name IN ('category', 'is_free', 'price');

-- Check club_members status (should return 1 row with default 'approved')
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'club_members'
AND column_name = 'status';

-- Check event_flags exists (should return 1)
SELECT COUNT(*)
FROM information_schema.tables
WHERE table_name = 'event_flags' AND table_schema = 'public';
```

## What's NOT Included

This is a **minimal fix** to get your app working. It doesn't include:

- Performance indexes (can add later when you have lots of data)
- Complex price validation constraints
- Advanced RLS policies for membership visibility
- Additional event_flags indexes

You can add these later from `APPLY_THIS_TO_SUPABASE.sql` once the app is stable.

## Still Getting Errors?

### Error: "permission denied for table events"
**Cause:** RLS policies not working correctly
**Fix:** Check you're logged in. Try logging out and back in.

### Error: "duplicate key value violates unique constraint"
**Cause:** Trying to join a club you're already in
**Fix:** This is expected behavior. The API should handle this gracefully.

### Error: "relation 'event_flags' does not exist"
**Cause:** The SQL script didn't run completely
**Fix:** Check Supabase SQL Editor for red error messages. Re-run the script.

### Error: "column 'status' of relation 'club_members' does not exist"
**Cause:** The ALTER TABLE for club_members failed
**Fix:** Manually run this in SQL Editor:
```sql
ALTER TABLE public.club_members
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
CHECK (status IN ('pending', 'approved', 'rejected'));
```

## Files Reference

- **CRITICAL_SCHEMA_FIXES.sql** ← **Run this first!**
- **FIX_500_ERRORS_NOW.md** ← You are here
- **SCHEMA_FIX_SUMMARY.md** ← Detailed explanation
- **SCHEMA_STATUS.md** ← Technical analysis
- **APPLY_THIS_TO_SUPABASE.sql** ← Complete schema (for later)

## Expected Timeline

- **5 minutes:** Run SQL script
- **2 minutes:** Test app functionality
- **Total: 7 minutes** to fix all 500 errors

## Success Criteria

After the fix, you should be able to:
- ✅ Create clubs without errors
- ✅ Create events with categories and pricing
- ✅ Join clubs and see pending status
- ✅ Flag events for review
- ✅ No more 500 errors in these operations

## Next Steps After Fix

Once the app is working:

1. **Test thoroughly:**
   - Create multiple clubs
   - Create events with different categories
   - Test free vs paid events
   - Test membership approval workflow

2. **Monitor Supabase logs:**
   - Dashboard > Logs
   - Watch for any RLS policy issues
   - Check for slow queries

3. **Add optimizations (optional):**
   - Run the full `APPLY_THIS_TO_SUPABASE.sql` for indexes
   - Add custom RLS policies as needed
   - Optimize queries if needed

## Need Help?

If you're still stuck after running the fix:

1. Check Supabase Dashboard > Logs for error messages
2. Copy the exact error message
3. Check which SQL statement failed (should show in logs)
4. Verify your Supabase credentials in `.env.local`

## Technical Context

### Migration History
- `001_initial_schema.sql` - Base tables (already applied)
- `002_fix_rls_infinite_recursion.sql` - Fixed RLS policies (already applied)
- `003_add_event_categories_pricing.sql` - Event columns (**NOT applied yet**)
- **Missing:** event_flags table creation
- **Missing:** club_members.status column

### Why Migrations Weren't Applied
The migration files in `/supabase/migrations/` are for local development with Supabase CLI. They don't automatically apply to your hosted Supabase project. You need to manually run the SQL in the Supabase dashboard.

### Why CRITICAL_SCHEMA_FIXES.sql Instead of APPLY_THIS_TO_SUPABASE.sql?
- **CRITICAL_SCHEMA_FIXES.sql:** Only essential columns/tables (safe, fast, minimal)
- **APPLY_THIS_TO_SUPABASE.sql:** Complete schema rebuild (more risky if tables exist)

Use CRITICAL_SCHEMA_FIXES.sql first. Once stable, you can add the extras from APPLY_THIS_TO_SUPABASE.sql.

---

**Ready?** Open Supabase, run CRITICAL_SCHEMA_FIXES.sql, test your app!
