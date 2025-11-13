# ASU-Connect Supabase Setup Guide

This document guides you through setting up the Supabase database for ASU-Connect.

## Quick Start

### 1. Create Supabase Project
- Visit [supabase.com](https://supabase.com)
- Click "New Project"
- Give it a name (e.g., "asu-connect")
- Create a strong password
- Choose your region
- Wait for the project to initialize

### 2. Add Environment Variables
```bash
# Copy the example file
cp .env.local.example .env.local

# Edit .env.local and add:
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

You can find these values in your Supabase project:
- Settings → API
- Look for "Project URL" and "anon/public" key

### 3. Deploy the Schema

**Option A: SQL Editor (Easiest)**
1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
5. Click "Run"

**Option B: Supabase CLI**
```bash
npm install -g supabase
supabase link --project-ref <your-project-id>
supabase migration up
```

### 4. Install Dependencies
```bash
npm install
# or
pnpm install
```

### 5. Test the Connection
Run the dev server:
```bash
npm run dev
```

Visit http://localhost:3000 and check that the app loads without Supabase connection errors.

## File Structure

```
/supabase
├── migrations/
│   └── 001_initial_schema.sql    # Main database schema (223 lines)
├── README.md                      # Detailed schema documentation
└── SCHEMA.md                      # Entity relationships and diagrams

/lib/types
└── database.ts                    # TypeScript types for database tables

.env.local.example                 # Example environment variables
SETUP.md                           # This file
```

## Database Schema

### Tables
- **clubs**: Organization information (name, description, creator)
- **events**: Club events (title, date, location, registrations)
- **club_members**: Membership records (user, club, role)
- **event_registrations**: User registrations for events

### Key Features
- Row Level Security (RLS) on all tables
- Automatic timestamps (created_at, updated_at)
- Cascade deletes for data integrity
- Role-based access (admin, member)
- Unique constraints on memberships and registrations

## Row Level Security (RLS)

All tables have RLS enabled. Key policies:

| Operation | Who | Requirements |
|-----------|-----|--------------|
| Create Club | Authenticated users | User is creator |
| Create Event | Authenticated users | User is club admin |
| Join Club | Authenticated users | Self-join as member |
| Register Event | Authenticated users | Self-register |
| Delete Club | Club creator | Only creator can delete |

See `supabase/README.md` for complete RLS policy documentation.

## Connecting Your App

### Client Setup
In your app, create a Supabase client:

```typescript
// lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types/database'

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

### Using the Client
```typescript
import { createClient } from '@/lib/supabase'

const supabase = createClient()

// Get all clubs
const { data: clubs } = await supabase
  .from('clubs')
  .select('*')
  .order('created_at', { ascending: false })

// Create a new club
const { data: newClub } = await supabase
  .from('clubs')
  .insert({ name: 'My Club', description: '...', created_by: user.id })
  .select()
```

## Common Tasks

### Get Current User's Clubs
```typescript
const { data: userClubs } = await supabase
  .from('club_members')
  .select('club_id, clubs(id, name, description)')
  .eq('user_id', user.id)
```

### Get Club Members
```typescript
const { data: members } = await supabase
  .from('club_members')
  .select('user_id, role, joined_at')
  .eq('club_id', clubId)
```

### Get Upcoming Events for Club
```typescript
const { data: events } = await supabase
  .from('events')
  .select('*')
  .eq('club_id', clubId)
  .gte('event_date', new Date().toISOString())
  .order('event_date', { ascending: true })
```

### Register User for Event
```typescript
const { data: registration } = await supabase
  .from('event_registrations')
  .insert({ event_id: eventId, user_id: user.id })
  .select()
```

## Troubleshooting

### Connection Issues
- Verify `.env.local` has correct Supabase URL and key
- Check that project is active in Supabase dashboard
- Ensure URL ends with `.supabase.co` (not `.co.supabase`)

### Schema Not Applied
- Check SQL Editor for any error messages
- Ensure you're in the correct project
- Try copying and pasting the SQL again

### RLS Permission Errors
- Make sure user is authenticated (`auth.role() = 'authenticated'`)
- Check RLS policies in Supabase dashboard
- Test policies individually in SQL Editor

### Type Errors in TypeScript
- Run `npm install` to ensure all types are installed
- Check that `lib/types/database.ts` exists
- Import types as: `import type { Club } from '@/lib/types/database'`

## Next Steps

1. **Authentication**: Set up Supabase Auth in your Next.js app
2. **UI Components**: Create club and event components
3. **API Routes**: Add server-side logic for complex operations
4. **Testing**: Write tests for database queries and RLS policies

## Documentation

- **Supabase Docs**: https://supabase.com/docs
- **RQ Docs**: https://github.com/rq/rq
- **Next.js Docs**: https://nextjs.org/docs

## Support

For issues:
1. Check `supabase/README.md` for schema details
2. Review RLS policies in `supabase/migrations/001_initial_schema.sql`
3. Check Supabase dashboard for error messages
4. Review browser console for client-side errors
