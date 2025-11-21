#!/bin/bash

# ============================================================================
# COMPLETE ROLLBACK SCRIPT
# ============================================================================
# This script rolls back all changes made around 3:30 PM on 2025-11-18
# It restores code to commit 358a49c and prepares database rollback
# ============================================================================

set -e  # Exit on any error

PROJECT_ROOT="/Users/ellarushing/downloads/asu-connect"
cd "$PROJECT_ROOT"

echo "============================================"
echo "ASU Connect - Complete Rollback Script"
echo "============================================"
echo ""
echo "This will rollback all changes from today's troubleshooting session."
echo "You will return to the state at commit 358a49c (11:58 AM)."
echo ""
read -p "Continue with rollback? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled."
    exit 0
fi

echo ""
echo "============================================"
echo "STEP 1: Rolling back code files..."
echo "============================================"

# Restore modified files
echo "Restoring modified API and admin files..."
git restore app/admin/page.tsx
git restore app/api/admin/flags/route.ts
git restore app/api/admin/logs/route.ts
git restore app/api/admin/stats/route.ts
git restore app/api/clubs/[id]/membership/route.ts
git restore app/api/clubs/route.ts
git restore app/api/events/[id]/register/route.ts
git restore app/api/events/route.ts
git restore app/dashboard/page.tsx
git restore next.config.ts

echo "✓ Code files restored to commit 358a49c"

echo ""
echo "============================================"
echo "STEP 2: Deleting troubleshooting files..."
echo "============================================"

# Delete troubleshooting markdown files
echo "Deleting troubleshooting documentation..."
rm -f CLUB_JOIN_FIX_GUIDE.md
rm -f CLUB_MEMBERSHIP_POLICIES_DIAGRAM.md
rm -f CLUB_REJOIN_FIX.md
rm -f FIXES_SUMMARY.md
rm -f INVESTIGATION_SUMMARY.md
rm -f MIGRATION_014_INSTRUCTIONS.md
rm -f MIGRATION_015_GUIDE.md
rm -f QUICK_FIX_GUIDE.md
rm -f QUICK_FIX_STEPS.md
rm -f REJOIN_FIX_SUMMARY.md

echo "Deleting admin component files..."
rm -f components/admin-flags-client.tsx
rm -f components/admin-logs-client.tsx

echo "✓ Troubleshooting files deleted"

echo ""
echo "============================================"
echo "STEP 3: Deleting problematic migrations..."
echo "============================================"

# Delete migrations 009-020
echo "Deleting migrations 009-020..."
rm -f supabase/migrations/009_optimize_admin_rls_policies.sql
rm -f supabase/migrations/010_add_left_status_to_members.sql
rm -f supabase/migrations/011_fix_clubs_insert_policy.sql
rm -f supabase/migrations/012_complete_rls_optimization.sql
rm -f supabase/migrations/013_fix_infinite_recursion.sql
rm -f supabase/migrations/014_fix_rls_and_membership.sql
rm -f supabase/migrations/015_fix_club_join_insert_policy.sql
rm -f supabase/migrations/015_test_queries.sql
rm -f supabase/migrations/016_diagnose_club_join_issue.sql
rm -f supabase/migrations/017_fix_club_join_final.sql
rm -f supabase/migrations/018_rollback_to_015.sql
rm -f supabase/migrations/019_test_club_join.sql
rm -f supabase/migrations/020_add_rejoin_policy.sql

echo "✓ Problematic migrations deleted"

echo ""
echo "============================================"
echo "STEP 4: Current state"
echo "============================================"

# Show current git status
echo ""
echo "Git status:"
git status

echo ""
echo "Remaining migrations:"
ls -1 supabase/migrations/*.sql

echo ""
echo "============================================"
echo "CODE ROLLBACK COMPLETE!"
echo "============================================"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. DATABASE ROLLBACK (REQUIRED):"
echo "   - Open your Supabase Dashboard"
echo "   - Go to SQL Editor"
echo "   - Run the migration: supabase/migrations/021_complete_rollback_to_008.sql"
echo "   - Or use CLI: supabase db push"
echo ""
echo "2. VERIFY ROLLBACK:"
echo "   - Check git status is clean"
echo "   - Test basic app functionality (login, view clubs, join club)"
echo "   - Check database policies are correct"
echo ""
echo "3. CLEANUP (OPTIONAL):"
echo "   - Delete ROLLBACK_INSTRUCTIONS.md when done"
echo "   - Delete this rollback.sh script"
echo ""
echo "See ROLLBACK_INSTRUCTIONS.md for detailed verification steps."
echo "============================================"
