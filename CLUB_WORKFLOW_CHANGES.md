# Club Creation & Approval Workflow - Implementation Summary

## Overview

This document summarizes all changes made to implement the proper club creation and approval workflow for ASU Connect.

## Requirements Implemented

✅ **Student leaders can create clubs** - Any authenticated user can now create clubs
✅ **Admin-created clubs are auto-approved** - Clubs created by admins are immediately visible to all users
✅ **Student-created clubs require approval** - Clubs created by students are pending until admin approval
✅ **Admin approval interface exists** - Admins can review and approve/reject clubs at `/admin/clubs/pending`

## Changes Made

### 1. API Route Updates

**File: `app/api/clubs/route.ts`**

#### CreateClubCommand Class (Lines 78-109)
- Added `approvalStatus` parameter to constructor
- Updated to accept `'pending' | 'approved'` status
- Modified `execute()` method to include `approval_status` in database insert

```typescript
// Before: Always created with default 'pending' status
constructor(clubData: ClubCreateInput, userId: string)

// After: Can specify approval status
constructor(clubData: ClubCreateInput, userId: string, approvalStatus: 'pending' | 'approved' = 'pending')
```

#### POST /api/clubs Endpoint (Lines 225-334)
- **REMOVED**: Admin-only restriction (lines 240-248)
- **ADDED**: Check if user is admin to determine approval status
- **ADDED**: Auto-approve logic for admin-created clubs
- **ADDED**: Enhanced response message indicating approval status

```typescript
// New logic:
const userIsAdmin = await isAdmin(user.id);
const approvalStatus = userIsAdmin ? 'approved' : 'pending';

// Pass approval status to command
const createCommand = new CreateClubCommand(
  { name: name.trim(), description: description?.trim() || null },
  user.id,
  approvalStatus  // ← New parameter
);
```

**Response Format:**
```json
{
  "club": { /* club data */ },
  "message": "Club created successfully and is now visible to all users",  // or "...pending admin approval"
  "requiresApproval": false  // true for students, false for admins
}
```

### 2. Page Updates

#### Club Creation Page
**File: `app/clubs/create/page.tsx`**

- **REMOVED**: Admin-only access check (lines 20-25)
- **REMOVED**: Import of `isAdmin` function
- Now allows all authenticated users to access the page

```typescript
// Before:
if (!userIsAdmin) {
  redirect('/clubs?error=Only administrators can create clubs');
}

// After: Removed entirely - only checks authentication
```

#### Clubs Listing Page
**File: `app/clubs/page.tsx`**

- **UPDATED**: "Create Club" button visibility
- Now shown to all authenticated users (not just admins)
- Updated tooltip text to indicate approval requirement

```typescript
// Before:
{userIsAdmin && (
  <Button>Create Club</Button>
)}

// After:
{isAuthenticated && (
  <Button>Create Club</Button>
)}

// Tooltip now shows:
// Admin: "Create a new club (will be auto-approved)"
// Student: "Create a new club (requires admin approval)"
```

### 3. Component Updates

#### Club Create Form
**File: `components/club-create-form.tsx`**

- **ADDED**: Success state management
- **ADDED**: Success message display with green alert
- **ADDED**: Icon imports (`AlertCircle`, `CheckCircle2`)
- **UPDATED**: Form submission to show success message before redirect
- **ADDED**: 2-second delay before redirect to show success message

```typescript
// New state:
const [success, setSuccess] = useState<string | null>(null);

// Success display:
{success && (
  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-start gap-2">
    <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" />
    <p className="text-green-800 text-sm">{success}</p>
  </div>
)}
```

### 4. Database Migration

**File: `supabase/migrations/023_allow_admin_auto_approve_clubs.sql`**

Updated the `clubs_insert` RLS policy to allow different behavior for admins vs students:

