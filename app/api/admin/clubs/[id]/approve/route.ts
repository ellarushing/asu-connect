import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin, handleAdminError, logModerationAction, ModerationAction } from '@/lib/auth/admin';

/**
 * POST /api/admin/clubs/[id]/approve
 * Approve a club (admin only)
 * Updates approval_status to 'approved', sets approved_by and approved_at
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

    // Check if club exists and get current status
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select(`
        id,
        name,
        description,
        approval_status,
        created_by,
        creator:created_by (
          id,
          email
        )
      `)
      .eq('id', id)
      .single();

    if (clubError || !club) {
      return NextResponse.json(
        { error: 'Club not found' },
        { status: 404 }
      );
    }

    // Check if club is already approved
    if (club.approval_status === 'approved') {
      return NextResponse.json(
        { error: 'Club is already approved' },
        { status: 400 }
      );
    }

    // Update club approval status
    const { data: approvedClub, error: updateError } = await supabase
      .from('clubs')
      .update({
        approval_status: 'approved',
        approved_by: admin.id,
        approved_at: new Date().toISOString(),
        rejection_reason: null, // Clear any previous rejection reason
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
        created_by,
        created_at,
        updated_at
      `)
      .single();

    if (updateError) {
      console.error('Error approving club:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve club', details: updateError.message },
        { status: 500 }
      );
    }

    // Log moderation action
    await logModerationAction(
      admin.id,
      ModerationAction.APPROVE_CLUB,
      'club',
      id,
      {
        club_name: club.name,
        previous_status: club.approval_status,
        creator_id: club.created_by,
        creator_email: club.creator?.email,
      }
    );

    return NextResponse.json(
      {
        club: approvedClub,
        message: 'Club approved successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in POST /api/admin/clubs/[id]/approve:', error);
    return handleAdminError(error);
  }
}
