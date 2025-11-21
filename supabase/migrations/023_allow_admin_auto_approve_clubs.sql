-- Migration: Allow admins to auto-approve clubs they create
-- Created: 2025-11-19
-- Description: Updates the clubs_insert RLS policy to allow admins to create clubs
--              with approval_status = 'approved', while requiring students to use 'pending'

-- Drop the existing clubs_insert policy
DROP POLICY IF EXISTS clubs_insert ON clubs;

-- Create updated clubs_insert policy
-- Allows authenticated users to create clubs with these conditions:
-- 1. They must be the creator (auth.uid() = created_by)
-- 2. Admins can set approval_status to 'approved' or 'pending'
-- 3. Non-admins must set approval_status to 'pending'
CREATE POLICY clubs_insert
ON clubs
FOR INSERT
WITH CHECK (
    auth.uid() = created_by
    AND (
        -- Non-admins must use pending status
        (NOT is_admin(auth.uid()) AND approval_status = 'pending')
        OR
        -- Admins can use either pending or approved status
        (is_admin(auth.uid()) AND approval_status IN ('pending', 'approved'))
    )
);
