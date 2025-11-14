# ASU Connect - Testing Guide for New Features

## Overview

This guide provides comprehensive testing instructions for the three new features implemented in ASU Connect:

1. **Event Filters (Categories & Pricing)** - Filter events by category (Academic, Social, Sports, etc.) and pricing (free/paid)
2. **Event Flagging System** - Report inappropriate events for review by event creators
3. **Club Membership Approval Workflow** - Request to join clubs with admin approval process

These features enhance the platform by providing better event discovery, content moderation, and controlled club membership management.

---

## Prerequisites

Before testing these features, ensure you have:

- A running ASU Connect application (local development or deployed)
- At least 2 test user accounts (one for admin/creator role, one for member role)
- Access to Supabase dashboard for your project
- Database migrations applied (see next section)
- Basic understanding of REST API testing (using browser DevTools, Postman, or cURL)

---

## Database Setup

### Step 1: Apply SQL Migration

All three features require database schema changes. Apply the complete migration by following these steps:

1. Navigate to your Supabase project dashboard at https://supabase.com
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file `/Users/ellarushing/Downloads/asu-connect/APPLY_THIS_TO_SUPABASE.sql`
5. Copy the **entire contents** of the file
6. Paste into the Supabase SQL Editor
7. Click **Run** (or press Cmd+Enter / Ctrl+Enter)

### Step 2: Verify Schema Changes

After running the migration, verify the following changes:

**Events Table - New Columns:**
```sql
-- Check events table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'events'
AND column_name IN ('category', 'is_free', 'price');
```

Expected output:
- `category` - TEXT - YES
- `is_free` - BOOLEAN - NO
- `price` - NUMERIC(10,2) - YES

**New event_flags Table:**
```sql
-- Check event_flags table exists
SELECT * FROM information_schema.tables
WHERE table_name = 'event_flags';
```

**club_members Table - New Column:**
```sql
-- Check club_members has status column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'club_members'
AND column_name = 'status';
```

Expected output:
- `status` - TEXT - NO (with CHECK constraint for 'pending', 'approved', 'rejected')

### Step 3: Verify Indexes

Check that performance indexes were created:

```sql
-- Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('events', 'event_flags', 'club_members')
AND indexname IN ('idx_events_category', 'idx_events_is_free', 'idx_event_flags_event_id', 'idx_event_flags_status', 'idx_club_members_status');
```

---

## Feature 1: Event Filters (Categories & Pricing)

### Overview

This feature allows users to:
- Categorize events into 7 categories (Academic, Social, Sports, Arts, Career, Community Service, Other)
- Mark events as free or paid (with price)
- Filter events by category
- Filter events by pricing (free, paid, or all)

### Testing Event Creation with Category and Pricing

#### Test Case 1.1: Create Free Event with Category

**Steps:**
1. Log in as a club admin
2. Navigate to `/events/create`
3. Fill in the event form:
   - **Title:** "Study Group Session"
   - **Description:** "Join us for collaborative studying"
   - **Date:** Select a future date
   - **Time:** Select a time
   - **Location:** "Memorial Union Room 204"
   - **Club:** Select your club
   - **Category:** Select "Academic"
   - **Pricing:** Click "Free" button (should be selected by default)
4. Click "Create Event"

**Expected Behavior:**
- Form validates successfully
- Event is created and saved to database
- Redirected to `/events` page
- New event appears in the events list
- Event card shows:
  - Green "FREE" badge
  - Blue "Academic" category badge

**API Call:**
```bash
POST /api/events
Content-Type: application/json

{
  "title": "Study Group Session",
  "description": "Join us for collaborative studying",
  "event_date": "2025-12-15T14:00:00",
  "location": "Memorial Union Room 204",
  "club_id": "your-club-uuid",
  "category": "Academic",
  "is_free": true,
  "price": null
}
```

**Expected Response (201 Created):**
```json
{
  "event": {
    "id": "event-uuid",
    "title": "Study Group Session",
    "category": "Academic",
    "is_free": true,
    "price": null,
    "..."
  },
  "message": "Event created successfully"
}
```

#### Test Case 1.2: Create Paid Event with Price

**Steps:**
1. Log in as a club admin
2. Navigate to `/events/create`
3. Fill in the event form:
   - **Title:** "Annual Gala Dinner"
   - **Description:** "Formal dinner with guest speaker"
   - **Date:** Select a future date
   - **Time:** "18:00"
   - **Location:** "University Ballroom"
   - **Club:** Select your club
   - **Category:** Select "Social"
   - **Pricing:** Click "Paid" button
   - **Price:** Enter "25.00"
