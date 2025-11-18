# Flagging and Admin System Documentation

## Overview

This document describes the comprehensive flagging and admin moderation system implemented for ASU Connect. The system allows users to report inappropriate content (events and clubs) and provides administrators with tools to review and moderate flagged content and approve/reject clubs.

## Table of Contents

1. [Architecture](#architecture)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Frontend Components](#frontend-components)
5. [Admin Dashboard](#admin-dashboard)
6. [Setup Instructions](#setup-instructions)
7. [User Workflows](#user-workflows)
8. [Testing Guide](#testing-guide)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
├─────────────────────────────────────────────────────────────┤
│  User Components         │  Admin Components                 │
│  - EventFlagDialog       │  - Admin Dashboard                │
│  - ClubFlagDialog        │  - Flagged Content Page           │
│  - EventFlagsList        │  - Pending Clubs Page             │
│  - ClubFlagsList         │  - Admin Layout & Navigation      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        API Layer                             │
├─────────────────────────────────────────────────────────────┤
│  User Endpoints          │  Admin Endpoints                  │
│  - Flag Events           │  - View All Flags                 │
│  - Flag Clubs            │  - Moderate Flags                 │
│  - View Own Flags        │  - Approve/Reject Clubs           │
│  - Update Flag Status    │  - View Statistics                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Authorization Layer                        │
├─────────────────────────────────────────────────────────────┤
│  - Admin Utilities (isAdmin, requireAdmin)                   │
│  - Moderation Action Logging                                 │
│  - Access Control Helpers                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Tables:                                                     │
│  - event_flags          - club_flags                         │
│  - profiles (is_admin)  - moderation_logs                    │
│  - clubs (approval_status)                                   │
│                                                              │
│  RLS Policies, Triggers, Helper Functions                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

#### 1. `event_flags` (Already Existed)
Stores flags/reports for events.

```sql
CREATE TABLE event_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);
```

#### 2. `club_flags` (NEW)
Stores flags/reports for clubs.

```sql
CREATE TABLE club_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);
```

#### 3. `moderation_logs` (NEW)
Audit trail for all admin moderation actions.

```sql
CREATE TABLE moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Modified Tables

#### 4. `profiles` (MODIFIED)
Added admin flag.

```sql
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_profiles_is_admin ON profiles(is_admin);
```

#### 5. `clubs` (MODIFIED)
Added approval workflow columns.

```sql
ALTER TABLE clubs
  ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN rejection_reason TEXT;

CREATE INDEX idx_clubs_approval_status ON clubs(approval_status);
```

### Helper Functions

```sql
-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = user_uuid AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log moderation actions
CREATE OR REPLACE FUNCTION log_moderation_action(...)
RETURNS void AS $$
-- Implementation in migration file
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration File

**File:** `/supabase/migrations/004_admin_moderation_system.sql`

Run this migration to apply all database changes:
```bash
# If using Supabase CLI
supabase db push

# Or manually apply via Supabase Dashboard SQL Editor
```

---

## API Endpoints

### User Endpoints (Flag Management)

#### Event Flags

**`GET /api/events/[id]/flag`**
- Check if current user has flagged an event
- Returns: `{ hasFlagged: boolean }`
- Auth: Optional (returns false if not authenticated)

**`POST /api/events/[id]/flag`**
- Create a flag for an event
- Body: `{ reason: string, details?: string }`
- Returns: `{ flag: EventFlag, message: string }`
- Auth: Required

**`PATCH /api/events/[id]/flag`**
- Update flag status (event creator only)
- Body: `{ flag_id: string, status: string }`
- Returns: `{ flag: EventFlag, message: string }`
- Auth: Required (event creator)

**`GET /api/events/[id]/flags`**
- List all flags for an event (event creator only)
- Returns: `{ flags: [], event: { id, title } }`
- Auth: Required (event creator)

#### Club Flags

**`GET /api/clubs/[id]/flag`**
- Check if current user has flagged a club
- Returns: `{ hasFlagged: boolean }`
- Auth: Optional

**`POST /api/clubs/[id]/flag`**
- Create a flag for a club
- Body: `{ reason: string, details?: string }`
- Returns: `{ flag: ClubFlag, message: string }`
- Auth: Required

**`PATCH /api/clubs/[id]/flag`**
- Update flag status (club creator only)
- Body: `{ flag_id: string, status: string }`
- Returns: `{ flag: ClubFlag, message: string }`
- Auth: Required (club creator)

**`GET /api/clubs/[id]/flags`**
- List all flags for a club (club creator only)
- Returns: `{ flags: [], club: { id, name } }`
- Auth: Required (club creator)

### Admin Endpoints

#### Flag Management

**`GET /api/admin/flags`**
- Get all flags across the platform
- Query params: `status`, `type`, `limit`, `offset`
- Returns: Paginated list with statistics
- Auth: Admin required

**`GET /api/admin/flags/[id]`**
- Get detailed information about a specific flag
- Returns: Flag with entity and user details
- Auth: Admin required

**`PATCH /api/admin/flags/[id]`**
- Update flag status
- Body: `{ status: string, notes?: string }`
- Returns: Updated flag
- Auth: Admin required
- Logs: Moderation action

**`DELETE /api/admin/flags/[id]`**
- Dismiss flag (optionally delete entity)
- Query: `deleteEntity=true` to also delete flagged content
- Returns: Success message
- Auth: Admin required
- Logs: Moderation action

#### Club Approval

**`GET /api/admin/clubs/pending`**
- Get all clubs pending approval
- Query params: `limit`, `offset`
- Returns: Paginated list with statistics
- Auth: Admin required

**`POST /api/admin/clubs/[id]/approve`**
- Approve a club
- Returns: Updated club
- Auth: Admin required
- Logs: Moderation action

**`POST /api/admin/clubs/[id]/reject`**
- Reject a club
- Body: `{ reason: string }`
- Returns: Updated club
- Auth: Admin required
- Logs: Moderation action

#### Statistics

**`GET /api/admin/stats`**
- Get admin dashboard statistics
- Returns: Comprehensive stats including pending items, flags, clubs, recent activity
- Auth: Admin required

---

## Frontend Components

### User Components

#### `EventFlagDialog`
**File:** `/components/event-flag-dialog.tsx`

Modal dialog for flagging events.
- Props: `open`, `onOpenChange`, `eventId`, `onSuccess`
- Features: Reason dropdown, details textarea, validation

#### `ClubFlagDialog`
**File:** `/components/club-flag-dialog.tsx`

Modal dialog for flagging clubs.
- Props: `open`, `onOpenChange`, `clubId`, `onSuccess`
- Features: Identical to EventFlagDialog but for clubs

#### `EventFlagsList`
**File:** `/components/event-flags-list.tsx` (IMPROVED)

Displays and manages flags for event creators.
- Props: `eventId`, `onStatusUpdate`
- Features: List flags, update status, better error handling
- **Fix Applied:** No longer throws console errors on fetch failures

#### `ClubFlagsList`
**File:** `/components/club-flags-list.tsx`

Displays and manages flags for club creators.
- Props: `clubId`, `onStatusUpdate`
- Features: List flags, update status, status badges

### Admin Components

#### Admin Dashboard Layout
**File:** `/app/admin/layout.tsx`

Admin section layout with navigation sidebar.
- Features: Access control, admin navigation, user profile display
- Navigation items: Dashboard, Flagged Content, Pending Clubs, Logs

#### Admin Dashboard Home
**File:** `/app/admin/page.tsx`

Admin overview page with statistics.
- Features:
  - Pending items alerts
  - Quick stat cards (flags, clubs, approval rate)
  - Detailed flag statistics
  - Recent moderation activity
  - Quick action links

#### Flagged Content Review
**File:** `/app/admin/flags/page.tsx`

Page to review all flagged content.
- Features:
  - Filter by status and type
  - Search functionality
  - Flag cards with entity details
  - Inline status updates
  - Detailed view panel
  - Delete entity option
  - Pagination

#### Pending Clubs Approval
**File:** `/app/admin/clubs/pending/page.tsx`

Page to approve or reject clubs.
- Features:
  - List pending clubs
  - Club details view
  - Approve/reject actions
  - Rejection reason requirement
  - Optimistic UI updates
  - Pagination

### Navigation Integration

#### App Sidebar
**File:** `/components/app-sidebar.tsx` (MODIFIED)

Added admin dashboard link (visible to admins only).
- Location: Top section of sidebar
- Icon: ShieldCheck
- Link: `/admin`
- Conditional: Only shows if `isAdmin === true`

---

## Admin Dashboard

### Access Control

Admins are identified by the `is_admin` flag in the `profiles` table.

**To make a user an admin:**
```sql
UPDATE profiles SET is_admin = true WHERE email = 'admin@asu.edu';
```

**Authorization Utilities:**
- File: `/lib/auth/admin.ts`
- Functions: `isAdmin()`, `requireAdmin()`, `getCurrentAdmin()`, `checkAdminAccess()`

### Dashboard Features

#### Overview Statistics
- Total pending flags
- Total pending clubs
- Flag breakdown (event vs club)
- Approval rates
- Recent moderation activity

#### Flagged Content Management
- View all flags across platform
- Filter by status: Pending, Reviewed, Resolved, Dismissed
- Filter by type: Events, Clubs
- Search across entity titles, reasons, details
- Update flag status
- Delete flagged entities
- View complete flag history

#### Club Approval Workflow
- View all pending clubs
- See club details and creator info
- Approve clubs (makes them visible to users)
- Reject clubs with reason
- Track approval history

#### Moderation Logs
All admin actions are automatically logged to `moderation_logs` table with:
- Admin who performed action
- Action type
- Entity affected
- Timestamp
- Additional details (JSONB)

---

## Setup Instructions

### 1. Database Setup

Apply the migration:
```bash
# Option 1: Supabase CLI
cd /Users/ellarushing/Downloads/asu-connect
supabase db push

# Option 2: Manual application
# Copy contents of supabase/migrations/004_admin_moderation_system.sql
# Paste into Supabase Dashboard > SQL Editor > Run
```

### 2. Create an Admin User

```sql
-- In Supabase SQL Editor
UPDATE profiles
SET is_admin = true
WHERE email = 'your-email@asu.edu';
```

### 3. Verify Setup

1. Log in with the admin user
2. Check that "Admin Dashboard" link appears in sidebar
3. Navigate to `/admin` and verify access
4. Check that statistics load correctly

### 4. Environment Variables

No new environment variables required. The system uses existing Supabase configuration.

---

## User Workflows

### Flagging an Event

1. User navigates to event detail page
2. Clicks "Flag Event" button (red flag icon)
3. Selects reason from dropdown:
   - Inappropriate Content
   - Spam
   - Misinformation
   - Other
4. Optionally adds details
5. Submits flag
6. Button changes to "Event Flagged" (disabled)

### Flagging a Club

1. User navigates to club detail page
2. Clicks "Flag Club" button
3. Selects reason and adds details
4. Submits flag
5. Button changes to "Club Flagged" (disabled)

### Event/Club Creator: Managing Flags

1. Creator views their event/club detail page
2. Sees "Event/Club Flags" section below main content
3. Views all flags with reporter info
4. Can update flag status:
   - Mark as Reviewed
   - Resolve
   - Dismiss

### Admin: Reviewing Flagged Content

1. Admin navigates to `/admin/flags`
2. Views all flags across platform
3. Filters by status or type
4. Searches for specific content
5. Clicks on flag to view details
6. Takes action:
   - Review
   - Resolve
   - Dismiss
   - Delete entity (if necessary)
7. Action is logged to moderation_logs

### Admin: Approving Clubs

1. Admin navigates to `/admin/clubs/pending`
2. Views all pending clubs
3. Clicks on club to view details
4. Takes action:
   - **Approve:** Club becomes visible to all users
   - **Reject:** Club remains hidden, reason sent to creator
5. Action is logged to moderation_logs

---

## Testing Guide

### Manual Testing Checklist

#### User Flag Functionality
- [ ] Can flag an event
- [ ] Can flag a club
- [ ] Cannot flag same event/club twice
- [ ] Flag button disables after flagging
- [ ] All four reason options work
- [ ] Details field is optional

#### Creator Flag Management
- [ ] Event creator can see flags on their event
- [ ] Club creator can see flags on their club
- [ ] Can update flag status
- [ ] Status badges display correctly
- [ ] Non-creators cannot see flags list

#### Admin Dashboard Access
- [ ] Admin link appears for admin users
- [ ] Admin link hidden for non-admin users
- [ ] Non-admins cannot access `/admin`
- [ ] Non-admins redirected from admin pages

#### Admin Flag Management
- [ ] Can view all flags
- [ ] Status filter works
- [ ] Type filter works
- [ ] Search works
- [ ] Can update flag status
- [ ] Can delete entities
- [ ] Moderation actions are logged

#### Admin Club Approval
- [ ] Can view pending clubs
- [ ] Can approve clubs
- [ ] Can reject clubs (with reason)
- [ ] Approved clubs visible to users
- [ ] Rejected clubs hidden
- [ ] Actions are logged

#### Database Integrity
- [ ] Flags have unique constraint (one per user per entity)
- [ ] RLS policies enforce access control
- [ ] Triggers log moderation actions automatically
- [ ] Cascade deletes work properly

### Test Data Setup

```sql
-- Create a test admin
UPDATE profiles SET is_admin = true WHERE email = 'test-admin@asu.edu';

-- Create test flags (via UI preferred)
-- Or manually:
INSERT INTO event_flags (event_id, user_id, reason, details)
VALUES
  ('event-uuid', 'user-uuid', 'Spam', 'This is a test flag');

INSERT INTO club_flags (club_id, user_id, reason, details)
VALUES
  ('club-uuid', 'user-uuid', 'Inappropriate Content', 'Test club flag');

-- Check moderation logs
SELECT * FROM moderation_logs ORDER BY created_at DESC LIMIT 10;
```

### API Testing

Use curl or Postman to test endpoints:

```bash
# Get admin stats (must be authenticated as admin)
curl -X GET "http://localhost:3000/api/admin/stats" \
  -H "Cookie: your-auth-cookie"

# Flag an event
curl -X POST "http://localhost:3000/api/events/EVENT_ID/flag" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{"reason":"Spam","details":"Test flag"}'

# Get all flags (admin)
curl -X GET "http://localhost:3000/api/admin/flags?status=pending" \
  -H "Cookie: admin-auth-cookie"
```

---

## Error Handling Improvements

### Event Flags List Fix

**Issue:** Console error "Failed to fetch flags" when viewing events.

**Fix Applied:**
- Changed error handling in `event-flags-list.tsx` (line 56)
- Instead of throwing error, now sets error state
- Shows user-friendly error card with retry button
- Silent fail for missing database table (optional feature)
- Better error messages based on HTTP status codes

**File:** `/components/event-flags-list.tsx`

---

## Files Added/Modified

### New Files Created

#### Database
- `/supabase/migrations/004_admin_moderation_system.sql`

#### Authorization
- `/lib/auth/admin.ts`

#### API Routes
- `/app/api/admin/flags/route.ts`
- `/app/api/admin/flags/[id]/route.ts`
- `/app/api/admin/clubs/pending/route.ts`
- `/app/api/admin/clubs/[id]/approve/route.ts`
- `/app/api/admin/clubs/[id]/reject/route.ts`
- `/app/api/admin/stats/route.ts`
- `/app/api/clubs/[id]/flag/route.ts`
- `/app/api/clubs/[id]/flags/route.ts`

#### Admin Pages
- `/app/admin/layout.tsx`
- `/app/admin/page.tsx`
- `/app/admin/flags/page.tsx`
- `/app/admin/clubs/pending/page.tsx`

#### Components
- `/components/club-flag-dialog.tsx`
- `/components/club-flags-list.tsx`

### Modified Files

- `/components/event-flags-list.tsx` (improved error handling)
- `/components/app-sidebar.tsx` (added admin link)
- `/app/clubs/[id]/page.tsx` (integrated club flagging)
- `/lib/types/database.ts` (added club_flags types)

---

## Security Considerations

### Authentication & Authorization

1. **Admin Verification:** All admin endpoints use `requireAdmin()` which throws 401/403 on unauthorized access
2. **RLS Policies:** Database-level security ensures users can only access their own data
3. **Creator Authorization:** Flag management restricted to content creators
4. **Unique Constraints:** Prevents duplicate flags per user per entity
5. **Moderation Logging:** All admin actions tracked for accountability

### Data Protection

1. **Cascade Deletions:** Flags deleted when entity is deleted
2. **User Privacy:** Reporter emails only visible to creators and admins
3. **Input Validation:** Reason validation, details length limits
4. **SQL Injection Protection:** Supabase parameterized queries
5. **XSS Protection:** React auto-escapes user input

---

## Future Enhancements

Potential improvements for the future:

1. **Notifications:**
   - Email notifications when content is flagged
   - Notify creators when flags are resolved
   - Notify admins of new flags

2. **Analytics:**
   - Flag trends dashboard
   - User reputation scores
   - Automated moderation suggestions

3. **Advanced Moderation:**
   - User suspension/banning
   - Content auto-hiding at threshold
   - Appeals system
   - Bulk moderation actions

4. **Reporting:**
   - Export flags to CSV
   - Compliance reports
   - Moderation performance metrics

---

## Support

For issues or questions about the flagging and admin system:

1. Check this documentation
2. Review the code comments in implementation files
3. Test with the manual testing checklist
4. Check Supabase logs for errors

---

## Summary

The flagging and admin system provides a complete moderation workflow with:

✅ User reporting for events and clubs
✅ Content creator flag management
✅ Comprehensive admin dashboard
✅ Global flag moderation
✅ Club approval workflow
✅ Detailed audit logging
✅ Improved error handling
✅ Mobile-responsive design
✅ Full TypeScript type safety
✅ Database-level security (RLS)

All features are production-ready and follow the existing codebase patterns and best practices.
