# Student Leader Role Implementation

## ✅ Implementation Complete!

The student leader role system has been successfully implemented. Regular students can no longer create clubs - only student leaders and admins have this permission.

---

## What Changed

### User Roles
The system now supports 3 distinct user roles:

1. **Student** (Default)
   - Can join clubs
   - Can register for events
   - Can view content
   - **CANNOT create clubs or events**

2. **Student Leader**
   - All student permissions
   - **CAN create clubs** (requires admin approval)
   - **CAN create events** (when they are a club admin)
   - Can manage their clubs

3. **Admin** (Platform Admin)
   - All student leader permissions
   - Created clubs are **auto-approved**
   - Can approve/reject clubs
   - Can moderate content
   - Can promote users to student leader

---

## Files Created/Modified

### New Database Migrations
1. **`supabase/migrations/024_add_student_leader_role.sql`**
   - Adds `role` enum column to `profiles` table
   - Migrates existing admins to 'admin' role
   - Creates trigger to sync `is_admin` with `role`
   - Creates index for performance

2. **`supabase/migrations/025_update_rls_for_student_leaders.sql`**
   - Updates RLS policies for club creation
   - Enforces student leader requirement at database level

### Updated Files
1. **`lib/auth/admin.ts`**
   - Added `UserRole` enum
   - Added `getUserRole()` function
   - Added `isStudentLeader()` function
   - Added `canCreateClubs()` function
   - Added `canCreateEvents()` function

2. **`app/api/clubs/route.ts`**
   - Added student leader check before allowing club creation
   - Returns 403 error for regular students

3. **`app/clubs/create/page.tsx`**
   - Checks if user can create clubs
   - Redirects regular students with message

4. **`app/clubs/page.tsx`**
   - "Create Club" button only visible to student leaders and admins
   - Updated tooltip to show approval requirements

---

## How to Apply

### Step 1: Apply Database Migrations

Run these in your Supabase SQL Editor in order:

```sql
-- 1. Apply migration 024 (add role column)
-- Copy and paste contents of:
-- supabase/migrations/024_add_student_leader_role.sql

-- 2. Verify the migration worked
SELECT role, COUNT(*) as count
FROM profiles
GROUP BY role;
-- Should show: admin (X), student (Y)

-- 3. Apply migration 025 (update RLS policies)
-- Copy and paste contents of:
-- supabase/migrations/025_update_rls_for_student_leaders.sql

-- 4. Verify policies updated
SELECT policyname, tablename
FROM pg_policies
WHERE tablename = 'clubs';
```

### Step 2: Restart Your Development Server

The code changes are complete, but you need to restart:

```bash
# Stop server (Ctrl+C)
# Clear cache
rm -rf .next
# Restart
npm run dev
```

### Step 3: Test the Implementation

**As a Regular Student:**
- ❌ Should NOT see "Create Club" button on `/clubs`
- ❌ Cannot access `/clubs/create` (redirected)
- ❌ Cannot POST to `/api/clubs` (403 error)

**As a Student Leader (after promotion):**
- ✅ Can see "Create Club" button
- ✅ Can create clubs (status: pending)
- ✅ Clubs require admin approval
- ✅ Can create events (when club admin)

**As an Admin:**
- ✅ All student leader permissions
- ✅ Created clubs auto-approved
- ✅ Can promote users to student leader (future feature)

---

## How to Promote Users to Student Leader

### Option 1: Direct SQL (Current Method)

```sql
-- Promote a user by email
UPDATE profiles
SET role = 'student_leader'
WHERE email = 'student@asu.edu';

-- Promote multiple users
UPDATE profiles
SET role = 'student_leader'
WHERE email IN ('leader1@asu.edu', 'leader2@asu.edu', 'leader3@asu.edu');

-- Verify
SELECT email, role
FROM profiles
WHERE role = 'student_leader';
```

### Option 2: Admin UI (Future Enhancement)

A user management interface can be added to `/admin/users` where admins can:
- View all users
- Change user roles with dropdown
- See role statistics
- Log role changes

*(This feature is planned but not yet implemented)*

---

## Permission Matrix