4. Click "Create Event"

**Expected Behavior:**
- Price input field appears when "Paid" is selected
- Form validates successfully
- Event is created
- Event card shows:
  - Blue "$25.00" badge
  - Blue "Social" category badge

**API Call:**
```bash
POST /api/events
Content-Type: application/json

{
  "title": "Annual Gala Dinner",
  "description": "Formal dinner with guest speaker",
  "event_date": "2025-12-20T18:00:00",
  "location": "University Ballroom",
  "club_id": "your-club-uuid",
  "category": "Social",
  "is_free": false,
  "price": 25.00
}
```

**Expected Response (201 Created):**
```json
{
  "event": {
    "id": "event-uuid",
    "title": "Annual Gala Dinner",
    "category": "Social",
    "is_free": false,
    "price": "25.00",
    "..."
  },
  "message": "Event created successfully"
}
```

#### Test Case 1.3: Validation - Paid Event Without Price

**Steps:**
1. Log in as a club admin
2. Navigate to `/events/create`
3. Fill in required fields
4. Click "Paid" button
5. Leave price field empty or enter "0"
6. Click "Create Event"

**Expected Behavior:**
- Client-side validation error: "Please enter a valid price greater than 0"
- Event is NOT created
- No API call is made

If price validation is bypassed:

**API Call:**
```bash
POST /api/events
{
  "title": "Test Event",
  "event_date": "2025-12-15T14:00:00",
  "club_id": "your-club-uuid",
  "is_free": false,
  "price": null
}
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Price is required for paid events"
}
```

#### Test Case 1.4: Validation - Invalid Category

**Steps:**
1. Attempt to create event with invalid category via API

**API Call:**
```bash
POST /api/events
{
  "title": "Test Event",
  "event_date": "2025-12-15T14:00:00",
  "club_id": "your-club-uuid",
  "category": "InvalidCategory"
}
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Invalid category. Must be one of: Academic, Social, Sports, Arts, Career, Community Service, Other"
}
```

### Testing Event Filtering

#### Test Case 1.5: Filter by Category

**Steps:**
1. Navigate to `/events` page
2. Click the "Category" dropdown (shows "Category: All" by default)
3. Select "Academic"

**Expected Behavior:**
- Events list refreshes
- Only events with category "Academic" are displayed
- Dropdown button now shows "Category: Academic"
- URL updates to include `?category=Academic`

**API Call:**
```bash
GET /api/events?sortBy=date&category=Academic&pricing=all
```

**Expected Response (200 OK):**
```json
{
  "events": [
    {
      "id": "...",
      "title": "Study Group Session",
      "category": "Academic",
      "..."
    }
  ],
  "sortBy": "date",
  "category": "Academic",
  "pricing": "all"
}
```

#### Test Case 1.6: Filter by Pricing - Free Events Only

**Steps:**
1. Navigate to `/events` page
2. In the pricing filter buttons (All/Free/Paid), click "Free"

**Expected Behavior:**
- Events list refreshes
- Only events with `is_free = true` are displayed
- "Free" button is highlighted (default variant)
- All displayed events show green "FREE" badge

**API Call:**
```bash
GET /api/events?sortBy=date&pricing=free
```

**Expected Response (200 OK):**
```json
{
  "events": [
    {
      "id": "...",
      "title": "Study Group Session",
      "is_free": true,
      "price": null,
      "..."
    }
  ],
  "sortBy": "date",
  "pricing": "free"
}
```

#### Test Case 1.7: Filter by Pricing - Paid Events Only

**Steps:**
1. Navigate to `/events` page
2. Click "Paid" button in pricing filter

**Expected Behavior:**
- Events list refreshes
- Only events with `is_free = false` are displayed
- "Paid" button is highlighted
- All displayed events show blue price badges (e.g., "$25.00")

**API Call:**
```bash
GET /api/events?sortBy=date&pricing=paid
```

**Expected Response (200 OK):**
```json
{
  "events": [
    {
      "id": "...",
      "title": "Annual Gala Dinner",
      "is_free": false,
      "price": "25.00",
      "..."
    }
  ],
  "sortBy": "date",
  "pricing": "paid"
}
```

#### Test Case 1.8: Combined Filters - Category + Pricing

**Steps:**
1. Navigate to `/events` page
2. Select "Social" from category dropdown
3. Click "Free" in pricing filter

**Expected Behavior:**
- Events list shows only free social events
- Both filters are reflected in UI
- URL: `?sortBy=date&category=Social&pricing=free`

