#!/bin/bash

# ============================================================================
# ROLLBACK VERIFICATION SCRIPT
# ============================================================================
# Run this after completing the rollback to verify everything is correct
# ============================================================================

set -e

PROJECT_ROOT="/Users/ellarushing/downloads/asu-connect"
cd "$PROJECT_ROOT"

echo "============================================"
echo "ASU Connect - Rollback Verification"
echo "============================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

echo "Checking rollback status..."
echo ""

# ============================================================================
# Check 1: Git Status
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CHECK 1: Git Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

GIT_STATUS=$(git status --porcelain)
if [ -z "$GIT_STATUS" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Working directory is clean"
else
    echo -e "${RED}✗ FAIL${NC} - Working directory has uncommitted changes:"
    echo "$GIT_STATUS"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ============================================================================
# Check 2: Current Commit
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CHECK 2: Current Commit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CURRENT_COMMIT=$(git rev-parse --short HEAD)
EXPECTED_COMMIT="358a49c"

if [ "$CURRENT_COMMIT" = "$EXPECTED_COMMIT" ]; then
    echo -e "${GREEN}✓ PASS${NC} - On expected commit: $CURRENT_COMMIT"
    git log -1 --oneline
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Current commit: $CURRENT_COMMIT"
    echo "Expected commit: $EXPECTED_COMMIT"
    echo "Current commit:"
    git log -1 --oneline
    echo ""
    echo "This might be OK if you had other commits after 358a49c"
fi
echo ""

# ============================================================================
# Check 3: Troubleshooting Files Deleted
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CHECK 3: Troubleshooting Files Deleted"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TROUBLE_FILES=(
    "CLUB_JOIN_FIX_GUIDE.md"
    "CLUB_MEMBERSHIP_POLICIES_DIAGRAM.md"
    "CLUB_REJOIN_FIX.md"
    "FIXES_SUMMARY.md"
    "INVESTIGATION_SUMMARY.md"
    "MIGRATION_014_INSTRUCTIONS.md"
    "MIGRATION_015_GUIDE.md"
    "QUICK_FIX_GUIDE.md"
    "QUICK_FIX_STEPS.md"
    "REJOIN_FIX_SUMMARY.md"
    "components/admin-flags-client.tsx"
    "components/admin-logs-client.tsx"
)

TROUBLE_FOUND=0
for file in "${TROUBLE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${RED}✗${NC} Found: $file"
        TROUBLE_FOUND=$((TROUBLE_FOUND + 1))
    fi
done

if [ $TROUBLE_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC} - All troubleshooting files deleted"
else
    echo -e "${RED}✗ FAIL${NC} - Found $TROUBLE_FOUND troubleshooting files"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ============================================================================
# Check 4: Migration Files
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CHECK 4: Migration Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

BAD_MIGRATIONS=(
    "supabase/migrations/009_optimize_admin_rls_policies.sql"
    "supabase/migrations/010_add_left_status_to_members.sql"
    "supabase/migrations/011_fix_clubs_insert_policy.sql"
    "supabase/migrations/012_complete_rls_optimization.sql"
    "supabase/migrations/013_fix_infinite_recursion.sql"
    "supabase/migrations/014_fix_rls_and_membership.sql"
    "supabase/migrations/015_fix_club_join_insert_policy.sql"
    "supabase/migrations/015_test_queries.sql"
    "supabase/migrations/016_diagnose_club_join_issue.sql"
    "supabase/migrations/017_fix_club_join_final.sql"
    "supabase/migrations/018_rollback_to_015.sql"
    "supabase/migrations/019_test_club_join.sql"
    "supabase/migrations/020_add_rejoin_policy.sql"
)

BAD_MIGRATIONS_FOUND=0
for migration in "${BAD_MIGRATIONS[@]}"; do
    if [ -f "$migration" ]; then
        echo -e "${RED}✗${NC} Found: $(basename $migration)"
        BAD_MIGRATIONS_FOUND=$((BAD_MIGRATIONS_FOUND + 1))
    fi
done

if [ $BAD_MIGRATIONS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC} - All problematic migrations deleted"
else
    echo -e "${RED}✗ FAIL${NC} - Found $BAD_MIGRATIONS_FOUND bad migration files"
    ERRORS=$((ERRORS + 1))
fi

# Check if rollback migration exists
if [ -f "supabase/migrations/021_complete_rollback_to_008.sql" ]; then
    echo -e "${GREEN}✓${NC} Rollback migration exists"
else
    echo -e "${RED}✗${NC} Rollback migration NOT found"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "Current migrations:"
ls -1 supabase/migrations/*.sql | while read file; do
    basename "$file"
done
echo ""

# ============================================================================
# Check 5: API Route Files
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CHECK 5: API Route Files Restored"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if membership route has uncommitted changes
if git diff --quiet app/api/clubs/[id]/membership/route.ts; then
    echo -e "${GREEN}✓ PASS${NC} - membership/route.ts restored"
else
    echo -e "${RED}✗ FAIL${NC} - membership/route.ts has changes"
    ERRORS=$((ERRORS + 1))
fi

# Check other key files
KEY_FILES=(
    "app/admin/page.tsx"
    "app/api/admin/flags/route.ts"
    "app/api/clubs/route.ts"
    "app/api/events/route.ts"
)

for file in "${KEY_FILES[@]}"; do
    if git diff --quiet "$file"; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file has changes"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VERIFICATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓✓✓ CODE ROLLBACK SUCCESSFUL! ✓✓✓${NC}"
    echo ""
    echo "All code files have been rolled back correctly."
    echo ""
    echo "NEXT STEP: Database Rollback"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "You still need to rollback the database:"
    echo ""
    echo "1. Open your Supabase Dashboard"
    echo "2. Go to SQL Editor"
    echo "3. Run the migration file:"
    echo "   supabase/migrations/021_complete_rollback_to_008.sql"
    echo ""
    echo "OR use the Supabase CLI:"
    echo "   supabase db push"
    echo ""
    echo "After running the database migration, test your app:"
    echo "  • Login"
    echo "  • View clubs"
    echo "  • Join a club"
    echo "  • Check admin dashboard"
    echo ""
else
    echo -e "${RED}✗✗✗ ROLLBACK INCOMPLETE ✗✗✗${NC}"
    echo ""
    echo "Found $ERRORS issue(s) during verification."
    echo ""
    echo "Please review the errors above and:"
    echo "1. Delete any remaining troubleshooting files"
    echo "2. Delete bad migration files (009-020)"
    echo "3. Restore any modified code files"
    echo ""
    echo "Then run this verification script again."
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit $ERRORS
