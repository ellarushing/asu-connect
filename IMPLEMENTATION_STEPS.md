# Step-by-Step Implementation Guide

## Overview
This guide walks you through fixing the database schema errors in your ASU Connect project.

## Prerequisites
- Access to Supabase project
- Supabase CLI installed (`npm install -g supabase`)
- Git repository access
- Basic SQL knowledge

## Phase 1: Preparation

### Step 1.1: Backup Current State
```bash
# Export current schema (just in case)
pg_dump postgresql://[user]:[password]@[host]:5432/postgres \
  --schema=public \
  > backup_schema_$(date +%s).sql

# Keep this file safe
```

### Step 1.2: Review the Issues
```bash
cd /Users/ellarushing/Downloads/asu-connect

# Read the detailed explanation
cat DATABASE_SCHEMA_FIXES.md
cat SCHEMA_RECURSION_EXPLANATION.md
```

### Step 1.3: Understand What Will Change
**Authorization Change**:
- OLD: Any 'admin' user could manage members
- NEW: Only club creator can manage members

**Functionality Preserved**:
- Users can still self-join clubs
- Users can still remove themselves
- Club creators have full control
- All public reads still work

## Phase 2: Apply the Fix (3 Options)

### Option A: Apply Migration (Recommended for Existing Projects)

**Best for**: Already have data you want to keep

**Steps**:

1. **Verify current state**:
```bash
cd asu-connect

# Check Supabase connection
supabase status
```

2. **Review the migration**:
```bash
cat supabase/migrations/002_fix_rls_infinite_recursion.sql
```

3. **Apply migration**:
```bash
# Apply the fix
supabase migration up

# Or if using Supabase UI:
# 1. Go to SQL Editor
# 2. New Query
# 3. Paste contents of 002_fix_rls_infinite_recursion.sql
# 4. Run
```

4. **Verify success**:
```bash
# Check if tables are now accessible
supabase db push

# Or test with SQL:
psql postgresql://[connection_string] << EOF
SELECT COUNT(*) FROM public.clubs;
SELECT COUNT(*) FROM public.club_members;
SELECT COUNT(*) FROM public.event_registrations;
EOF
```

### Option B: Reset Schema from Revised File (Recommended for New Projects)

**Best for**: Fresh start or new deployment

**Steps**:

1. **Use revised schema**:
```bash
# Back up current migrations
cp supabase/migrations/001_initial_schema.sql \
   supabase/migrations/001_initial_schema.backup.sql

# Replace with fixed version
cp supabase/migrations/001_initial_schema_REVISED.sql \
   supabase/migrations/001_initial_schema.sql
```

2. **Reset database** (WARNING: This deletes all data):
```bash
# In Supabase Dashboard:
# Settings > Database > Danger Zone > Reset database

# Or using CLI:
supabase db reset
```

3. **Reapply migrations**:
```bash
supabase db push
```

### Option C: Manual SQL Execution

**Best for**: Testing or specific scenarios

**Steps**:

1. **Open Supabase SQL Editor**:
   - Go to your Supabase dashboard
   - Click "SQL Editor"
   - Click "New Query"

2. **Drop problematic policies**:
```sql
DROP POLICY IF EXISTS "Club admins can add members" ON public.club_members;
DROP POLICY IF EXISTS "Club admins can update member roles" ON public.club_members;
DROP POLICY IF EXISTS "Club admins can remove members" ON public.club_members;
```

3. **Create new policies**:
```sql
-- Copy policies from 002_fix_rls_infinite_recursion.sql
-- Paste into SQL Editor
-- Run all
```

4. **Verify**:
```sql
SELECT * FROM pg_policies WHERE tablename = 'club_members';
```

## Phase 3: Verification

### Step 3.1: Schema Verification
```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected output**:
```
club_members
clubs
event_registrations
events
```

### Step 3.2: RLS Policy Verification
```sql
-- Check policies on club_members
SELECT policyname, permissive, cmd, qual
FROM pg_policies
WHERE tablename = 'club_members'
ORDER BY policyname;
```

**Expected**: 5 policies without recursion-causing conditions

### Step 3.3: Query Verification
```sql
-- Test basic queries work
SELECT COUNT(*) FROM public.clubs;
SELECT COUNT(*) FROM public.events;
SELECT COUNT(*) FROM public.club_members;
SELECT COUNT(*) FROM public.event_registrations;
```

**Expected**: All queries return without errors (counts may be 0 for new DB)

## Phase 4: Application Testing

### Step 4.1: Setup Test Environment
```bash
# Install dependencies
npm install
# or
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Update with your Supabase credentials:
# NEXT_PUBLIC_SUPABASE_URL=your_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

### Step 4.2: Run Manual Tests
```bash
# Start your application
npm run dev  # for Next.js
# or
npm start    # for other
# or
python app.py # for Flask

# Open browser to http://localhost:3000 (or your port)
```

### Step 4.3: Test Workflow

**Test Case 1: Create a Club**
```
1. Sign in as User A
2. Click "Create Club"
3. Fill form, submit
4. Expected: Club created successfully
5. Verify in database: clubs table has new record
```