**API Call:**
```bash
GET /api/events?sortBy=date&category=Social&pricing=free
```

**Expected Response (200 OK):**
```json
{
  "events": [
    {
      "id": "...",
      "title": "Game Night",
      "category": "Social",
      "is_free": true,
      "price": null,
      "..."
    }
  ],
  "sortBy": "date",
  "category": "Social",
  "pricing": "free"
}
```

#### Test Case 1.9: Reset Filters

**Steps:**
1. Apply any filters
2. Select "All Categories" from category dropdown
3. Click "All" in pricing filter

**Expected Behavior:**
- All events are displayed
- Filters are reset to default
- URL: `?sortBy=date&pricing=all`

### Edge Cases - Event Filters

#### Edge Case 1.1: No Events Match Filters

**Steps:**
1. Apply filters that have no matching events (e.g., "Sports" + "Paid")

**Expected Behavior:**
- Empty state is displayed
- Shows message: "No events found"
- Shows icon and "Create Event" button
- No error messages

#### Edge Case 1.2: Event Without Category

**Steps:**
1. Create event without specifying category (category = null)
2. View event in list

**Expected Behavior:**
- Event appears in "All Categories" view
- Event does NOT appear when filtering by specific category
- No category badge is shown on event card

#### Edge Case 1.3: Sort + Filter Combination

**Steps:**
1. Apply filters (e.g., "Academic" category)
2. Change sort order (e.g., "Sort by Name")

**Expected Behavior:**
- Events are filtered AND sorted correctly
- Strategy pattern applies sorting to filtered results
- Both filter and sort preferences are maintained

---

## Feature 2: Event Flagging System

### Overview

This feature allows users to:
- Flag events they find inappropriate or problematic
- Select from predefined reasons: Inappropriate Content, Spam, Misinformation, Other
- Provide additional details about the flag
- Event creators can view all flags for their events
- Event creators can update flag status: pending, reviewed, resolved, dismissed

### Testing Flag Creation (User Perspective)

#### Test Case 2.1: Flag an Event

**Steps:**
1. Log in as a regular user (not the event creator)
2. Navigate to an event detail page (e.g., `/events/[event-id]`)
3. Click the "Flag Event" or "Report" button
4. In the flag dialog:
   - **Reason:** Select "Spam"
   - **Additional Details:** "This event is being promoted multiple times with the same content"
5. Click "Submit Flag"

**Expected Behavior:**
- Dialog closes
- Success message appears (toast or alert)
- Flag button changes state (e.g., shows "Flagged" or disables)
- User cannot flag the same event again

**API Call:**
```bash
POST /api/events/{event-id}/flag
Content-Type: application/json

{
  "reason": "Spam",
  "details": "This event is being promoted multiple times with the same content"
}
```

**Expected Response (201 Created):**
```json
{
  "flag": {
    "id": "flag-uuid",
    "event_id": "event-uuid",
    "user_id": "user-uuid",
    "reason": "Spam",
    "details": "This event is being promoted multiple times with the same content",
    "status": "pending",
    "created_at": "2025-11-13T10:30:00Z",
    "..."
  },
  "message": "Event flagged successfully"
}
```

#### Test Case 2.2: Check if User Has Flagged Event

**Steps:**
1. Log in as a user
2. Navigate to an event detail page

**Expected Behavior:**
- UI checks if current user has already flagged this event
- If flagged: button shows "Flagged" and is disabled
- If not flagged: button shows "Flag Event" and is enabled

**API Call:**
```bash
GET /api/events/{event-id}/flag
```

**Expected Response (200 OK):**
```json
{
  "hasFlagged": true
}
```

or

```json
{
  "hasFlagged": false
}
```

#### Test Case 2.3: Validation - Missing Reason

**Steps:**
1. Open flag dialog
2. Leave reason unselected
3. Enter details
4. Click "Submit Flag"

**Expected Behavior:**
- Client-side validation error
- Error message: "Please select a reason for flagging this event"
- Form does not submit

#### Test Case 2.4: Duplicate Flag Prevention

**Steps:**
1. Flag an event successfully
2. Attempt to flag the same event again

**Expected Behavior:**
- Flag button is disabled or shows "Flagged"
- If user bypasses UI and calls API directly:

**API Call:**
```bash
POST /api/events/{event-id}/flag
{
  "reason": "Spam",
  "details": "Another flag"
}
```

**Expected Response (409 Conflict):**
```json
{
  "error": "You have already flagged this event"
}
```

### Testing Flag Management (Event Creator Perspective)

