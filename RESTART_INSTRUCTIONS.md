# Fix Admin Dashboard - Clear Cache and Restart

## The Issue
Next.js is running cached/stale code. The error shows line 77 (old fetch code) but the new refactored code is at line 128.

## Solution: Clear Cache and Restart

### Step 1: Stop the Server
```bash
# Press Ctrl+C in the terminal running the dev server
```

### Step 2: Clear Next.js Cache
```bash
cd /Users/ellarushing/Downloads/asu-connect
rm -rf .next
```

### Step 3: Restart the Server
```bash
npm run dev
```

## What Should Happen

After restart, you should see:
- ✅ Admin dashboard loads immediately (no 10-second wait)
- ✅ No "AbortError" in the logs
- ✅ No fetch timeout errors
- ✅ Dashboard works regardless of which port it starts on

## Verify the Fix

1. Go to `http://localhost:XXXX/admin` (whatever port it starts on)
2. Dashboard should load instantly with stats
3. Check terminal - should see:
   ```
   GET /admin 200 in XXXms  (should be fast, like 200-500ms)
   ```
4. No errors about fetch or abort

## If It Still Doesn't Work

Try a hard restart:
```bash
# Kill all Next.js processes
pkill -f "next dev"

# Clear cache
rm -rf .next

# Restart
npm run dev
```

## What Changed

The refactored code:
- ❌ OLD: `fetch('http://localhost:3002/api/admin/stats')` - causes port issues
- ✅ NEW: Direct database call via `getAdminStats()` from `lib/admin/stats.ts`

No more port mismatches!
