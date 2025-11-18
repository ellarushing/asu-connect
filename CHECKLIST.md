# Database Setup Checklist

## Pre-Flight Check

- [ ] I have access to Supabase Dashboard
- [ ] I can open SQL Editor in Supabase
- [ ] I know if I have existing event_flags or club_flags tables

### How to check for existing tables:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('event_flags', 'club_flags');
```

## Option A: Fresh Database (No Existing Tables)

- [ ] Open Supabase SQL Editor
- [ ] Copy entire contents of `COMPLETE_DATABASE_SETUP.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify success messages (should see "SETUP COMPLETE")
- [ ] Run verification queries at bottom of script
- [ ] Create first admin user:
  ```sql
  UPDATE profiles SET is_admin = true WHERE email = 'your-email@asu.edu';
  ```
- [ ] Test application

## Option B: Existing Tables (Need Constraint Fix)

### Step 1: Run Emergency Fix

- [ ] Open Supabase SQL Editor
- [ ] Copy entire contents of `FIX_EXISTING_TABLES.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Check output for success messages
- [ ] Verify you see: "All existing constraints are now correctly named"
- [ ] If errors about duplicates, clean up duplicate data first (see below)

### Step 2: Run Complete Setup

- [ ] Stay in Supabase SQL Editor
- [ ] Copy entire contents of `COMPLETE_DATABASE_SETUP.sql`
- [ ] Paste into SQL Editor (replace previous content)
- [ ] Click "Run"
- [ ] Verify success messages (should see "SETUP COMPLETE")
- [ ] Run verification queries at bottom of script
- [ ] Create first admin user:
  ```sql
  UPDATE profiles SET is_admin = true WHERE email = 'your-email@asu.edu';
  ```
- [ ] Test application

## Troubleshooting: Duplicate Data

If you get "duplicate key value violates unique constraint" error:

### Find Duplicates in event_flags:
```sql
SELECT event_id, user_id, COUNT(*) as count
FROM event_flags
GROUP BY event_id, user_id
HAVING COUNT(*) > 1;
```

### Remove Duplicates (keep first one):
```sql
DELETE FROM event_flags a USING event_flags b
WHERE a.id < b.id
AND a.event_id = b.event_id
AND a.user_id = b.user_id;
```

### Find Duplicates in club_flags:
```sql
SELECT club_id, user_id, COUNT(*) as count
FROM club_flags
GROUP BY club_id, user_id
HAVING COUNT(*) > 1;
```

### Remove Duplicates (keep first one):
```sql
DELETE FROM club_flags a USING club_flags b
WHERE a.id < b.id
AND a.club_id = b.club_id
AND a.user_id = b.user_id;
```

After cleaning duplicates, start over from Step 1 (Run Emergency Fix).

## Post-Setup Verification

### Check All Tables Exist:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'clubs', 'events', 'club_members',
                   'event_registrations', 'club_flags', 'event_flags',
                   'moderation_logs')
ORDER BY table_name;
```
**Expected**: Should see all 8 tables

### Check RLS is Enabled:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'clubs', 'events', 'club_members',
                  'event_registrations', 'club_flags', 'event_flags',
                  'moderation_logs')
ORDER BY tablename;
```
**Expected**: rowsecurity = true for all tables

### Check Constraint Names:
```sql
-- Check event_flags constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'event_flags'::regclass
AND contype = 'u';
```
**Expected**: event_flags_unique_user_event

```sql
-- Check club_flags constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'club_flags'::regclass
AND contype = 'u';
```
**Expected**: club_flags_unique_user_club

### Check Functions Exist:
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('is_admin', 'log_moderation_action', 'handle_new_user')
ORDER BY routine_name;
```
**Expected**: Should see all 3 functions

### Check Profiles Match Users:
```sql
SELECT
  (SELECT COUNT(*) FROM auth.users) as users,
  (SELECT COUNT(*) FROM profiles) as profiles,
  CASE
    WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM profiles)
    THEN 'MATCH'
    ELSE 'MISMATCH'
  END as status;
```
**Expected**: status = 'MATCH'

## Common Issues

### "constraint X does not exist"
- **Cause**: Tables created with auto-generated constraint names
- **Solution**: Run FIX_EXISTING_TABLES.sql first

### "relation X already exists"
- **Cause**: Normal behavior, script uses IF NOT EXISTS
- **Solution**: This is OK, continue

### "duplicate key value"
- **Cause**: Duplicate data in tables
- **Solution**: Clean up duplicates (see above), then re-run

### "permission denied"
- **Cause**: Insufficient database permissions
- **Solution**: Ensure you're logged in as database owner/admin

## Success Criteria

You know everything worked if:

- [ ] All verification queries return expected results
- [ ] No error messages in SQL Editor
- [ ] Can create a test club in application
- [ ] Can create a test event in application
- [ ] Can flag a club or event
- [ ] Admin user can view flags
- [ ] RLS policies prevent unauthorized access

## Next Steps After Setup

1. **Create Admin User**:
   ```sql
   UPDATE profiles SET is_admin = true WHERE email = 'admin@asu.edu';
   ```

2. **Test User Flows**:
   - Sign up as regular user
   - Create a club
   - Create an event
   - Join a club
   - Register for an event
   - Flag content

3. **Test Admin Flows**:
   - View all flags
   - Approve/reject clubs
   - Review flagged content
   - View moderation logs

4. **Monitor**:
   - Check Supabase logs for errors
   - Test RLS policies with different users
   - Verify data integrity

## Files Reference

- **RUN_ME_FIRST.txt** - Visual quick start guide
- **FIX_EXISTING_TABLES.sql** - Emergency constraint fix (12 KB)
- **COMPLETE_DATABASE_SETUP.sql** - Full schema setup (57 KB)
- **DATABASE_SETUP_INSTRUCTIONS.md** - Detailed instructions
- **EMERGENCY_FIX_README.txt** - Technical reference
- **CHECKLIST.md** - This file

## Support

All scripts are located at:
```
/Users/ellarushing/Downloads/asu-connect/
```

If issues persist after following this checklist:
1. Review error messages carefully
2. Check Supabase logs
3. Verify database permissions
4. Ensure Supabase authentication is enabled
5. Review DATABASE_SETUP_INSTRUCTIONS.md for detailed troubleshooting