#### Test Case 2.5: View All Flags for Event

**Steps:**
1. Log in as the event creator
2. Navigate to your event detail page (e.g., `/events/[event-id]`)
3. Scroll to "Event Flags" section (if flags exist)

**Expected Behavior:**
- Section displays count of flags: "Event Flags (2)"
- Each flag shows:
  - Reason (e.g., "Spam")
  - Status badge (Pending, Reviewed, Resolved, Dismissed)
  - Reporter email (e.g., "user@asu.edu")
  - Created date
  - Additional details (if provided)
  - Action buttons (for pending flags)

**API Call:**
```bash
GET /api/events/{event-id}/flags
```

**Expected Response (200 OK):**
```json
{
  "flags": [
    {
      "id": "flag-uuid",
      "event_id": "event-uuid",
      "user_id": "user-uuid",
      "user_email": "user@asu.edu",
      "reason": "Spam",
      "details": "This event is being promoted multiple times",
      "status": "pending",
      "reviewed_by": null,
      "reviewer_email": null,
      "reviewed_at": null,
      "created_at": "2025-11-13T10:30:00Z",
      "updated_at": "2025-11-13T10:30:00Z"
    }
  ],
  "event": {
    "id": "event-uuid",
    "title": "Test Event"
  }
}
```

#### Test Case 2.6: Update Flag Status - Mark as Reviewed

**Steps:**
1. Log in as event creator
2. Navigate to event with pending flags
3. Find a flag with status "pending"
4. Click "Mark as Reviewed" button

**Expected Behavior:**
- Flag status updates to "reviewed"
- Status badge changes from "Pending" (yellow) to "Reviewed" (blue)
- Action buttons disappear
- Shows reviewer information and timestamp
- Success message appears

**API Call:**
```bash
PATCH /api/events/{event-id}/flag
Content-Type: application/json

{
  "flag_id": "flag-uuid",
  "status": "reviewed"
}
```

**Expected Response (200 OK):**
```json
{
  "flag": {
    "id": "flag-uuid",
    "status": "reviewed",
    "reviewed_by": "creator-uuid",
    "reviewed_at": "2025-11-13T11:00:00Z",
    "..."
  },
  "message": "Flag status updated successfully"
}
```

#### Test Case 2.7: Update Flag Status - Resolve

**Steps:**
1. View event with pending flag
2. Click "Resolve" button

**Expected Behavior:**
- Flag status updates to "resolved"
- Status badge shows "Resolved" (green)
- Indicates the issue has been fixed

**API Call:**
```bash
PATCH /api/events/{event-id}/flag
{
  "flag_id": "flag-uuid",
  "status": "resolved"
}
```

#### Test Case 2.8: Update Flag Status - Dismiss

**Steps:**
1. View event with pending flag
2. Click "Dismiss" button

**Expected Behavior:**
- Flag status updates to "dismissed"
- Status badge shows "Dismissed" (gray)
- Indicates the flag was not valid

**API Call:**
```bash
PATCH /api/events/{event-id}/flag
{
  "flag_id": "flag-uuid",
  "status": "dismissed"
}
```

#### Test Case 2.9: Authorization - Non-Creator Cannot View Flags

**Steps:**
1. Log in as a user who is NOT the event creator
2. Attempt to view flags via API

**API Call:**
```bash
GET /api/events/{event-id}/flags
```

**Expected Response (403 Forbidden):**
```json
{
  "error": "Forbidden: Only event creator can view flags"
}
```

#### Test Case 2.10: Authorization - Non-Creator Cannot Update Flags

**Steps:**
1. Log in as a user who is NOT the event creator
2. Attempt to update flag status via API

**API Call:**
```bash
PATCH /api/events/{event-id}/flag
{
  "flag_id": "flag-uuid",
  "status": "resolved"
}
```

**Expected Response (403 Forbidden):**
```json
{
  "error": "Forbidden: Only event creator can update flag status"
}
```

### Edge Cases - Event Flagging

#### Edge Case 2.1: No Flags Exist

**Steps:**
1. Log in as event creator
2. View an event with no flags

**Expected Behavior:**
- Section shows: "Event Flags"
- Message: "No flags have been reported for this event."
- No action buttons shown

#### Edge Case 2.2: Flag Deleted Event

**Steps:**
1. Flag an event
2. Event creator deletes the event

**Expected Behavior:**
- Due to `ON DELETE CASCADE`, flag is automatically deleted
- No orphaned flags remain in database

#### Edge Case 2.3: Invalid Status Update

