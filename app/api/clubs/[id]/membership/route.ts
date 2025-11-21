import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdmin } from '@/lib/auth/admin';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface Membership {
  role: string;
  status: string;
}

/**
 * GET /api/clubs/[id]/membership
 * Check if current user is a member of the club
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id: clubId } = await context.params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { membership: null }
      );
    }

    // Check membership
    const { data: membership } = await supabase
      .from('club_members')
      .select('role, status')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      membership: membership || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clubs/[id]/membership
 * Join a club
 */
export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id: clubId } = await context.params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if already a member or has pending request
    const { data: existingMembership } = await supabase
      .from('club_members')
      .select('role, status')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .single();

    if (existingMembership) {
      if (existingMembership.status === 'pending') {
        return NextResponse.json(
          { error: 'Membership request is already pending' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Already a member of this club' },
        { status: 400 }
      );
    }

    // Check if user is admin - admins get auto-approved
    const userIsAdmin = await isAdmin(user.id);
    const membershipStatus = userIsAdmin ? 'approved' : 'pending';

    // Add user to club with appropriate status
    const { data: membership, error: insertError } = await supabase
      .from('club_members')
      .insert({
        club_id: clubId,
        user_id: user.id,
        role: 'member',
        status: membershipStatus,
      })
      .select('role, status')
      .single();

    if (insertError) {
      throw new Error(`Failed to join club: ${insertError.message}`);
    }

    return NextResponse.json(
      {
        membership,
        message: userIsAdmin
          ? 'Joined club successfully'
          : 'Membership request submitted successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clubs/[id]/membership
 * Approve or reject membership request (admin only)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id: clubId } = await context.params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { user_id, action } = body;

    if (!user_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id and action' },
        { status: 400 }
      );
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Check if current user is admin of the club
    const { data: club } = await supabase
      .from('clubs')
      .select('created_by')
      .eq('id', clubId)
      .single();

    if (!club || club.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Only club admins can approve or reject membership requests' },
        { status: 403 }
      );
    }

    // Update membership status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { data: membership, error: updateError } = await supabase
      .from('club_members')
      .update({ status: newStatus })
      .eq('club_id', clubId)
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .select('role, status')
      .single();

    if (updateError) {
      throw new Error(`Failed to update membership: ${updateError.message}`);
    }

    if (!membership) {
      return NextResponse.json(
        { error: 'No pending membership request found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      membership,
      message: `Membership request ${action}d successfully`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clubs/[id]/membership
 * Leave a club
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id: clubId } = await context.params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete membership
    const { error: deleteError } = await supabase
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', user.id);

    if (deleteError) {
      throw new Error(`Failed to leave club: ${deleteError.message}`);
    }

    return NextResponse.json(
      { message: 'Successfully left club' }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
