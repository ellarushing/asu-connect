import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin, handleAdminError } from '@/lib/auth/admin';

/**
 * GET /api/admin/clubs/pending
 * Fetch all clubs with approval_status = 'pending' (admin only)
 * Query params:
 *   - limit: number (default 50, max 100)
 *   - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const admin = await requireAdmin();

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch pending clubs (without join to avoid foreign key issues)
    const { data: pendingClubs, error: clubsError } = await supabase
      .from('clubs')
      .select(`
        id,
        name,
        description,
        created_by,
        created_at,
        updated_at,
        approval_status,
        approved_by,
        approved_at,
        rejection_reason
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (clubsError) {
      console.error('Error fetching pending clubs:', clubsError);
      return NextResponse.json(
        { error: 'Failed to fetch pending clubs', details: clubsError.message },
        { status: 500 }
      );
    }

    // Get total count of pending clubs
    const { count: totalCount, error: countError } = await supabase
      .from('clubs')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending');

    if (countError) {
      console.error('Error counting pending clubs:', countError);
    }

    // Fetch creator profiles separately to avoid foreign key issues
    const creatorIds = [...new Set((pendingClubs || []).map((club: any) => club.created_by))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', creatorIds);

    // Create a map for quick lookup
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Format the response
    const formattedClubs = pendingClubs?.map((club: any) => ({
      id: club.id,
      name: club.name,
      description: club.description,
      created_by: club.created_by,
      creator_email: profileMap.get(club.created_by)?.email || null,
      created_at: club.created_at,
      updated_at: club.updated_at,
      approval_status: club.approval_status,
      approved_by: club.approved_by,
      approved_at: club.approved_at,
      rejection_reason: club.rejection_reason,
    })) || [];

    return NextResponse.json(
      {
        clubs: formattedClubs,
        pagination: {
          limit,
          offset,
          total: totalCount || 0,
          returned: formattedClubs.length,
        },
        statistics: {
          total_pending: totalCount || 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/admin/clubs/pending:', error);
    return handleAdminError(error);
  }
}