**Steps:**
1. Attempt to update flag with invalid status

**API Call:**
```bash
PATCH /api/events/{event-id}/flag
{
  "flag_id": "flag-uuid",
  "status": "invalid_status"
}
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Invalid status. Must be: reviewed, resolved, or dismissed"
}
```

#### Edge Case 2.4: Update Non-Existent Flag

**Steps:**
1. Attempt to update flag with incorrect flag_id

**API Call:**
```bash
PATCH /api/events/{event-id}/flag
{
  "flag_id": "non-existent-uuid",
  "status": "resolved"
}
```

**Expected Response (500 Internal Server Error):**
```json
{
  "error": "Failed to update flag",
  "details": "..."
}
```

---

## Feature 3: Club Membership Approval Workflow

### Overview

This feature implements an approval workflow for club memberships:
- Users request to join clubs (status: "pending")
- Club admins view pending requests
- Club admins can approve or reject requests
- Approved members (status: "approved") appear in the club members list
- Rejected requests (status: "rejected") are removed from view

### Testing Membership Request (User Perspective)

#### Test Case 3.1: Request to Join Club

**Steps:**
1. Log in as a regular user
2. Navigate to a club page (e.g., `/clubs/[club-id]`)
3. Click "Join Club" button

**Expected Behavior:**
- Button changes to "Request Pending" and is disabled
- Success message: "Membership request submitted successfully"
- User can see their own pending request status

**API Call:**
```bash
POST /api/clubs/{club-id}/membership
Content-Type: application/json
```

**Expected Response (201 Created):**
```json
{
  "membership": {
    "role": "member",
    "status": "pending"
  },
  "message": "Membership request submitted successfully"
}
```

#### Test Case 3.2: Check Membership Status

**Steps:**
1. Log in as a user
2. Navigate to a club page
3. UI checks user's membership status

**Expected Behavior:**
- If not a member: Shows "Join Club" button
- If pending: Shows "Request Pending" (disabled)
- If approved: Shows "Leave Club" button and member features

**API Call:**
```bash
GET /api/clubs/{club-id}/membership
```

**Expected Response (200 OK):**

If pending:
```json
{
  "membership": {
    "role": "member",
    "status": "pending"
  }
}
```

If approved:
```json
{
  "membership": {
    "role": "member",
    "status": "approved"
  }
}
```

If not a member:
```json
{
  "membership": null
}
```

#### Test Case 3.3: Duplicate Request Prevention

**Steps:**
1. Request to join a club
2. Attempt to request again while still pending

**Expected Behavior:**
- Button remains disabled
- If user bypasses UI:

**API Call:**
```bash
POST /api/clubs/{club-id}/membership
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Membership request is already pending"
}
```

### Testing Membership Approval (Admin Perspective)

#### Test Case 3.4: View Pending Requests

**Steps:**
1. Log in as club admin (club creator)
2. Navigate to club page (e.g., `/clubs/[club-id]`)
3. View "Pending Membership Requests" section

**Expected Behavior:**
- Section displays count badge (e.g., "3")
- Each pending request shows:
  - User's full name
  - User's email
  - "Pending" badge
  - "Requested on" timestamp
  - "Approve" button (green)
  - "Reject" button (red)

**API Call:**
```bash
GET /api/clubs/{club-id}/membership/pending
```

**Expected Response (200 OK):**
```json
{
  "pending_requests": [
    {
      "id": "membership-uuid",
      "user_id": "user-uuid",
      "role": "member",
      "status": "pending",
      "joined_at": "2025-11-13T12:00:00Z",
      "profiles": {
        "full_name": "John Doe",
        "email": "john.doe@asu.edu"
      }
    }
  ]
}
```

#### Test Case 3.5: Approve Membership Request

**Steps:**
1. Log in as club admin
2. View pending requests
3. Click "Approve" button for a specific request

**Expected Behavior:**
- Request disappears from pending list
- Success message: "Membership request approved successfully"
- User now has status "approved"
- User can see club content and events

**API Call:**
```bash
PATCH /api/clubs/{club-id}/membership
Content-Type: application/json

{
  "user_id": "user-uuid",
  "action": "approve"
}
```

**Expected Response (200 OK):**
```json
{
  "membership": {
    "role": "member",
    "status": "approved"
  },
  "message": "Membership request approved successfully"
}
```

#### Test Case 3.6: Reject Membership Request

**Steps:**
1. Log in as club admin
2. View pending requests
3. Click "Reject" button for a specific request