```sql
-- Old Policy (Restrictive):
CREATE POLICY clubs_insert ON clubs FOR INSERT
WITH CHECK (
    auth.uid() = created_by
    AND approval_status = 'pending'  -- ❌ Blocks admin auto-approval
);

-- New Policy (Flexible):
CREATE POLICY clubs_insert ON clubs FOR INSERT
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

### 5. Documentation

**Created Files:**
- `MIGRATION_INSTRUCTIONS.md` - Step-by-step migration guide
- `CLUB_WORKFLOW_CHANGES.md` - This summary document

## User Flows

### Student Club Creation Flow

1. Student logs in and navigates to `/clubs`
2. Clicks "Create Club" button (visible to all authenticated users)
3. Fills out club creation form
4. Submits form
5. Sees success message: "Club created successfully and is pending admin approval"
6. Redirected to club detail page (can view their own pending club)
7. Club is NOT visible to other students until approved
8. Club appears in admin's pending clubs list at `/admin/clubs/pending`

### Admin Club Creation Flow

1. Admin logs in and navigates to `/clubs`
2. Clicks "Create Club" button
3. Fills out club creation form
4. Submits form
5. Sees success message: "Club created successfully and is now visible to all users"
6. Redirected to club detail page
7. Club is IMMEDIATELY visible to all students
8. Club does NOT appear in pending clubs list (already approved)

### Admin Approval Flow

1. Admin navigates to `/admin/clubs/pending`
2. Sees list of all pending clubs with:
   - Club name
   - Description
   - Creator email
   - Created date
3. Clicks "View Details" on a club
4. Reviews club information
5. Options:
   - **Approve**: Sets `approval_status = 'approved'`, logs action, makes visible to all
   - **Reject**: Sets `approval_status = 'rejected'`, requires reason, logs action
6. Action is logged in `moderation_logs` table for audit trail

## Database Schema Changes

### clubs Table
- `approval_status` - TEXT ('pending' | 'approved' | 'rejected')
- `approved_by` - UUID (admin who approved/rejected)
- `approved_at` - TIMESTAMP (when action was taken)
- `rejection_reason` - TEXT (if rejected)

### RLS Policies

#### clubs_select_approved
Determines who can see which clubs:
```sql
approval_status = 'approved'      -- Everyone sees approved clubs
OR created_by = auth.uid()        -- Creators see their own clubs
OR is_admin(auth.uid())          -- Admins see all clubs
```

#### clubs_insert (NEW)
Determines who can create clubs and with what status:
```sql
auth.uid() = created_by           -- Must be creator
AND (
    -- Students: must use 'pending'
    (NOT is_admin(auth.uid()) AND approval_status = 'pending')
    OR
    -- Admins: can use 'pending' or 'approved'
    (is_admin(auth.uid()) AND approval_status IN ('pending', 'approved'))
)
```

## API Endpoints

### For Users

**POST /api/clubs**
- **Auth Required**: Yes (any authenticated user)
- **Creates**: New club with appropriate approval status
- **Returns**: Club data, message, and requiresApproval flag

**GET /api/clubs**
- **Auth Required**: No
- **Returns**: All approved clubs + user's own clubs + all clubs if admin
- **Filtered by**: RLS policies at database level

**GET /api/clubs/[id]**
- **Auth Required**: No (but limited by RLS)
- **Returns**: Single club details
- **Visibility**: Based on approval status and user role

### For Admins

**GET /api/admin/clubs/pending**
- **Auth Required**: Yes (admin only)
- **Returns**: List of pending clubs with creator info
- **Pagination**: 50 per page

**POST /api/admin/clubs/[id]/approve**
- **Auth Required**: Yes (admin only)
- **Action**: Approves club, makes visible to all
- **Logs**: Action in moderation_logs

**POST /api/admin/clubs/[id]/reject**
- **Auth Required**: Yes (admin only)
- **Action**: Rejects club with reason
- **Requires**: Rejection reason (0-500 chars)
- **Logs**: Action in moderation_logs

## Testing Checklist

### Before Migration
- [ ] Verify Supabase connection is working
- [ ] Backup database (optional but recommended)
- [ ] Note current number of clubs in database

### Migration
- [ ] Apply migration 023 using Supabase Dashboard or CLI
- [ ] Verify no errors in migration execution
- [ ] Check that `clubs_insert` policy was updated

### After Migration - Student Tests
- [ ] Log in as student (non-admin)
- [ ] Can access `/clubs/create` page
- [ ] Can submit club creation form
- [ ] See "pending admin approval" success message
- [ ] Can view own pending club
- [ ] Pending club NOT visible to other students
- [ ] Pending club appears in admin's pending list

### After Migration - Admin Tests
- [ ] Log in as admin
- [ ] Can access `/clubs/create` page
- [ ] Can submit club creation form
- [ ] See "now visible to all users" success message
- [ ] Club immediately visible to all students
- [ ] Club does NOT appear in pending list
- [ ] Can access `/admin/clubs/pending`
- [ ] Can see student-created pending clubs
- [ ] Can approve a club successfully
- [ ] Can reject a club with reason
- [ ] Actions logged in moderation logs

## Files Modified Summary

```
Modified:
├── app/
│   ├── api/clubs/route.ts                    (API logic)
│   ├── clubs/page.tsx                        (UI - button visibility)
│   └── clubs/create/page.tsx                 (UI - access control)
├── components/club-create-form.tsx           (UI - success messages)
└── supabase/migrations/
    └── 023_allow_admin_auto_approve_clubs.sql (Database - RLS policy)

Created:
├── MIGRATION_INSTRUCTIONS.md                 (How to apply migration)
└── CLUB_WORKFLOW_CHANGES.md                  (This document)
```

## Security Considerations

### Row Level Security (RLS)
- All club visibility is enforced at database level via RLS
- Cannot bypass by direct API calls - database rejects unauthorized queries
- Admins have elevated permissions but all actions are logged

### Audit Trail
- All approval/rejection actions logged to `moderation_logs`
- Includes: admin_id, action, entity_id, timestamp, details
- Cannot be modified or deleted by non-admin users
- Provides complete history of moderation actions

### Input Validation
- Club name: Required, 1-255 characters
- Description: Optional, 0-1000 characters
- Approval status: Validated against enum ('pending' | 'approved' | 'rejected')
- Rejection reason: Required for rejections, max 500 characters

## Performance Considerations

- **Indexes**: Existing index on `approval_status` (from migration 004)
- **RLS Queries**: Optimized with function `is_admin()` which is cached
- **Pagination**: Admin pending list uses limit/offset pagination (50 per page)
- **Cascading Deletes**: Club deletion cascades to members and events

## Known Limitations

1. **No bulk approval**: Admins must approve clubs one at a time
2. **No notification system**: Creators not automatically notified of approval/rejection
3. **No appeal process**: Rejected clubs cannot be re-submitted (must create new)
4. **No draft status**: Clubs are submitted immediately (no save-as-draft)

## Future Enhancements

- Add email notifications for approval/rejection
- Implement bulk approval for admins
- Add draft status for clubs
- Allow editing of rejected clubs and resubmission
- Add club categories or tags
- Implement club verification badges

## Support & Troubleshooting

See `MIGRATION_INSTRUCTIONS.md` for detailed troubleshooting steps.

Common issues:
1. **"Failed to create club"** - Verify migration was applied
2. **"Permission denied"** - Check RLS policies in Supabase dashboard
3. **Admin created club is pending** - Verify `is_admin = true` in profiles table
4. **Can't see pending clubs** - Verify admin status and RLS policies

---

**Migration Date**: 2025-11-19
**Implemented By**: Claude Code (AI Assistant)
**Status**: Ready for testing