| Action | Student | Student Leader | Admin |
|--------|---------|----------------|-------|
| View Clubs | ✅ | ✅ | ✅ |
| Join Clubs | ✅ | ✅ | ✅ |
| View Events | ✅ | ✅ | ✅ |
| Register for Events | ✅ | ✅ | ✅ |
| **Create Clubs** | ❌ | ✅ (pending) | ✅ (auto-approved) |
| **Create Events** | ❌ | ✅ (in their clubs) | ✅ |
| Manage Clubs | ❌ | ✅ (their clubs) | ✅ |
| Approve Members | ❌ | ✅ (their clubs) | ✅ |
| Post Announcements | ❌ | ✅ (their clubs) | ✅ |
| Moderate Content | ❌ | ❌ | ✅ |
| Approve Clubs | ❌ | ❌ | ✅ |
| Promote Users | ❌ | ❌ | ✅ |

---

## Technical Details

### Database Schema

```sql
-- profiles table now has:
ALTER TABLE profiles
ADD COLUMN role user_role DEFAULT 'student' NOT NULL;

-- Enum definition:
CREATE TYPE user_role AS ENUM ('student', 'student_leader', 'admin');

-- Auto-sync trigger keeps is_admin in sync with role
CREATE TRIGGER profiles_sync_is_admin
    BEFORE INSERT OR UPDATE OF role ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_is_admin_with_role();
```

### RLS Policies

```sql
-- Club creation policy
CREATE POLICY clubs_insert ON clubs FOR INSERT
WITH CHECK (
    auth.uid() = created_by
    AND (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'student_leader'
        AND approval_status = 'pending'
    )
    OR
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
        AND approval_status IN ('pending', 'approved')
    )
);
```

### Authorization Functions

```typescript
// Check if user can create clubs
const canCreate = await canCreateClubs(userId);

// Check if user can create events
const canCreate = await canCreateEvents(userId, clubId);

// Get user's role
const role = await getUserRole(userId);

// Check if user is student leader or admin
const isLeader = await isStudentLeader(userId);
```

---

## Error Messages

Users will see clear error messages:

- **Regular students trying to create clubs:**
  ```
  "Only student leaders and admins can create clubs.
   Please contact an administrator to become a student leader."
  ```

- **Students accessing `/clubs/create`:**
  ```
  Redirected to /clubs with message:
  "Only student leaders and admins can create clubs"
  ```

---

## Testing Checklist

After applying migrations and restarting:

### Database Level
- [ ] `profiles` table has `role` column
- [ ] Existing admins have role = 'admin'
- [ ] New users default to role = 'student'
- [ ] RLS policy updated for `clubs_insert`

### Application Level
- [ ] Regular students don't see "Create Club" button
- [ ] Regular students redirected from `/clubs/create`
- [ ] Regular students get 403 on API call
- [ ] Student leaders can access club creation
- [ ] Student leaders' clubs are pending
- [ ] Admin clubs are auto-approved

### Promote Test User
- [ ] Run SQL to promote a test user to student_leader
- [ ] User can now see "Create Club" button
- [ ] User can create clubs successfully
- [ ] Created club shows "Pending approval" status

---

## Rollback Plan

If you need to rollback:

```sql
-- Rollback step 1: Remove policies
DROP POLICY IF EXISTS clubs_insert ON clubs;

-- Rollback step 2: Restore old policy (from migration 023)
CREATE POLICY clubs_insert ON clubs FOR INSERT
WITH CHECK (
    auth.uid() = created_by
    AND (
        (NOT is_admin(auth.uid()) AND approval_status = 'pending')
        OR
        (is_admin(auth.uid()) AND approval_status IN ('pending', 'approved'))
    )
);

-- Rollback step 3: Remove role column (optional - will lose role data)
ALTER TABLE profiles DROP COLUMN IF EXISTS role;
DROP TYPE IF EXISTS user_role CASCADE;
```

---

## Next Steps

1. **Apply migrations** in Supabase SQL Editor
2. **Restart dev server** to load new code
3. **Test with a regular student** account
4. **Promote trusted users** to student leader role
5. **Optional**: Build admin UI for user role management

---

## Benefits of This Implementation

✅ **Security**: Enforced at both API and database level (RLS)
✅ **Clear Roles**: Three distinct user types with different permissions
✅ **Backward Compatible**: Maintains `is_admin` field via trigger
✅ **Flexible**: Easy to add more roles in the future
✅ **Auditable**: All role changes can be logged
✅ **User Friendly**: Clear error messages guide users

---

## Future Enhancements

- Admin UI for user role management (`/admin/users`)
- Self-service student leader applications
- Role expiration dates
- Club-specific leader roles
- Delegation of specific permissions

---

**Status**: ✅ Ready for deployment
**Tested**: Pending user testing after migration
**Documentation**: Complete
