# Database Schema Fix - Summary

## Problem Identified

Your ASU Connect app is getting **500 Internal Server Error** when users try to:
1. Create events
2. Join clubs
3. Flag events

## Root Cause

The API code expects database columns/tables that don't exist in Supabase yet:

| Feature | API File | Missing in Database |
|---------|----------|-------------------|
| Event Categories & Pricing | `/app/api/events/route.ts` | `events.category`, `events.is_free`, `events.price` |
| Club Membership Approval | `/app/api/clubs/[id]/membership/route.ts` | `club_members.status` |
| Event Flagging | `/app/api/events/[id]/flag/route.ts` | `event_flags` table |

## The Fix

### File Created: `CRITICAL_SCHEMA_FIXES.sql`

This SQL script adds:

1. **Events table - 3 new columns:**
   - `category` (TEXT) - Academic, Social, Sports, Arts, Career, Community Service, Other
   - `is_free` (BOOLEAN) - Defaults to true
   - `price` (DECIMAL) - Only required when is_free=false

2. **Club_members table - 1 new column:**
   - `status` (TEXT) - pending, approved, rejected
   - **Defaults to 'approved'** (critical for club creators!)

3. **Event_flags table - completely new:**
   - Tracks user reports of inappropriate events
   - Includes RLS policies for security
   - Links events, users, and review status

## Why DEFAULT 'approved' for club_members.status?

This is a critical detail that prevents a bug:

```typescript
// In /app/api/clubs/route.ts line 289-295
// When creating a club, the creator is auto-added as admin:
await supabase.from('club_members').insert({
  club_id: club.id,
  user_id: user.id,
  role: 'admin'
  // NOTE: status is NOT specified!
});
```

**The API doesn't set `status` when adding the club creator.**

- If DEFAULT was 'pending': Club creator would need to approve themselves (broken!)
- With DEFAULT 'approved': Club creator is instantly approved (correct!)

When users join an existing club, the API explicitly sets `status: 'pending'` (line 114 in membership route).

## How to Apply

### Step 1: Run the SQL Script (5 minutes)

1. Go to your Supabase project
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy/paste the entire contents of `CRITICAL_SCHEMA_FIXES.sql`
5. Click **Run**
6. Check for success (should see green checkmarks)

### Step 2: Verify the Fix

Run these queries in Supabase SQL Editor:

```sql
-- Should return 3 rows (category, is_free, price)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'events'
AND column_name IN ('category', 'is_free', 'price');

-- Should return 1 row (status, default 'approved')
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'club_members'
AND column_name = 'status';

-- Should return 1 (table exists)
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'event_flags' AND table_schema = 'public';
```

### Step 3: Test the App

1. **Test Club Creation:**
   - Create a new club
   - Should succeed without errors
   - Creator should automatically be an admin member

2. **Test Event Creation:**
   - Go to a club you admin
   - Create an event with category and pricing
   - Should succeed without errors

3. **Test Joining Clubs:**
   - Join a club you don't own
   - Should create a pending membership request
   - Club admin should see the pending request

## What's NOT Included

To keep the fix minimal and safe, I excluded:

- **Performance indexes** (idx_events_category, idx_events_is_free, etc.)
- **Complex constraints** (price must be > 0 when is_free=false)
- **Advanced RLS policies** (club_members visibility based on status)
- **Additional event_flags indexes**

These can be added later from `APPLY_THIS_TO_SUPABASE.sql` once the app is stable.

## Expected Behavior After Fix

| Action | Before Fix | After Fix |
|--------|-----------|-----------|
| Create Event | 500 Error: column "category" does not exist | Success: Event created with category/pricing |
| Join Club | 500 Error: column "status" does not exist | Success: Pending request created |
| Create Club | 500 Error: column "status" does not exist | Success: Creator auto-approved as admin |
| Flag Event | 500 Error: relation "event_flags" does not exist | Success: Flag created for review |

## Troubleshooting

### If you still get errors after running the SQL:

1. **Check Supabase Logs:**
   - Dashboard > Logs
   - Look for specific error messages
   - Check if RLS policies are blocking requests

2. **Verify columns exist:**
   ```sql
   \d events           -- Shows events table structure
   \d club_members     -- Shows club_members table structure
   \d event_flags      -- Shows event_flags table structure
   ```

3. **Check RLS is enabled:**
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public'
   AND tablename IN ('events', 'club_members', 'event_flags');
   ```
   All should show `rowsecurity = true`

4. **Verify authentication:**
   - Make sure you're logged in when testing
   - Check that your auth token is valid
   - Try logging out and back in

### Common Issues

**Issue:** "duplicate key value violates unique constraint"
- **Cause:** Trying to join a club you're already in
- **Fix:** Check membership status first (the API should handle this)

**Issue:** "permission denied for table event_flags"
- **Cause:** RLS policies not applied correctly
- **Fix:** Re-run the RLS policy section of the SQL script

**Issue:** "null value in column status violates not-null constraint"
- **Cause:** Somehow status is NULL (shouldn't happen with DEFAULT)
- **Fix:** Run `UPDATE club_members SET status = 'approved' WHERE status IS NULL;`

## Files Reference

- **CRITICAL_SCHEMA_FIXES.sql** - Run this first (minimal fix)
- **SCHEMA_STATUS.md** - Detailed analysis of what's missing
- **APPLY_THIS_TO_SUPABASE.sql** - Complete schema with indexes and advanced features
- **TESTING_GUIDE.md** - How to test all features

## Next Steps

After the fix is working:

1. **Add indexes for performance** (when you have > 100 events/clubs)
2. **Update RLS policies** for club_members visibility based on status
3. **Add price validation** to ensure paid events have valid prices
4. **Test edge cases** like leaving clubs, deleting events, etc.

## Support

If you encounter issues:
1. Check the Supabase Dashboard logs
2. Verify the SQL script ran completely (no red errors)
3. Test with a fresh browser session (clear cookies)
4. Check that your .env.local has the correct Supabase credentials

## Technical Notes

### Why use IF NOT EXISTS?
Makes the script idempotent - you can run it multiple times safely.

### Why use DO $$ blocks for policies?
Prevents errors if policies already exist (PostgreSQL doesn't have CREATE POLICY IF NOT EXISTS).

### Why DEFAULT values?
Ensures backward compatibility with existing code that doesn't explicitly set these fields.

### Why minimal RLS policies?
Gets the app working quickly. More restrictive policies can be added incrementally once the app is stable.
