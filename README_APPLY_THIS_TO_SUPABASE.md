# ASU Connect - Supabase Database Setup

## Quick Start

This directory contains a ready-to-use SQL file for setting up the complete ASU Connect database schema in Supabase.

### Main File
**`APPLY_THIS_TO_SUPABASE.sql`** - Copy-paste this entire file into Supabase SQL Editor

## How to Apply (5 Minutes)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your ASU Connect project
3. Click "SQL Editor" in left sidebar
4. Click "New Query"
5. Copy all contents from `APPLY_THIS_TO_SUPABASE.sql`
6. Paste into the SQL Editor
7. Click "Run"
8. Wait for green checkmark ✓

## What Gets Created

### 4 Tables
- **clubs** - Club records with creator information
- **events** - Events linked to clubs
- **club_members** - Club membership records
- **event_registrations** - Event registration records

### 8 Indexes
Strategic indexes for optimal query performance on common operations

### 11 RLS Policies
Row Level Security policies with:
- Public read access for all tables
- Authentication required for modifications
- Proper creator/permission checks
- **FIXED infinite recursion issues** from v1

## What's Fixed From V1

### Infinite Recursion Issue - RESOLVED
- **Problem**: club_members RLS policies queried club_members table recursively
- **Solution**: Policies now query the clubs table to check permissions
- **Result**: No more "infinite recursion detected" errors

### Improved Authorization
- Club creators can properly manage members
- Event creators can properly manage registrations
- User self-service operations still work (join, register, leave)

## File Descriptions

- **APPLY_THIS_TO_SUPABASE.sql** - Main SQL file (ready to execute)
- **SUPABASE_SETUP_GUIDE.txt** - Step-by-step setup instructions
- **SQL_FILE_CONTENTS_SUMMARY.txt** - Detailed breakdown of what's in the SQL
- **README_APPLY_THIS_TO_SUPABASE.md** - This file

## Key Features

✓ All tables have Row Level Security (RLS) enabled  
✓ All SELECT operations are publicly readable  
✓ User authentication required for CREATE/UPDATE/DELETE  
✓ Club/event creators have special permissions  
✓ Infinite recursion issues FIXED  
✓ Foreign key cascading deletes enabled  
✓ Proper indexes for query performance  

## Database Schema

### clubs
```
id              UUID (primary key)
name            TEXT (required)
description     TEXT (optional)
created_by      UUID (foreign key to auth.users)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### events
```
id              UUID (primary key)
title           TEXT (required)
description     TEXT (optional)
event_date      TIMESTAMP (required)
location        TEXT (optional)
club_id         UUID (foreign key to clubs)
created_by      UUID (foreign key to auth.users)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### club_members
```
id              UUID (primary key)
club_id         UUID (foreign key to clubs)
user_id         UUID (foreign key to auth.users)
role            TEXT ('admin' or 'member')
joined_at       TIMESTAMP
UNIQUE(club_id, user_id)
```

### event_registrations
```
id              UUID (primary key)
event_id        UUID (foreign key to events)
user_id         UUID (foreign key to auth.users)
registered_at   TIMESTAMP
UNIQUE(event_id, user_id)
```

## RLS Policies Overview

### Clubs (4 policies)
- Public read
- Authenticated users can create clubs
- Club creators can update their clubs
- Club creators can delete their clubs

### Events (3 policies)
- Public read
- Club creators can create events
- Event creators can update their events
- Event creators can delete their events

### Club Members (4 policies - with recursion fixes)
- Public read
- Users can join clubs as members
- Club creators can add/manage members
- Users can leave clubs

### Event Registrations (3 policies)
- Public read
- Users can register for events
- Users can unregister from events
- Event creators can remove registrations

## Verification After Setup

After running the SQL:

1. Check "Table Editor" in Supabase - you should see 4 tables
2. Verify all columns exist in each table
3. Test app functionality:
   - Create a club
   - Join a club
   - Create an event
   - Register for an event

## Troubleshooting

### Error: "Relation already exists"
The tables already exist. This is okay. You can:
- Delete the tables manually and re-run
- Use a different schema
- Continue if the data is correct

### Error: "Permission denied"
- Verify you're logged into the correct Supabase project
- Check you have admin database access

### Error: "Infinite recursion"
This should NOT happen with this version. If it does:
- Drop the old policies manually
- Re-run the script

### Error: "Foreign key constraint"
- Ensure auth.users table exists (it should by default)
- Verify table creation succeeded before policies

## Support

For issues:
1. Check the Supabase SQL Editor logs
2. Review error messages in the output
3. Consult comments in APPLY_THIS_TO_SUPABASE.sql
4. Check the other guide files in this directory

## Next Steps

After setup:
1. Update your app to use the new tables
2. Test all CRUD operations
3. Verify RLS policies work as expected
4. Monitor performance with indexes
5. Adjust policies if needed for your use case

---

**Created**: November 12, 2024  
**Version**: 2.0 (with infinite recursion fixes)  
**Status**: Ready for production use
