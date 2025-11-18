# Quick Start: Event Flags Migration

## Fastest Way to Apply (2 minutes)

### Option A: Using Supabase CLI
```bash
cd /Users/ellarushing/Downloads/asu-connect
supabase db push
```

### Option B: Using SQL Editor
1. Go to https://app.supabase.com → Your Project → SQL Editor
2. Copy contents of `supabase/standalone_event_flags_setup.sql`
3. Paste and click "Run"
4. Done!

## What You Get

- Event flagging/reporting system
- Full RLS security policies
- Performance indexes
- Admin moderation support
- Automatic audit logging

## Verification (30 seconds)

Run this in SQL Editor:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'event_flags';
```

Expected: 1 row showing `event_flags`

## Schema Overview

```
event_flags
├── id (UUID, PK)
├── event_id (UUID, FK → events)
├── user_id (UUID, FK → auth.users)
├── reason (TEXT, required)
├── details (TEXT, optional)
├── status (TEXT: pending|reviewed|resolved|dismissed)
├── reviewed_by (UUID, FK → auth.users)
├── reviewed_at (TIMESTAMPTZ)
├── created_at (TIMESTAMPTZ, auto)
└── updated_at (TIMESTAMPTZ, auto)
```

## Access Control (RLS Policies)

| Who | Can Do What |
|-----|-------------|
| Any user | Create flags for events |
| Flag creator | View their own flags |
| Event creator | View all flags for their events |
| Event creator | Update flags for their events |
| Admin | View and update all flags |
| Flag creator | Delete own pending flags |

## Common Issues

**Error: is_admin function doesn't exist**
- Solution: Run migration 004 first, or comment out admin policies

**Error: events table doesn't exist**
- Solution: Run migration 001 first

**RLS blocking inserts**
- Check: `user_id` must equal `auth.uid()`
- Check: User is authenticated

## API Example

```typescript
// Create a flag
await supabase.from('event_flags').insert({
  event_id: eventId,
  user_id: currentUserId,
  reason: 'Spam',
  details: 'This event is promoting unrelated products'
});

// Get flags for my event
await supabase.from('event_flags')
  .select('*')
  .eq('event_id', myEventId);

// Admin: Update flag status
await supabase.from('event_flags')
  .update({
    status: 'resolved',
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString()
  })
  .eq('id', flagId);
```

## Files

- **migrations/005_add_event_flags_table.sql** - Official migration (use with CLI)
- **standalone_event_flags_setup.sql** - Quick setup script (use with SQL Editor)
- **EVENT_FLAGS_MIGRATION_GUIDE.md** - Full documentation
- **QUICK_START_EVENT_FLAGS.md** - This file

## Next Steps

1. Apply migration
2. Test flag creation via your API
3. Add flag button to event pages
4. Build admin moderation dashboard
5. Add notification system for new flags

Need help? See **EVENT_FLAGS_MIGRATION_GUIDE.md** for detailed instructions.
