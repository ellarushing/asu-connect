import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin, handleAdminError } from '@/lib/auth/admin';

/**
 * GET /api/admin/flags
 * Fetch all event and club flags across the platform (admin only)
 * Query params:
 *   - status: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
 *   - type: 'event' | 'club'
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
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate status if provided
    if (status && !['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: pending, reviewed, resolved, or dismissed' },
        { status: 400 }
      );
    }

    // Validate type if provided
    if (type && !['event', 'club'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: event or club' },
        { status: 400 }
      );
    }

    const flags: Array<{
      id: string;
      entity_id: string;
      entity_type: string;
      entity_title: string;
      user_id: string;
      user_email: string | null;
      reason: string;
      details: string | null;
      status: string;
      reviewed_by: string | null;
      reviewer_email: string | null;
      reviewed_at: string | null;
      created_at: string;
      updated_at: string;
    }> = [];

    // Fetch event flags if type is 'event' or not specified
    if (!type || type === 'event') {
      let eventQuery = supabase
        .from('event_flags')
        .select(`
          id,
          event_id,
          user_id,
          reason,
          details,
          status,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at,
          event:events (
            id,
            title
          ),
          reporter:user_id (
            email
          ),
          reviewer:reviewed_by (
            email
          )
        `);

      if (status) {
        eventQuery = eventQuery.eq('status', status);
      }

      const { data: eventFlags, error: eventFlagsError } = await eventQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (eventFlagsError) {
        console.error('Error fetching event flags:', eventFlagsError);
        return NextResponse.json(
          { error: 'Failed to fetch event flags', details: eventFlagsError.message },
          { status: 500 }
        );
      }

      if (eventFlags) {
        flags.push(
          ...eventFlags.map((flag: any) => ({
            id: flag.id,
            entity_id: flag.event_id,
            entity_type: 'event',
            entity_title: flag.event?.title || 'Unknown Event',
            user_id: flag.user_id,
            user_email: flag.reporter?.email || null,
            reason: flag.reason,
            details: flag.details,
            status: flag.status,
            reviewed_by: flag.reviewed_by,
            reviewer_email: flag.reviewer?.email || null,
            reviewed_at: flag.reviewed_at,
            created_at: flag.created_at,
            updated_at: flag.updated_at,
          }))
        );
      }
    }

    // Fetch club flags if type is 'club' or not specified
    if (!type || type === 'club') {
      let clubQuery = supabase
        .from('club_flags')
        .select(`
          id,
          club_id,
          user_id,
          reason,
          details,
          status,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at,
          club:clubs (
            id,
            name
          ),
          reporter:user_id (
            email
          ),
          reviewer:reviewed_by (
            email
          )
        `);

      if (status) {
        clubQuery = clubQuery.eq('status', status);
      }

      const { data: clubFlags, error: clubFlagsError } = await clubQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (clubFlagsError) {
        console.error('Error fetching club flags:', clubFlagsError);
        return NextResponse.json(
          { error: 'Failed to fetch club flags', details: clubFlagsError.message },
          { status: 500 }
        );
      }

      if (clubFlags) {
        flags.push(
          ...clubFlags.map((flag: any) => ({
            id: flag.id,
            entity_id: flag.club_id,
            entity_type: 'club',
            entity_title: flag.club?.name || 'Unknown Club',
            user_id: flag.user_id,
            user_email: flag.reporter?.email || null,
            reason: flag.reason,
            details: flag.details,
            status: flag.status,
            reviewed_by: flag.reviewed_by,
            reviewer_email: flag.reviewer?.email || null,
            reviewed_at: flag.reviewed_at,
            created_at: flag.created_at,
            updated_at: flag.updated_at,
          }))
        );
      }
    }

    // Sort combined flags by created_at descending
    flags.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Get counts for statistics
    const [eventFlagsCount, clubFlagsCount] = await Promise.all([
      supabase
        .from('event_flags')
        .select('id', { count: 'exact', head: true })
        .then((res) => res.count || 0),
      supabase
        .from('club_flags')
        .select('id', { count: 'exact', head: true })
        .then((res) => res.count || 0),
    ]);

    const [eventFlagsPending, clubFlagsPending] = await Promise.all([
      supabase
        .from('event_flags')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then((res) => res.count || 0),
      supabase
        .from('club_flags')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then((res) => res.count || 0),
    ]);

    return NextResponse.json(
      {
        flags,
        statistics: {
          total: eventFlagsCount + clubFlagsCount,
          event_flags: eventFlagsCount,
          club_flags: clubFlagsCount,
          pending: eventFlagsPending + clubFlagsPending,
          event_flags_pending: eventFlagsPending,
          club_flags_pending: clubFlagsPending,
        },
        pagination: {
          limit,
          offset,
          returned: flags.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/admin/flags:', error);
    return handleAdminError(error);
  }
}
