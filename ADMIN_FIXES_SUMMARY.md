# Admin Dashboard Fixes Summary

## Issues Fixed

### 1. Server/Client Component Mixing ✅
**Problem**: Admin pages (flags, logs) were client components importing server-only `AppSidebar`

**Files Fixed**:
- `app/admin/flags/page.tsx` - Removed AppSidebar and SidebarProvider imports
- `app/admin/logs/page.tsx` - Removed AppSidebar and SidebarProvider imports

**Solution**: The admin layout already provides these components, so pages don't need to import them.

---

### 2. Foreign Key Relationship Errors ✅
**Problem**: APIs were trying to join `moderation_logs` with `auth.users` directly, which isn't accessible

**Files Fixed**:
- `app/api/admin/stats/route.ts` - Changed to fetch profiles separately
- `app/api/admin/logs/route.ts` - Changed to fetch profiles separately

**Solution**: Fetch admin profiles from the `profiles` table separately and map them to logs.

---

### 3. Admin Dashboard Infinite Loading ✅
**Problem**: Dashboard was fetching from `http://localhost:3000` but server runs on port 3002

**Files Fixed**:
- `app/admin/page.tsx` - Added 10-second timeout to prevent infinite hanging
- `.env.local` - Added `NEXT_PUBLIC_SITE_URL=http://localhost:3002`

**Solution**:
1. Set correct port in environment variable
2. Added fetch timeout so it fails gracefully instead of hanging forever

---

### 4. Missing /admin/clubs Route ✅
**Issue**: The correct route is `/admin/clubs/pending`, not `/admin/clubs`

**Note**: This is by design - there's no general clubs admin page, only the pending clubs page.

---

## What You Need to Do

### 1. Restart Your Dev Server 🔄
**IMPORTANT**: You must restart the server for .env.local changes to take effect!

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

The server will likely start on a different port. If it does:
- Update `NEXT_PUBLIC_SITE_URL` in `.env.local` to match the new port
- Restart again

### 2. Apply Database Migration (If Not Done Yet) 🗄️

If students still can't see admin-created clubs, run this in Supabase SQL Editor:

```sql
-- Approve all clubs created by admins
UPDATE clubs
SET
  approval_status = 'approved',
  approved_at = NOW(),
  rejection_reason = NULL
WHERE created_by IN (
  SELECT id FROM profiles WHERE is_admin = true
)
AND approval_status = 'pending';

-- Apply the RLS policy fix (migration 023)
-- Copy contents of supabase/migrations/023_allow_admin_auto_approve_clubs.sql
-- and run in Supabase SQL Editor
```

### 3. Test All Admin Pages ✅

After restarting, test these URLs:

- ✅ `/admin` - Dashboard (should load with stats)
- ✅ `/admin/flags` - Flagged content (should work)
- ✅ `/admin/logs` - Moderation logs (should work)
- ✅ `/admin/clubs/pending` - Pending clubs (should work)

---

## Common Issues & Solutions

### Issue: Dashboard Still Loading Forever

**Cause**: Port mismatch or API not responding

**Solution**:
1. Check what port your server is running on (look at terminal output)
2. Update `NEXT_PUBLIC_SITE_URL` in `.env.local` to match that port
3. Restart server
4. Check browser console for errors

### Issue: Moderation Logs Still Show Error

**Cause**: Database might not have the `profiles` table or it's missing data

**Solution**:
```sql
-- Check if profiles table exists
SELECT * FROM profiles LIMIT 5;

-- If empty, ensure user profiles are created when users sign up
```

### Issue: Can't Kill Process on Port 3000

**Solution**:
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3002 npm run dev
```

### Issue: "NEXT_PUBLIC_SITE_URL" Not Working

**Cause**: Environment variables require server restart

**Solution**:
1. Stop server completely (Ctrl+C)
2. Restart: `npm run dev`
3. Verify in terminal output: "Local: http://localhost:XXXX"
4. Match XXXX to NEXT_PUBLIC_SITE_URL

---

## Architecture Notes

### Why the Fetch Approach Has Issues

The current admin dashboard uses:
```typescript
fetch(`${NEXT_PUBLIC_SITE_URL}/api/admin/stats`)
```

**Problems**:
- Requires hardcoded URL
- Breaks when port changes
- Slow (extra HTTP round-trip)
- Can timeout or hang

**Better Approach** (future refactor):
Move database queries directly into the server component instead of fetching your own API:

```typescript
// Instead of:
const stats = await fetch('/api/admin/stats');

// Do:
const supabase = await createClient();
const { data: clubs } = await supabase.from('clubs').select('*');
// ... process data inline
```

### Port Management

Next.js automatically finds an available port if the default is busy. Options:

1. **Always use port 3000** (kill other processes):
   ```bash
   lsof -ti:3000 | xargs kill -9
   npm run dev
   ```

2. **Set fixed port** in package.json:
   ```json
   "scripts": {
     "dev": "next dev --turbopack --port 3000"
   }
   ```

3. **Dynamic port detection** (requires code changes)

---

## Files Modified Summary

```
.env.local                                  # Added NEXT_PUBLIC_SITE_URL
app/admin/page.tsx                         # Added fetch timeout
app/admin/flags/page.tsx                   # Removed server component imports
app/admin/logs/page.tsx                    # Removed server component imports
app/api/admin/stats/route.ts               # Fixed foreign key join
app/api/admin/logs/route.ts                # Fixed foreign key join
supabase/migrations/023_...sql             # New RLS policy
```

---

## Next Steps After Restart

1. ✅ All admin pages should load
2. ✅ Dashboard shows stats
3. ✅ Moderation logs work
4. ✅ Flags page works
5. ✅ Students can see admin-created clubs (after DB migration)
6. ✅ New admin clubs auto-approve
7. ✅ New student clubs require approval

**Everything should be working now!** 🎉
