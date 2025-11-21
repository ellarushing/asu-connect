# ROLLBACK QUICK START

**TL;DR:** Run the script, then apply the database migration.

---

## Option 1: Automated Rollback (Recommended)

```bash
cd /Users/ellarushing/downloads/asu-connect
./rollback.sh
```

Then apply database rollback:
- Open Supabase Dashboard → SQL Editor
- Run: `supabase/migrations/021_complete_rollback_to_008.sql`

---

## Option 2: Manual Rollback

### Code Rollback
```bash
cd /Users/ellarushing/downloads/asu-connect

# Restore files
git restore app/admin/page.tsx app/api/admin/flags/route.ts app/api/admin/logs/route.ts app/api/admin/stats/route.ts app/api/clubs/[id]/membership/route.ts app/api/clubs/route.ts app/api/events/[id]/register/route.ts app/api/events/route.ts app/dashboard/page.tsx next.config.ts

# Delete temp files
rm -f CLUB_*.md FIXES_SUMMARY.md INVESTIGATION_SUMMARY.md MIGRATION_*.md QUICK_*.md REJOIN_*.md
rm -f components/admin-flags-client.tsx components/admin-logs-client.tsx

# Delete bad migrations
rm -f supabase/migrations/{009..020}_*.sql supabase/migrations/015_test_queries.sql
```

### Database Rollback
```bash
# Open Supabase Dashboard and run:
# supabase/migrations/021_complete_rollback_to_008.sql
```

---

## Verify Success

```bash
# Should show clean status
git status

# Should show only 001-008 and 021
ls supabase/migrations/
```

**Test in browser:**
1. Login works
2. Can view clubs
3. Can join a club (no errors)

---

## What You're Rolling Back To

- **Commit:** 358a49c (2025-11-18 11:58 AM)
- **Features:** Basic club join/leave, admin dashboard, flagging
- **Lost:** "Left" status tracking, rejoin logic, today's RLS changes

---

## Need Help?

See **ROLLBACK_INSTRUCTIONS.md** for detailed step-by-step guide.
