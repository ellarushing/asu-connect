-- Migration 007: Fix triggers to handle NULL admin/reviewer IDs
-- Fixes constraint violations when moderation_logs.admin_id is NULL

-- Fix club approval logging
CREATE OR REPLACE FUNCTION log_club_approval_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
        IF NEW.approval_status = 'approved' AND NEW.approved_by IS NOT NULL THEN
            PERFORM log_moderation_action(
                NEW.approved_by,
                'club_approved',
                'club',
                NEW.id,
                jsonb_build_object(
                    'club_name', NEW.name,
                    'previous_status', OLD.approval_status
                )
            );
        ELSIF NEW.approval_status = 'rejected' AND NEW.approved_by IS NOT NULL THEN
            PERFORM log_moderation_action(
                NEW.approved_by,
                'club_rejected',
                'club',
                NEW.id,
                jsonb_build_object(
                    'club_name', NEW.name,
                    'previous_status', OLD.approval_status,
                    'rejection_reason', NEW.rejection_reason
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix club flag resolution logging
CREATE OR REPLACE FUNCTION log_club_flag_resolution()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('resolved', 'dismissed') THEN
        IF NEW.reviewed_by IS NOT NULL THEN
            PERFORM log_moderation_action(
                NEW.reviewed_by,
                CASE
                    WHEN NEW.status = 'resolved' THEN 'resolve_flag'
                    WHEN NEW.status = 'dismissed' THEN 'dismiss_flag'
                END,
                'flag',
                NEW.id,
                jsonb_build_object(
                    'flag_type', 'club',
                    'club_id', NEW.club_id,
                    'previous_status', OLD.status
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
