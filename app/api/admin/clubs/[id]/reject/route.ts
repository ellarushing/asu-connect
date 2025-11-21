import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin, handleAdminError, logModerationAction, ModerationAction } from '@/lib/auth/admin';

/**
 * POST /api/admin/clubs/[id]/reject
 * Reject a club (admin only)
 * Body: { reason: string }
 * Updates approval_status to 'rejected', sets rejection_reason
 * Logs moderation action
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify admin access
    const admin = await requireAdmin();

    const supabase = await createClient();

    // Parse request body
    const body = await request.json();
    const { reason } = body;

    // Validate reason
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    if (reason.length > 500) {
      return NextResponse.json(
        { error: 'Rejection reason must be 500 characters or less' },
        { status: 400 }
      );
    }

    // Check if club exists and get current status (without join to avoid foreign key issues)
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select(`
        id,
        name,
        description,
        approval_status,
        created_by
      `)
      .eq('id', id)
      .single();

    if (clubError || !club) {
      return NextResponse.json(
        { error: 'Club not found' },
        { status: 404 }
      );
    }

    // Fetch creator profile separately to avoid foreign key issues
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', club.created_by)
      .single();

    // Check if club is already rejected
    if (club.approval_status === 'rejected') {
      return NextResponse.json(
        { error: 'Club is already rejected' },
        { status: 400 }
      );
    }

    // Update club approval status
    const { data: rejectedClub, error: updateError } = await supabase
      .from('clubs')
      .update({
        approval_status: 'rejected',
        approved_by: admin.id,
        approved_at: new Date().toISOString(),
        rejection_reason: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        id,
        name,
        description,
        approval_status,
        approved_by,
        approved_at,
        rejection_reason,
        created_by,
        created_at,
        updated_at
      `)
      .single();

    if (updateError) {
      console.error('Error rejecting club:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject club', details: updateError.message },
        { status: 500 }
      );
    }

    // Log moderation action
    await logModerationAction(
      admin.id,
      ModerationAction.REJECT_CLUB,
      'club',
      id,
      {
        club_name: club.name,
        previous_status: club.approval_status,
        rejection_reason: reason.trim(),
        creator_id: club.created_by,
        creator_email: creatorProfile?.email || null,
      }
    );

    return NextResponse.json(
      {
        club: rejectedClub,
        message: 'Club rejected successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in POST /api/admin/clubs/[id]/reject:', error);
    return handleAdminError(error);
  }
}
