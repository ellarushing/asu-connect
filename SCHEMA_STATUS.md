# Database Schema Status Report

## Current Problem

Your app is experiencing **500 Internal Server Error** when:
1. Creating events
2. Joining clubs

## Root Cause

The API code expects database columns that don't exist in your Supabase database yet. The code references:
- `events.category`
- `events.is_free`
- `events.price`
- `club_members.status`
- `event_flags` table (entire table)

## What Needs to Be Fixed

### 1. Events Table - Missing Columns
**API expects:** Lines 27-29, 148, 209-211 in `/app/api/events/route.ts`
```typescript
category: string | null;
is_free: boolean;
price: number | null;
```

**Database needs:**
- `category` column (TEXT, allows Academic/Social/Sports/Arts/Career/Community Service/Other)
- `is_free` column (BOOLEAN, defaults to true)
- `price` column (DECIMAL(10,2), allows NULL)

### 2. Club Members Table - Missing Column
**API expects:** Line 12, 42, 89, 95, 114 in `/app/api/clubs/[id]/membership/route.ts`
```typescript
status: string; // 'pending' | 'approved' | 'rejected'
```

**Database needs:**
- `status` column (TEXT, defaults to 'approved', checks for pending/approved/rejected)

### 3. Event Flags Table - Missing Entirely
**API expects:** Lines 30-35 in `/app/api/events/[id]/flag/route.ts`
```typescript
event_flags table with columns:
- id, event_id, user_id, reason, details, status
- reviewed_by, reviewed_at, created_at, updated_at
```

**Database needs:**
- Complete `event_flags` table with RLS policies

## Solution

### Quick Fix (5 minutes)

Run the **CRITICAL_SCHEMA_FIXES.sql** file:

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Click "New Query"
4. Copy/paste contents of `CRITICAL_SCHEMA_FIXES.sql`
5. Click "Run"

This will:
- Add the 3 missing columns to `events` table
- Add the 1 missing column to `club_members` table
- Create the `event_flags` table with basic RLS policies

### What's NOT Included (Can Add Later)

The minimal fix does NOT include:
- Performance indexes (idx_events_category, idx_events_is_free, etc.)
- Complex constraints (price validation when is_free=false)
- Advanced RLS policies for club_members approval workflow
- Indexes on event_flags table

These can be added from `APPLY_THIS_TO_SUPABASE.sql` after the app is working.

## Verification Steps

After running the SQL script:

1. **Check events table:**
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'events'
   AND column_name IN ('category', 'is_free', 'price');
   ```
   Should return 3 rows.

2. **Check club_members table:**
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'club_members'
   AND column_name = 'status';
   ```
   Should return 1 row.

3. **Check event_flags table:**
   ```sql
   SELECT COUNT(*) FROM information_schema.tables
   WHERE table_name = 'event_flags' AND table_schema = 'public';
   ```
   Should return 1.

## Expected Behavior After Fix

### Creating Events
- API will successfully insert events with category, is_free, and price
- No more "column does not exist" errors
- Events will display with pricing and category filters

### Joining Clubs
- API will successfully insert club_members with status='pending'
- Members will need approval from club admin
- No more "column does not exist" errors

### Creating Clubs
- Club creator is automatically added as admin with status='approved' (DEFAULT value)
- This is why we set DEFAULT 'approved' - so club creators don't get errors
- Regular members joining use status='pending' explicitly in the API code

### Flagging Events
- API will successfully create event_flags records
- Users can report inappropriate events
- Event creators can review and respond to flags

## API Code Analysis

### Club Creation (`POST /api/clubs`)
The API creates a club, then automatically adds the creator as admin (lines 289-295):
```typescript
await supabase.from('club_members').insert({
  club_id: club.id,
  user_id: user.id,
  role: 'admin'
  // NOTE: status is NOT specified here, will use DEFAULT value
});
```

**Why DEFAULT 'approved' is critical:**
- The API code doesn't explicitly set `status` when adding the club creator
- If we used DEFAULT 'pending', club creators would need to approve themselves (broken UX)
- With DEFAULT 'approved', club creators are instantly approved (correct behavior)

### Event Creation (`POST /api/events`)
The API attempts to insert these fields (lines 200-212):
```typescript
{
  title, description, event_date, location, club_id, created_by,
  category: category || null,
  is_free: isFree,
  price: !isFree && price ? price : null
}
```

Without the columns, Supabase returns: `column "category" of relation "events" does not exist`

### Club Membership (`POST /api/clubs/[id]/membership`)
The API attempts to insert these fields (lines 109-115):
```typescript
{
  club_id: clubId,
  user_id: user.id,
  role: 'member',
  status: 'pending'
}
```

Without the column, Supabase returns: `column "status" of relation "club_members" does not exist`

### Event Flagging (`POST /api/events/[id]/flag`)
The API attempts to insert into event_flags (lines 126-136):
```typescript
{
  event_id: id,
  user_id: user.id,
  reason,
  details: details || null,
  status: 'pending'
}
```

Without the table, Supabase returns: `relation "event_flags" does not exist`

## Files Reference

- **Minimal Fix:** `CRITICAL_SCHEMA_FIXES.sql` (run this first)
- **Complete Schema:** `APPLY_THIS_TO_SUPABASE.sql` (comprehensive, includes indexes and advanced policies)
- **API Routes:**
  - `/app/api/events/route.ts` (event creation)
  - `/app/api/clubs/[id]/membership/route.ts` (club joining)
  - `/app/api/events/[id]/flag/route.ts` (event flagging)
- **Type Definitions:** `/lib/types/database.ts` (already includes all new types)

## Migration History

- `001_initial_schema.sql` - Base tables (clubs, events, club_members, event_registrations)
- `002_fix_rls_infinite_recursion.sql` - Fixed RLS policy issues
- `003_add_event_categories_pricing.sql` - Added category, is_free, price (NOT APPLIED YET)
- **Missing:** event_flags table creation
- **Missing:** club_members.status column

## Recommendation

1. Run `CRITICAL_SCHEMA_FIXES.sql` immediately to fix the 500 errors
2. Test event creation and club joining
3. Once stable, run the rest of `APPLY_THIS_TO_SUPABASE.sql` for indexes and constraints
4. Monitor Supabase logs for any remaining RLS policy issues

## Support

If you still get errors after running the fix:
1. Check Supabase Dashboard > Logs for specific error messages
2. Verify all columns exist using the verification queries above
3. Check that RLS is enabled on event_flags table
4. Ensure your user is authenticated when making API requests
