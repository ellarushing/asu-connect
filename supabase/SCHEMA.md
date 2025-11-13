# ASU-Connect Database Schema Diagram

## Entity Relationship Overview

```
┌─────────────────┐
│   auth.users    │
│ (Supabase Auth) │
└────────┬────────┘
         │
         ├─────────────────────────────────────────────┐
         │                                             │
         │                                             │
    ┌────▼────────────────┐              ┌────────────▼────────────────┐
    │      clubs          │              │        events               │
    ├─────────────────────┤              ├─────────────────────────────┤
    │ id (PK)             │              │ id (PK)                     │
    │ name                │──────┐       │ title                       │
    │ description         │      │       │ description                 │
    │ created_by (FK)     │      │       │ event_date                  │
    │ created_at          │      │       │ location                    │
    │ updated_at          │      │       │ club_id (FK) ──────┐       │
    └─────────────────────┘      │       │ created_by (FK)    │       │
         │                       │       │ created_at         │       │
         │                       │       │ updated_at         │       │
         │                       └───────┼──────────┐        │       │
         │                               └──────────┼────────┘       │
         │                                          │                │
    ┌────▼────────────────────┐          ┌─────────▼──────────────┐  │
    │   club_members          │          │ event_registrations    │  │
    ├─────────────────────────┤          ├────────────────────────┤  │
    │ id (PK)                 │          │ id (PK)                │  │
    │ club_id (FK) ───────────┼─────┐    │ event_id (FK) ─────────┼──┼─┐
    │ user_id (FK) ───────────┼──┐  │    │ user_id (FK) ──────────┼──┐ │
    │ role                    │  │  │    │ registered_at          │  │ │
    │ joined_at               │  │  │    └────────────────────────┘  │ │
    └─────────────────────────┘  │  │                                │ │
                                 │  └────────────────────────────────┴─┘
                                 │
                                 └────────────────────────────────────┐
                                                                      │
                                                            References to auth.users
```

## Data Flow

### 1. Club Creation
```
User (authenticated) → Create Club → clubs table (user becomes creator)
```

### 2. Club Membership
```
User → Join Club → club_members table (as 'member')
User → Promoted to Admin → club_members.role updated to 'admin'
```

### 3. Event Creation
```
Club Admin → Create Event → events table (linked to club)
```

### 4. Event Registration
```
User → Register for Event → event_registrations table
```

## Key Relationships

| From | To | Type | Cascade |
|------|----|----|---------|
| clubs | auth.users | Many-to-One | CASCADE |
| events | clubs | Many-to-One | CASCADE |
| events | auth.users | Many-to-One | CASCADE |
| club_members | clubs | Many-to-One | CASCADE |
| club_members | auth.users | Many-to-One | CASCADE |
| event_registrations | events | Many-to-One | CASCADE |
| event_registrations | auth.users | Many-to-One | CASCADE |

## Sample Queries

### Get all clubs
```sql
SELECT * FROM clubs ORDER BY created_at DESC;
```

### Get all members of a club
```sql
SELECT u.id, u.email, cm.role, cm.joined_at
FROM club_members cm
JOIN auth.users u ON cm.user_id = u.id
WHERE cm.club_id = '...'
ORDER BY cm.joined_at DESC;
```

### Get all events for a club
```sql
SELECT * FROM events
WHERE club_id = '...'
AND event_date >= NOW()
ORDER BY event_date ASC;
```

### Get user's club memberships
```sql
SELECT c.id, c.name, cm.role, cm.joined_at
FROM club_members cm
JOIN clubs c ON cm.club_id = c.id
WHERE cm.user_id = auth.uid()
ORDER BY cm.joined_at DESC;
```

### Get event attendees
```sql
SELECT u.id, u.email, er.registered_at
FROM event_registrations er
JOIN auth.users u ON er.user_id = u.id
WHERE er.event_id = '...'
ORDER BY er.registered_at ASC;
```

### Get user's event registrations
```sql
SELECT e.id, e.title, e.event_date, e.location, er.registered_at
FROM event_registrations er
JOIN events e ON er.event_id = e.id
WHERE er.user_id = auth.uid()
AND e.event_date >= NOW()
ORDER BY e.event_date ASC;
```

## RLS Policy Summary

| Table | Operation | Who Can | Condition |
|-------|-----------|---------|-----------|
| clubs | SELECT | Everyone | None |
| clubs | INSERT | Authenticated users | User is creator |
| clubs | UPDATE | Club creator | User is creator |
| clubs | DELETE | Club creator | User is creator |
| events | SELECT | Everyone | None |
| events | INSERT | Authenticated users | User is club admin |
| events | UPDATE | Event creator | User is creator |
| events | DELETE | Event creator | User is creator |
| club_members | SELECT | Everyone | None |
| club_members | INSERT | Authenticated users | User is admin OR self-join as member |
| club_members | UPDATE | Club admins | User is club admin |
| club_members | DELETE | Admins or self | User is admin OR removing self |
| event_registrations | SELECT | Everyone | None |
| event_registrations | INSERT | Authenticated users | User registering self |
| event_registrations | DELETE | User or creator | User unregistering OR event creator |

## Constraints & Uniqueness

- `club_members`: Unique `(club_id, user_id)` - prevent duplicate memberships
- `event_registrations`: Unique `(event_id, user_id)` - prevent duplicate registrations
- `club_members.role`: Check constraint - only `'admin'` or `'member'` allowed
- All foreign keys: `ON DELETE CASCADE` - maintain referential integrity

## Indexes for Performance

```
clubs
├── idx_clubs_created_by (for queries filtering by creator)

events
├── idx_events_club_id (for fetching club's events)
├── idx_events_created_by (for queries filtering by creator)
└── idx_events_event_date (for sorting by date or finding upcoming events)

club_members
├── idx_club_members_club_id (for fetching club's members)
└── idx_club_members_user_id (for fetching user's memberships)

event_registrations
├── idx_event_registrations_event_id (for fetching attendees)
└── idx_event_registrations_user_id (for fetching user's registrations)
```
