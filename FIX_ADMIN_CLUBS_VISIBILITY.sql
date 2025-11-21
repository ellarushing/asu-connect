-- Quick Fix: Approve all clubs created by admins that are currently pending
-- This fixes clubs that were created before migration 023 was applied

-- ============================================================================
-- STEP 1: Preview clubs that will be updated
-- ============================================================================
SELECT
  c.id,
  c.name,
  c.approval_status,
  c.created_at,
  p.email as creator_email,
  p.is_admin as creator_is_admin
FROM clubs c
INNER JOIN profiles p ON p.id = c.created_by
WHERE p.is_admin = true
  AND c.approval_status = 'pending';

-- ============================================================================
-- STEP 2: Approve all admin-created clubs (UNCOMMENT TO RUN)
-- ============================================================================
-- UPDATE clubs
-- SET
--   approval_status = 'approved',
--   approved_at = NOW(),
--   rejection_reason = NULL
-- WHERE created_by IN (
--   SELECT id FROM profiles WHERE is_admin = true
-- )
-- AND approval_status = 'pending';

-- ============================================================================
-- STEP 3: Verify the fix worked
-- ============================================================================
-- Run this after the UPDATE to confirm all admin clubs are approved:
-- SELECT
--   c.id,
--   c.name,
--   c.approval_status,
--   p.email as creator_email
-- FROM clubs c
-- INNER JOIN profiles p ON p.id = c.created_by
-- WHERE p.is_admin = true
-- ORDER BY c.created_at DESC;