**Test Case 2: Join a Club**
```
1. Sign in as User B (different user)
2. View clubs
3. Click "Join Club" on User A's club
4. Expected: Successfully joined
5. Verify in database: club_members table has new record with role='member'
```

**Test Case 3: Create an Event** (as club creator)
```
1. Sign in as User A (club creator)
2. Go to their club
3. Click "Create Event"
4. Fill form, submit
5. Expected: Event created successfully
6. Verify in database: events table has new record
```

**Test Case 4: Register for Event**
```
1. Sign in as User B
2. View events
3. Click "Register" on User A's event
4. Expected: Successfully registered
5. Verify in database: event_registrations table has new record
```

**Test Case 5: Verify Permissions**
```
1. Sign in as User B
2. Try to edit/delete User A's club/event
3. Expected: Forbidden/Permission denied error
4. Try to remove another user from club
5. Expected: Forbidden/Permission denied error
```

### Step 4.4: Check Logs for Errors
```bash
# If using Docker:
docker-compose logs -f api

# If using Supabase local dev:
supabase start
supabase logs

# If using cloud:
# Check Supabase dashboard > Logs
```

## Phase 5: Deployment

### Step 5.1: Commit Changes
```bash
cd asu-connect

# Stage the migration
git add supabase/migrations/002_fix_rls_infinite_recursion.sql

# Stage documentation
git add DATABASE_SCHEMA_FIXES.md
git add SCHEMA_FIX_QUICK_START.md
git add SCHEMA_RECURSION_EXPLANATION.md

# Commit
git commit -m "Fix infinite recursion in club_members RLS policies

- Replace recursive club_members queries with clubs table queries
- Simplify authorization: only club creator can manage members
- Fixes 'infinite recursion detected in policy' error
- Fixes 'Could not find table event_registrations' error
- Add comprehensive documentation of changes"

# Push
git push origin main
```

### Step 5.2: Deploy to Production
```bash
# Using Supabase CLI
supabase db push

# Or manual:
# 1. Go to Supabase Dashboard
# 2. SQL Editor
# 3. Create new query
# 4. Paste migration from 002_fix_rls_infinite_recursion.sql
# 5. Run
```

### Step 5.3: Verify Production
```bash
# Test API endpoints
curl -X GET https://your-api/api/clubs \
  -H "Authorization: Bearer token"

# Check status
curl -X GET https://your-api/health
```

## Phase 6: Monitoring

### Step 6.1: Monitor Logs
```bash
# Watch for errors
supabase logs

# Or in dashboard
# Logs > Postgres > Errors
```

### Step 6.2: Performance Check
```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM public.club_members
WHERE club_id = 'your-club-id';
```

### Step 6.3: Alert Setup
Configure alerts for:
- RLS policy errors
- Query timeouts
- Authentication failures

## Rollback Plan

**If Something Goes Wrong**:

### Option 1: Restore from Backup
```bash
# Restore from backup you created earlier
psql postgresql://[connection_string] < backup_schema_*.sql
```

### Option 2: Revert Changes (if not applied to prod yet)
```bash
# Don't apply the migration
# Keep original 001_initial_schema.sql
```

### Option 3: Restore Git History
```bash
git revert [commit_hash]
git push
```

## Troubleshooting

### Issue: "Column reference is ambiguous"
**Solution**: Specify table name in column references
```sql
-- Bad
WHERE club_id = club_members.club_id

-- Good
WHERE club_members.club_id = club_members.club_id
```

### Issue: "Permission denied for schema public"
**Solution**: Ensure user has proper Supabase role permissions

### Issue: "RLS policy still has recursion error"
**Solution**:
1. Verify all three policies were dropped (002 migration)
2. Check no old policies remain
3. Apply migration again

### Issue: "Table event_registrations still not found"
**Solution**:
1. Check 001 migration was applied (initial schema)
2. Verify all tables exist with query above
3. Check RLS isn't preventing access

## Checklist

- [ ] Backed up current schema
- [ ] Reviewed all documentation
- [ ] Applied migration (Option A, B, or C)
- [ ] Verified schema (all 4 tables exist)
- [ ] Verified RLS policies (5 policies on club_members)
- [ ] Ran query verification tests
- [ ] Tested application manually (5 test cases)
- [ ] Checked logs for errors
- [ ] Committed to git
- [ ] Deployed to production
- [ ] Verified production deployment
- [ ] Set up monitoring/alerts
- [ ] Documented any changes to authorization
- [ ] Notified team of changes

## Support

If you get stuck:
1. Check SCHEMA_RECURSION_EXPLANATION.md for why this happens
2. Check DATABASE_SCHEMA_FIXES.md for detailed technical info
3. Check SCHEMA_FIX_QUICK_START.md for quick reference
4. Review Supabase docs: https://supabase.com/docs/guides/auth/row-level-security

## Success Indicators

After implementation, you should see:
- [ ] No "infinite recursion" errors in logs
- [ ] No "Could not find table" errors
- [ ] All CRUD operations work (Create, Read, Update, Delete)
- [ ] Permission-based operations correctly denied for unauthorized users
- [ ] Queries execute in <100ms typically
- [ ] Schema accessible from API and direct connections