**Expected Behavior:**
- Request disappears from pending list
- Success message: "Membership request rejected successfully"
- User's status is set to "rejected"
- User can request to join again (new request)

**API Call:**
```bash
PATCH /api/clubs/{club-id}/membership
Content-Type: application/json

{
  "user_id": "user-uuid",
  "action": "reject"
}
```

**Expected Response (200 OK):**
```json
{
  "membership": {
    "role": "member",
    "status": "rejected"
  },
  "message": "Membership request rejected successfully"
}
```

#### Test Case 3.7: Authorization - Non-Admin Cannot View Pending Requests

**Steps:**
1. Log in as a regular user (not club creator)
2. Attempt to view pending requests

**API Call:**
```bash
GET /api/clubs/{club-id}/membership/pending
```

**Expected Response (403 Forbidden):**
```json
{
  "error": "Only club admins can view pending membership requests"
}
```

#### Test Case 3.8: Authorization - Non-Admin Cannot Approve/Reject

**Steps:**
1. Log in as a regular user
2. Attempt to approve/reject a request

**API Call:**
```bash
PATCH /api/clubs/{club-id}/membership
{
  "user_id": "user-uuid",
  "action": "approve"
}
```

**Expected Response (403 Forbidden):**
```json
{
  "error": "Only club admins can approve or reject membership requests"
}
```

### Testing Visibility (RLS Policy)

#### Test Case 3.9: Club Members Visibility

**Steps:**
1. Create test memberships:
   - User A: status = "approved"
   - User B: status = "pending"
   - User C: status = "rejected"
2. View club members list as different users

**Expected Behavior:**

**As Public/Guest:**
- Only User A (approved) is visible

**As User B (pending):**
- Sees User A (approved)
- Sees their own pending request (User B)

**As Club Admin:**
- Sees User A (approved)
- Sees User B (pending)
- Does NOT see User C (rejected) - rejected entries can be deleted or hidden

**Database Query (RLS Policy in action):**
```sql
-- As public user
SELECT * FROM club_members WHERE club_id = 'club-uuid';
-- Returns only approved members

-- As specific user
SELECT * FROM club_members
WHERE club_id = 'club-uuid'
AND (status = 'approved' OR user_id = 'current-user-uuid');
-- Returns approved + own requests

-- As club creator
SELECT * FROM club_members WHERE club_id = 'club-uuid';
-- Returns all members (approved + pending)
```

### Edge Cases - Club Membership Approval

#### Edge Case 3.1: No Pending Requests

**Steps:**
1. Log in as club admin
2. View pending requests section

**Expected Behavior:**
- Section displays "Pending Membership Requests"
- Count badge shows "0"
- Message: "No pending membership requests"
- No action buttons

#### Edge Case 3.2: Leave Club (Cancel Request)

**Steps:**
1. User requests to join club (status: pending)
2. User changes mind and clicks "Leave Club" or "Cancel Request"

**Expected Behavior:**
- Membership record is deleted
- User can request to join again

**API Call:**
```bash
DELETE /api/clubs/{club-id}/membership
```

**Expected Response (200 OK):**
```json
{
  "message": "Successfully left club"
}
```

#### Edge Case 3.3: Invalid Action

**Steps:**
1. Attempt to update membership with invalid action

**API Call:**
```bash
PATCH /api/clubs/{club-id}/membership
{
  "user_id": "user-uuid",
  "action": "invalid"
}
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Invalid action. Must be \"approve\" or \"reject\""
}
```

#### Edge Case 3.4: Update Non-Existent Request

**Steps:**
1. Attempt to approve/reject a non-existent user

**API Call:**
```bash
PATCH /api/clubs/{club-id}/membership
{
  "user_id": "non-existent-uuid",
  "action": "approve"
}
```

**Expected Response (404 Not Found):**
```json
{
  "error": "No pending membership request found"
}
```

#### Edge Case 3.5: Grandfathered Existing Members

**Steps:**
1. Check existing memberships that existed before migration

**Expected Behavior:**
- Migration script sets all existing members to `status = 'approved'`
- No disruption to existing members
- All old members remain visible and functional

**Database Query:**
```sql
-- After migration
SELECT status FROM club_members;
-- All records should have status 'approved' (if they existed before migration)
```

---

## API Endpoints Reference

