import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface PendingMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

/**
 * GET /api/clubs/[id]/membership/pending
 * Get all pending membership requests for a club (admin only)
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
        { error: 'Unauthorized' },
        { status: 401 }
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
        { error: 'Only club admins can view pending membership requests' },
        { status: 403 }
      );
    }

    // Get pending membership requests with user info
    const { data: pendingRequests, error: fetchError } = await supabase
      .from('club_members')
      .select(`
        id,
        user_id,
        role,
        status,
        joined_at,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .eq('club_id', clubId)
      .eq('status', 'pending')
      .order('joined_at', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch pending requests: ${fetchError.message}`);
    }

    return NextResponse.json({
      pending_requests: pendingRequests || [],
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
