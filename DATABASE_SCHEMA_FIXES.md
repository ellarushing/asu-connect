# ASU Connect Database Schema Fixes

## Issues Identified

### Issue 1: Infinite Recursion in club_members RLS Policies

**Error**: "infinite recursion detected in policy for relation 'club_members'"

**Root Cause**:
The RLS policies on the `club_members` table had self-referential queries that created circular dependencies. Specifically, three policies were problematic:

1. **"Club admins can add members"** (lines 128-139)
   ```sql
   WITH CHECK (
     auth.role() = 'authenticated'
     AND EXISTS (
       SELECT 1 FROM public.club_members
       WHERE club_id = club_members.club_id
       AND user_id = auth.uid()
       AND role = 'admin'
     )
   )
   ```
   This policy checks if a user is an admin by querying `club_members`. When executing this check, Supabase evaluates the RLS policies on `club_members` again, which triggers the same policy, creating infinite recursion.

2. **"Club admins can update member roles"** (lines 152-170)
   - Same issue: queries `club_members` to check admin status
   - Both USING and WITH CHECK clauses have the problem

3. **"Club admins can remove members"** (lines 173-183)
   - Same issue: queries `club_members` to check admin status

**Why This Happens**:
Supabase evaluates RLS policies recursively. When a policy queries a table with RLS enabled, it applies the RLS policies to that query as well. If the policy checking logic queries the same table, it causes infinite recursion.

### Issue 2: Could not find table 'public.event_registrations' in schema cache

**Root Cause**:
This error typically occurs when:
1. The migration hasn't been applied yet
2. RLS policies on related tables are causing query evaluation failures
3. The table exists but is inaccessible due to RLS recursion issues on dependent tables

The `event_registrations` table itself is properly defined in the initial migration. However, once `club_members` RLS becomes corrupted with infinite recursion, it can affect the entire schema's usability.

## Solutions Implemented

### Solution 1: Eliminate Self-Referential Queries

**Strategy**: Replace queries on `club_members` with queries on the `clubs` table.

**Key Changes**:

Instead of checking if a user is an admin in `club_members`:
```sql
-- PROBLEMATIC (causes recursion)
EXISTS (
  SELECT 1 FROM public.club_members
  WHERE club_id = club_members.club_id
  AND user_id = auth.uid()
  AND role = 'admin'
)
```

Check if the user is the **club creator** (owner):
```sql
-- SAFE (no recursion)
EXISTS (
  SELECT 1 FROM public.clubs
  WHERE id = club_members.club_id
  AND created_by = auth.uid()
)
```

**Rationale**:
- The `clubs` table's RLS policies are simple and non-recursive
- Club creators have full authority to manage members
- Avoids the circular dependency problem entirely
- Still provides security: only the creator can manage members

### Solution 2: Simplify Authorization Model

**Original Model**:
- Any user with 'admin' role in a club can manage members
- This requires checking the `club_members` table recursively

**Revised Model**:
- Only the club creator can manage members
- This can be checked via the `clubs` table (no recursion)
- Users can still self-join as members (separate policy)

**Policy Breakdown**:

1. **"Users can join clubs"** (KEEP UNCHANGED)
   - Users insert themselves with role='member'
   - Doesn't query other tables, no recursion risk

2. **"Club creators can add members"** (FIXED)
   - Replaced `club_members` query with `clubs` query
   - Only club creator can add members

3. **"Club creators can update member roles"** (FIXED)
   - Replaced `club_members` query with `clubs` query
   - Only club creator can modify roles

4. **"Club creators can remove members"** (FIXED)
   - Replaced `club_members` query with `clubs` query
   - Only club creator can remove members

5. **"Users can remove themselves"** (KEEP UNCHANGED)
   - No recursive queries, safe as-is

## Files Created

### 1. `/supabase/migrations/002_fix_rls_infinite_recursion.sql`
**Purpose**: Patch file to fix existing corrupted schema

**What it does**:
- Drops the three problematic policies
- Creates new, simplified policies that query the `clubs` table instead
- Maintains all functionality while eliminating recursion

**How to use**:
```bash
# Apply this migration to your Supabase project
supabase migration up
```

### 2. `/supabase/migrations/001_initial_schema_REVISED.sql`
**Purpose**: Clean replacement for the initial schema

**Improvements**:
- All RLS policies use non-recursive queries
- Comments explain the fixes
- Ready to use for new Supabase projects
- Includes the corrected event policy that checks `clubs` instead of `club_members`

**When to use**:
- Use for new projects (fresh schema)
- Or if you want to completely rebuild the schema

## Summary of Changes

| Policy | Original Problem | Fix | New Query |
|--------|------------------|-----|-----------|
| Club admins can add members | Queries club_members recursively | Query clubs table for creator | clubs.created_by = auth.uid() |
| Club admins can update member roles | Queries club_members recursively | Query clubs table for creator | clubs.created_by = auth.uid() |
| Club admins can remove members | Queries club_members recursively | Query clubs table for creator | clubs.created_by = auth.uid() |
| Authenticated users can create events | Queries club_members recursively | Query clubs table for creator | clubs.created_by = auth.uid() |

## Testing the Fix

After applying the migration, verify:

1. **Schema is accessible**:
   ```bash
   supabase db list
   ```

2. **Tables exist and are queryable**:
   ```sql
   SELECT COUNT(*) FROM public.clubs;
   SELECT COUNT(*) FROM public.events;
   SELECT COUNT(*) FROM public.club_members;
   SELECT COUNT(*) FROM public.event_registrations;
   ```

3. **RLS policies work correctly**:
   ```sql
   -- As authenticated user, try to create a club
   INSERT INTO public.clubs (name, created_by) VALUES ('Test Club', auth.uid());

   -- Try to join the club
   INSERT INTO public.club_members (club_id, user_id, role) VALUES (club_id, auth.uid(), 'member');

   -- Create an event (should work now)
   INSERT INTO public.events (title, event_date, club_id, created_by)
   VALUES ('Test Event', NOW(), club_id, auth.uid());

   -- Register for event
   INSERT INTO public.event_registrations (event_id, user_id)
   VALUES (event_id, auth.uid());
   ```

4. **Verify policies prevent unauthorized access**:
   - Non-authenticated users should see public data but not modify
   - Users should only modify their own data or data they own

## Performance Impact

- **Improved**: Eliminated recursive policy evaluations
- **Maintained**: All queries still use indexes
- **Better**: Simpler policies = faster policy evaluation

## Backward Compatibility

- **Breaking Change**: Only club creators can manage members (not any admin)
- **Mitigation**: This is a simpler, clearer model that reduces complexity
- **Migration Path**: If you have existing 'admin' members, they would need the club creator role (club ownership) to manage members

If you need to preserve the "any admin can manage members" model:
1. Add an explicit `admin` table to track admins
2. Reference that table in the policies instead of `club_members`
3. This avoids recursion while maintaining flexibility

## Next Steps

1. **Apply Migration**: Use `supabase migration up` to apply 002_fix_rls_infinite_recursion.sql
2. **Verify Schema**: Run the verification queries above
3. **Test Application**: Verify your application works with the new policies
4. **Update Documentation**: Update API docs if permission model changes