### Event Filters

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/events?category={category}&pricing={pricing}&sortBy={sortBy}` | List/filter events | No |
| POST | `/api/events` | Create event with category and pricing | Yes |

**Query Parameters:**
- `category`: Academic, Social, Sports, Arts, Career, Community Service, Other, all
- `pricing`: free, paid, all
- `sortBy`: date, name, popularity

### Event Flagging

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/events/{id}/flag` | Check if user flagged event | Yes |
| POST | `/api/events/{id}/flag` | Flag an event | Yes |
| PATCH | `/api/events/{id}/flag` | Update flag status | Yes (creator only) |
| GET | `/api/events/{id}/flags` | Get all flags for event | Yes (creator only) |

**Flag Reasons:**
- Inappropriate Content
- Spam
- Misinformation
- Other

**Flag Statuses:**
- pending (default)
- reviewed
- resolved
- dismissed

### Club Membership Approval

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/clubs/{id}/membership` | Check user's membership status | Yes |
| POST | `/api/clubs/{id}/membership` | Request to join club | Yes |
| PATCH | `/api/clubs/{id}/membership` | Approve/reject request | Yes (admin only) |
| DELETE | `/api/clubs/{id}/membership` | Leave club | Yes |
| GET | `/api/clubs/{id}/membership/pending` | Get pending requests | Yes (admin only) |

**Membership Statuses:**
- pending
- approved
- rejected

**Membership Actions:**
- approve
- reject

---

## Troubleshooting

### Issue 1: Database Migration Fails

**Symptoms:**
- SQL errors when running migration
- Columns already exist
- Constraint violations

**Solutions:**
1. Check if migration was already applied:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'events' AND column_name IN ('category', 'is_free', 'price');
   ```
2. If columns exist, migration may have been partially applied
3. Manually apply missing parts or reset database to clean state
4. Check for existing data that violates new constraints (e.g., paid events without price)

### Issue 2: RLS Policy Blocks Legitimate Actions

**Symptoms:**
- 403 Forbidden errors
- Cannot view/update records you should have access to

**Solutions:**
1. Check RLS policies:
   ```sql
   SELECT * FROM pg_policies WHERE tablename IN ('events', 'event_flags', 'club_members');
   ```
2. Verify user authentication:
   ```sql
   SELECT auth.uid(); -- Should return your user UUID
   ```
3. Check club/event ownership:
   ```sql
   SELECT created_by FROM events WHERE id = 'event-uuid';
   SELECT created_by FROM clubs WHERE id = 'club-uuid';
   ```
4. Review policy logic in `/Users/ellarushing/Downloads/asu-connect/APPLY_THIS_TO_SUPABASE.sql`

### Issue 3: Filters Not Working

**Symptoms:**
- Filtering returns all events
- URL parameters don't update
- Wrong events displayed

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify API response in Network tab
3. Check if events have category/pricing set:
   ```sql
   SELECT id, title, category, is_free, price FROM events;
   ```
4. Clear browser cache and refresh
5. Check if filters are case-sensitive (should not be)

### Issue 4: Cannot Flag Event Multiple Times

**Symptoms:**
- "You have already flagged this event" error

**Solutions:**
- This is expected behavior (UNIQUE constraint prevents duplicates)
- To test multiple flags, use different user accounts
- To reset: Delete flag from database:
  ```sql
  DELETE FROM event_flags WHERE event_id = 'event-uuid' AND user_id = 'user-uuid';
  ```

### Issue 5: Pending Requests Not Appearing

**Symptoms:**
- Pending requests list is empty
- User joined but admin doesn't see request

**Solutions:**
1. Check membership status:
   ```sql
   SELECT * FROM club_members WHERE club_id = 'club-uuid' AND user_id = 'user-uuid';
   ```
2. Verify status is "pending" (not "approved" or "rejected")
3. Check if user is authenticated as club admin:
   ```sql
   SELECT created_by FROM clubs WHERE id = 'club-uuid';
   ```
4. Ensure grandfathered members have "approved" status:
   ```sql
   UPDATE club_members SET status = 'approved' WHERE status IS NULL;
   ```

### Issue 6: Price Validation Errors

**Symptoms:**
- Cannot create paid events
- "Price is required" error

**Solutions:**
1. Ensure `is_free = false` when price is provided
2. Price must be > 0 (not null, not 0)
3. Check constraint in database:
   ```sql
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'events'::regclass
   AND conname LIKE '%price%';
   ```
4. Use decimal format: 10.00 (not "10" or "10.0000")

### Issue 7: Foreign Key Violations

**Symptoms:**
- "violates foreign key constraint" error

**Solutions:**
1. Check if club exists:
   ```sql
   SELECT * FROM clubs WHERE id = 'club-uuid';
   ```
2. Check if event exists:
   ```sql
   SELECT * FROM events WHERE id = 'event-uuid';
   ```
