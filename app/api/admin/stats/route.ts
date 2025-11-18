import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin, handleAdminError } from '@/lib/auth/admin';

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics (admin only)
 * Returns:
 *   - Pending flags count (event + club)
 *   - Pending clubs count
 *   - Recent moderation activity
 *   - Summary statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const admin = await requireAdmin();

    const supabase = await createClient();

    // Fetch all statistics in parallel for better performance
    const [
      eventFlagsPending,
      clubFlagsPending,
      eventFlagsTotal,
      clubFlagsTotal,
      clubsPending,
      clubsApproved,
      clubsRejected,
      clubsTotal,
      recentModerationLogs,
    ] = await Promise.all([
      // Event flags - pending
      supabase
        .from('event_flags')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then((res) => res.count || 0),

      // Club flags - pending
      supabase
        .from('club_flags')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then((res) => res.count || 0),

      // Event flags - total
      supabase
        .from('event_flags')
        .select('id', { count: 'exact', head: true })
        .then((res) => res.count || 0),

      // Club flags - total
      supabase
        .from('club_flags')
        .select('id', { count: 'exact', head: true })
        .then((res) => res.count || 0),

      // Clubs - pending approval
      supabase
        .from('clubs')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'pending')
        .then((res) => res.count || 0),

      // Clubs - approved
      supabase
        .from('clubs')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'approved')
        .then((res) => res.count || 0),

      // Clubs - rejected
      supabase
        .from('clubs')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'rejected')
        .then((res) => res.count || 0),

      // Clubs - total
      supabase
        .from('clubs')
        .select('id', { count: 'exact', head: true })
        .then((res) => res.count || 0),

      // Recent moderation logs (last 10)
      supabase
        .from('moderation_logs')
        .select(`
          id,
          admin_id,
          action,
          entity_type,
          entity_id,
          details,
          created_at,
          admin:admin_id (
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10)
        .then((res) => res.data || []),
    ]);

    // Get flags by status breakdown
    const [
      eventFlagsReviewed,
      eventFlagsResolved,
      eventFlagsDismissed,
      clubFlagsReviewed,
      clubFlagsResolved,
      clubFlagsDismissed,
    ] = await Promise.all([
      supabase
        .from('event_flags')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'reviewed')
        .then((res) => res.count || 0),
      supabase
        .from('event_flags')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'resolved')
        .then((res) => res.count || 0),
      supabase
        .from('event_flags')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'dismissed')
        .then((res) => res.count || 0),
      supabase
        .from('club_flags')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'reviewed')
        .then((res) => res.count || 0),
      supabase
        .from('club_flags')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'resolved')
        .then((res) => res.count || 0),
      supabase
        .from('club_flags')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'dismissed')
        .then((res) => res.count || 0),
    ]);

    // Format recent activity
    const recentActivity = recentModerationLogs.map((log: any) => ({
      id: log.id,
      admin_id: log.admin_id,
      admin_email: log.admin?.email || 'Unknown',
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      details: log.details,
      created_at: log.created_at,
    }));

    // Calculate summary statistics
    const totalPendingItems = eventFlagsPending + clubFlagsPending + clubsPending;

    return NextResponse.json(
      {
        summary: {
          total_pending_items: totalPendingItems,
          pending_flags: eventFlagsPending + clubFlagsPending,
          pending_clubs: clubsPending,
          requires_attention: totalPendingItems > 0,
        },
        flags: {
          event_flags: {
            total: eventFlagsTotal,
            pending: eventFlagsPending,
            reviewed: eventFlagsReviewed,
            resolved: eventFlagsResolved,
            dismissed: eventFlagsDismissed,
          },
          club_flags: {
            total: clubFlagsTotal,
            pending: clubFlagsPending,
            reviewed: clubFlagsReviewed,
            resolved: clubFlagsResolved,
            dismissed: clubFlagsDismissed,
          },
          combined: {
            total: eventFlagsTotal + clubFlagsTotal,
            pending: eventFlagsPending + clubFlagsPending,
            reviewed: eventFlagsReviewed + clubFlagsReviewed,
            resolved: eventFlagsResolved + clubFlagsResolved,
            dismissed: eventFlagsDismissed + clubFlagsDismissed,
          },
        },
        clubs: {
          total: clubsTotal,
          pending: clubsPending,
          approved: clubsApproved,
          rejected: clubsRejected,
          approval_rate: clubsTotal > 0
            ? ((clubsApproved / clubsTotal) * 100).toFixed(1) + '%'
            : '0%',
        },
        recent_activity: recentActivity,
        fetched_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/admin/stats:', error);
    return handleAdminError(error);
  }
}
