-- Migration 006: Approve existing pending clubs
-- This is a one-time migration to approve all clubs that were created before the approval workflow was fully implemented
-- Date: 2025-11-18

-- Update all pending clubs to approved status
-- Sets approved_by to NULL to avoid triggering moderation logging (which requires admin_id NOT NULL)
-- This is a system migration that pre-approves clubs created before the approval workflow
UPDATE clubs
SET
  approval_status = 'approved',
  approved_at = NOW(),
  approved_by = NULL,
  updated_at = NOW()
WHERE approval_status = 'pending';

-- Add a comment to track this migration
COMMENT ON TABLE clubs IS 'Clubs table - Migration 006 applied: approved all existing pending clubs on 2025-11-18';