3. Check if user exists:
   ```sql
   SELECT * FROM auth.users WHERE id = 'user-uuid';
   ```
4. Ensure UUIDs are correct format (not truncated)

### Issue 8: Infinite Recursion (RLS)

**Symptoms:**
- Queries hang or timeout
- "infinite recursion detected" error

**Solutions:**
- This should NOT occur with the fixed migration
- RLS policies use parent tables (clubs, events) for authorization
- Do NOT query club_members to check club_members permissions
- If error occurs, check policy definitions:
  ```sql
  SELECT * FROM pg_policies WHERE policyname LIKE '%members%';
  ```

### Issue 9: Category Not Appearing

**Symptoms:**
- Category field doesn't show in UI
- Category is always null

**Solutions:**
1. Check if column exists:
   ```sql
   SELECT * FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'category';
   ```
2. Check if event has category set:
   ```sql
   SELECT id, title, category FROM events;
   ```
3. Verify form is sending category in POST request (check Network tab)
4. Ensure category is one of valid values (exact case match)

### Issue 10: Authentication Errors

**Symptoms:**
- 401 Unauthorized
- User not authenticated

**Solutions:**
1. Check if user is logged in (Supabase auth)
2. Verify auth token is included in requests
3. Check Supabase auth configuration
4. Clear cookies and re-login
5. Check if user session expired

---

## Testing Checklist

Use this checklist to ensure comprehensive testing of all features:

### Event Filters
- [ ] Create free event with category
- [ ] Create paid event with category and price
- [ ] Filter by each category (7 categories)
- [ ] Filter by free events
- [ ] Filter by paid events
- [ ] Combine category + pricing filters
- [ ] Reset filters to view all events
- [ ] Sort filtered results
- [ ] Verify validation (paid without price)
- [ ] Verify validation (invalid category)

### Event Flagging
- [ ] Flag an event with each reason
- [ ] Verify duplicate flag prevention
- [ ] Check flag status for user
- [ ] View flags as event creator
- [ ] Update flag to "reviewed"
- [ ] Update flag to "resolved"
- [ ] Update flag to "dismissed"
- [ ] Verify non-creator cannot view flags
- [ ] Verify non-creator cannot update flags
- [ ] Test with no flags (empty state)

### Club Membership Approval
- [ ] Request to join club as user
- [ ] Verify duplicate request prevention
- [ ] Check membership status
- [ ] View pending requests as admin
- [ ] Approve membership request
- [ ] Reject membership request
- [ ] Verify approved member visibility
- [ ] Verify pending request visibility (own only)
- [ ] Verify non-admin cannot view pending
- [ ] Verify non-admin cannot approve/reject
- [ ] Leave club (cancel request)
- [ ] Test with no pending requests

### Integration Testing
- [ ] Create event, flag event, update flag status (full workflow)
- [ ] Join club, get approved, create event, filter by category
- [ ] Multiple users join same club, admin processes all requests
- [ ] Event with multiple flags from different users

---

## Additional Resources

- **Database Schema:** `/Users/ellarushing/Downloads/asu-connect/supabase/SCHEMA.md`
- **SQL Migration File:** `/Users/ellarushing/Downloads/asu-connect/APPLY_THIS_TO_SUPABASE.sql`
- **API Routes:**
  - Events: `/Users/ellarushing/Downloads/asu-connect/app/api/events/route.ts`
  - Event Flags: `/Users/ellarushing/Downloads/asu-connect/app/api/events/[id]/flag/route.ts`
  - Club Membership: `/Users/ellarushing/Downloads/asu-connect/app/api/clubs/[id]/membership/route.ts`
- **UI Components:**
  - Event Create Form: `/Users/ellarushing/Downloads/asu-connect/components/event-create-form.tsx`
  - Event List: `/Users/ellarushing/Downloads/asu-connect/components/events-list.tsx`
  - Flag Dialog: `/Users/ellarushing/Downloads/asu-connect/components/event-flag-dialog.tsx`
  - Membership Requests: `/Users/ellarushing/Downloads/asu-connect/components/club-membership-requests.tsx`

---

## Conclusion

This testing guide provides comprehensive coverage of the three new features in ASU Connect. By following these test cases, you can verify that:

1. **Event Filters** allow users to discover events by category and pricing
2. **Event Flagging** provides content moderation capabilities
3. **Club Membership Approval** gives admins control over who joins their clubs

For any issues not covered in the troubleshooting section, check the API error responses, browser console, and Supabase logs for detailed error messages.

**Happy Testing!**
