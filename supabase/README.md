# Supabase Database Schema

This directory contains the Supabase database configuration for ASU-Connect.

## Getting Started

### 1. Set Up Supabase Project

- Go to [supabase.com](https://supabase.com) and create a new project
- Copy your **Project URL** and **Anon Key** from the project settings

### 2. Add Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your actual values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Run the Migration

You have two options to apply the schema:

**Option A: Using Supabase Dashboard (Easiest)**
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Click "New Query"
4. Copy and paste the contents of `migrations/001_initial_schema.sql`
5. Click "Run"

**Option B: Using Supabase CLI**
```bash
# Install Supabase CLI
npm install -g supabase

# Link your project
supabase link --project-ref your-project-id

# Run migrations
supabase migration up
```

## Database Schema Overview

### Tables

#### `clubs`
Club information and organization details.

- `id` - Unique identifier (UUID)
- `name` - Club name (required)
- `description` - Club description
- `created_by` - User ID of club creator (required, references `auth.users`)
- `created_at` - Timestamp of creation
- `updated_at` - Timestamp of last update

#### `events`
Club events and meetups.

- `id` - Unique identifier (UUID)
- `title` - Event title (required)
- `description` - Event description
- `event_date` - When the event occurs (required)
- `location` - Where the event takes place
- `club_id` - Parent club (required, references `clubs`)
- `created_by` - User ID of event creator (required, references `auth.users`)
- `created_at` - Timestamp of creation
- `updated_at` - Timestamp of last update

#### `club_members`
Membership records for clubs.

- `id` - Unique identifier (UUID)
- `club_id` - Club ID (required, references `clubs`)
- `user_id` - User ID (required, references `auth.users`)
- `role` - User role: `'admin'` or `'member'` (default: `'member'`)
- `joined_at` - When user joined the club

**Constraints:**
- Unique combination of `club_id` and `user_id` (no duplicate memberships)

#### `event_registrations`
User registrations for events.

- `id` - Unique identifier (UUID)
- `event_id` - Event ID (required, references `events`)
- `user_id` - User ID (required, references `auth.users`)
- `registered_at` - When user registered

**Constraints:**
- Unique combination of `event_id` and `user_id` (no duplicate registrations)

## Row Level Security (RLS)

All tables have RLS enabled with the following policies:

### Clubs
- **SELECT**: Everyone can view all clubs
- **INSERT**: Authenticated users can create clubs
- **UPDATE**: Only club creator can update
- **DELETE**: Only club creator can delete

### Events
- **SELECT**: Everyone can view all events
- **INSERT**: Only club admins can create events in their club
- **UPDATE**: Only event creator can update
- **DELETE**: Only event creator can delete

### Club Members
- **SELECT**: Everyone can view all memberships
- **INSERT**: Club admins can add members OR users can self-join as members
- **UPDATE**: Only club admins can update member roles
- **DELETE**: Club admins can remove members OR users can remove themselves

### Event Registrations
- **SELECT**: Everyone can view all registrations
- **INSERT**: Authenticated users can register for events
- **DELETE**: Users can unregister OR event creators can remove registrations

## Indexes

Indexes are created on all foreign key columns and commonly queried fields for optimal performance:

- `clubs.created_by`
- `events.club_id`
- `events.created_by`
- `events.event_date`
- `club_members.club_id`
- `club_members.user_id`
- `event_registrations.event_id`
- `event_registrations.user_id`

## Important Notes

1. **Authentication**: This schema relies on Supabase Auth. Make sure to set up authentication in your Next.js app using `@supabase/ssr` and `@supabase/supabase-js`.

2. **Foreign Keys**: All foreign keys use `ON DELETE CASCADE`, meaning deleting a club will cascade delete all related events, members, and registrations.

3. **Timestamps**: All `created_at` and `updated_at` fields use `TIMESTAMP WITH TIME ZONE` to ensure correct handling across timezones.

4. **Role-Based Access**: The `club_members.role` field supports future role-based access control. Currently supports `'admin'` and `'member'`.

## Next Steps

1. Install Supabase dependencies:
   ```bash
   npm install @supabase/supabase-js @supabase/ssr
   ```

2. Create a Supabase client utility (example in `/lib/supabase.ts`)

3. Update `.env.local` with your credentials

4. Run the migration using the SQL Editor or CLI

5. Test the schema with your app!

## Troubleshooting

**"No schema named 'public'"** - Ensure you're running the migration in the default `public` schema.

**"Permission denied"** - Make sure RLS policies are correctly configured. Check the Supabase dashboard for any policy errors.

**"Foreign key constraint violation"** - Ensure the referenced user IDs exist in `auth.users` table.
