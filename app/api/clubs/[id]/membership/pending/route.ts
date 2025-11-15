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
    // Note: If profiles table doesn't exist, this will fail with a foreign key error
    // In that case, fall back to fetching just the user_id
    let pendingRequests: PendingMember[] = [];

    // First, try to get requests with profile data
    const { data: requestsData, error: fetchError } = await supabase
      .from('club_members')
      .select(`
        id,
        user_id,
        role,
        status,
        joined_at
      `)
      .eq('club_id', clubId)
      .eq('status', 'pending')
      .order('joined_at', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch pending requests: ${fetchError.message}`);
    }

    // Now try to enrich with profile data
    if (requestsData && requestsData.length > 0) {
      const userIds = requestsData.map((req: any) => req.user_id);

      // Try to fetch profiles (this might fail if table doesn't exist)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      // Map profiles to requests
      pendingRequests = requestsData.map((req: any) => {
        const profile = profilesData?.find((p: any) => p.id === req.user_id);
        return {
          ...req,
          profiles: profile ? { full_name: profile.full_name, email: profile.email } : null
        };
      });
    }

    return NextResponse.json({
      pending_requests: pendingRequests,
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
