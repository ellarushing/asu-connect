# Club Creation & Approval Migration Instructions

## What Changed

This migration implements the following requirements:

1. **Student leaders can now create clubs** - Previously only admins could create clubs
2. **Admin-created clubs are auto-approved** - When an admin creates a club, it's immediately visible to all users
3. **Student-created clubs require approval** - When a student creates a club, it's marked as pending and requires admin approval
4. **Admin approval interface exists** - Admins can review and approve/reject pending clubs at `/admin/clubs/pending`

## Files Modified

### API Routes
- `app/api/clubs/route.ts` - Updated POST endpoint to allow all authenticated users and auto-approve admin clubs

### UI Components
- `app/clubs/page.tsx` - Show "Create Club" button to all authenticated users
- `app/clubs/create/page.tsx` - Allow all authenticated users to access club creation page
- `components/club-create-form.tsx` - Show success messages based on approval status

### Database
- `supabase/migrations/023_allow_admin_auto_approve_clubs.sql` - Updated RLS policy to allow admin auto-approval

## Migration Steps

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard at https://supabase.com
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/023_allow_admin_auto_approve_clubs.sql`
5. Click **Run** to execute the migration
6. Verify the migration succeeded (you should see "Success. No rows returned")

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed and linked to your project:

```bash
# Make sure you're in the project root directory
cd /Users/ellarushing/Downloads/asu-connect

# Run the migration
supabase db push
```

### Option 3: Manual SQL Execution

If you prefer to connect directly to your database:

```sql
-- Copy and paste this SQL into your database client:

-- Drop the existing clubs_insert policy
DROP POLICY IF EXISTS clubs_insert ON clubs;

-- Create updated clubs_insert policy
CREATE POLICY clubs_insert
ON clubs
FOR INSERT
WITH CHECK (
    auth.uid() = created_by
    AND (
        -- Non-admins must use pending status
        (NOT is_admin(auth.uid()) AND approval_status = 'pending')
        OR
        -- Admins can use either pending or approved status
        (is_admin(auth.uid()) AND approval_status IN ('pending', 'approved'))
    )
);
```

## Verification

After applying the migration, verify everything works:

### 1. Test Student Club Creation
1. Log in as a regular student (non-admin)
2. Navigate to `/clubs`
3. Click "Create Club" button
4. Fill in club name and description
5. Submit the form
6. You should see: "Club created successfully and is pending admin approval"
7. The club should be visible to you but not to other students
8. The club should appear in the admin's pending clubs list at `/admin/clubs/pending`

### 2. Test Admin Club Creation
1. Log in as an admin user
2. Navigate to `/clubs`
3. Click "Create Club" button
4. Fill in club name and description
5. Submit the form
6. You should see: "Club created successfully and is now visible to all users"
7. The club should be immediately visible to all students
8. The club should NOT appear in the pending clubs list

### 3. Test Admin Approval Workflow
1. Log in as an admin
2. Navigate to `/admin/clubs/pending`
3. You should see any pending clubs created by students
4. Click "View Details" on a pending club
5. Click "Approve" or "Reject" with a reason
6. Verify the club status changes accordingly
7. If approved, verify the club becomes visible to all students

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Restore the original clubs_insert policy
DROP POLICY IF EXISTS clubs_insert ON clubs;

CREATE POLICY clubs_insert
ON clubs
FOR INSERT
WITH CHECK (
    auth.uid() = created_by
    AND approval_status = 'pending'
);
```

## Troubleshooting

### Error: "Failed to create club"
- Check that the migration was applied successfully
- Verify the `is_admin()` function exists in your database
- Check Supabase logs for detailed error messages

### Club not visible after creation (Admin)
- Verify the user is marked as admin in the `profiles` table (`is_admin = true`)
- Check that the migration was applied successfully
- Verify the club's `approval_status` is set to 'approved'

### Club not appearing in pending list (Student)
- Verify the club's `approval_status` is 'pending'
- Check that the admin has proper permissions
- Verify RLS policies are enabled on the clubs table

## Support

For issues or questions:
1. Check the Supabase logs in your dashboard
2. Review the RLS policies in Supabase dashboard > Authentication > Policies
3. Test using the Supabase SQL Editor to manually query the clubs table
