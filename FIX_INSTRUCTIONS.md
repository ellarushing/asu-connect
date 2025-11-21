# Fix Instructions for Infinite Recursion and Event Creation Issues

## Overview

Two issues have been identified and fixed:
1. Infinite recursion in `club_members` RLS policies
2. Event creation permission checking

## Step-by-Step Fix

### 1. Apply Database Migration

Go to Supabase Dashboard:
- URL: https://supabase.com/dashboard/project/odyaxynwsdtbypocsuho
- Navigate to: **SQL Editor**

Copy and run the migration file:
- Location: `supabase/migrations/022_fix_club_members_infinite_recursion.sql`
- Action: Copy entire file contents → Paste in SQL Editor → Click "Run"

### 2. Verify Your Club Membership

Run this query to check your role in the "Test 1" club:

```sql
-- Replace with your actual email
SELECT
    cm.id,
    cm.role,
    cm.status,
    c.name as club_name,
    p.email as user_email,
    c.created_by = p.id as is_creator
FROM club_members cm
JOIN clubs c ON c.id = cm.club_id
JOIN profiles p ON p.id = cm.user_id
WHERE p.email = 'ellarushing2022@gmail.com'
  AND c.name = 'Test 1';
```

Expected results:
- `role` should be `'admin'`
- `status` should be `'approved'`
- `is_creator` should be `true` (if you created the club)

### 3. Fix Your Role (if needed)

If your role is not 'admin', run this:

```sql
UPDATE club_members
SET role = 'admin', status = 'approved'
WHERE user_id = (
  SELECT id FROM profiles WHERE email = 'ellarushing2022@gmail.com'
)
AND club_id = (
  SELECT id FROM clubs WHERE name = 'Test 1'
);
```

### 4. Verify Fix

After applying migration and updating role, test:
1. Refresh your Next.js app (port 3008)
2. Navigate to the "Test 1" club page
3. Verify:
   - Members list loads without errors
   - "Create Event" button works
   - No "Internal server error" messages

## What Was Fixed

### Migration 022 Changes:

1. **Fixed Infinite Recursion**
   - Removed policy that queried `club_members` from within `club_members`
   - Replaced with policies that query `clubs` table instead
   - Split monolithic policy into specific operation policies

2. **Enhanced Event Creation**
   - Club creators can now create events (even without explicit admin role)
   - Club members with `role='admin'` can create events
   - Checks `status='approved'` to ensure active membership

3. **Maintained User Permissions**
   - Users can still join clubs themselves
   - Users can still leave clubs themselves
   - All users can view club members

## Technical Details

### Root Cause: Infinite Recursion

Migration 021 (rollback) created this problematic policy:

```sql
CREATE POLICY "Club admins can manage members" ON public.club_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm  -- ❌ Queries itself!
      WHERE cm.club_id = club_members.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'moderator')
    )
  );
```

When PostgreSQL evaluates this policy:
1. Policy checks → SELECT from club_members
2. SELECT triggers policy check → SELECT from club_members
3. Loop continues infinitely → Error: "infinite recursion detected"

### The Fix

Migration 022 replaces it with:

```sql
CREATE POLICY "Club creators can add members"
  ON public.club_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clubs  -- ✅ Queries different table!
      WHERE id = club_members.club_id
      AND created_by = auth.uid()
    )
    OR user_id = auth.uid()  -- Users can join themselves
  );
```

No circular dependency = no recursion.

## Troubleshooting

### If errors persist after applying migration:

1. **Check migration was applied:**
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations
   ORDER BY version DESC LIMIT 5;
   ```
   Should see version `022_fix_club_members_infinite_recursion`

2. **Check policies exist:**
   ```sql
   SELECT schemaname, tablename, policyname
   FROM pg_policies
   WHERE tablename = 'club_members';
   ```
   Should see:
   - "Club creators can add members"
   - "Club creators can update member roles"
   - "Club creators can remove members"
   - "Users can join clubs"
   - "Users can leave clubs"
   - "Users can view club members"

3. **Restart Next.js dev server:**
   - Stop the server (Ctrl+C)
   - Restart: `npm run dev`

### If event creation still fails:

1. **Verify you're the club creator OR have admin role:**
   ```sql
   SELECT
       c.name,
       c.created_by = auth.uid() as is_creator,
       cm.role as membership_role,
       cm.status as membership_status
   FROM clubs c
   LEFT JOIN club_members cm ON cm.club_id = c.id AND cm.user_id = auth.uid()
   WHERE c.id = 'YOUR_CLUB_ID';
   ```

2. **Check RLS policy is active:**
   ```sql
   SELECT * FROM pg_policies
   WHERE tablename = 'events'
   AND policyname = 'Authenticated users can create events';
   ```

## Contact

If issues persist, check:
- Browser console for additional errors
- Next.js terminal logs
- Supabase logs (Dashboard → Logs)
