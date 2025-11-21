/**
 * Admin Dashboard Statistics
 *
 * Shared utility functions for fetching admin dashboard statistics.
 * This module provides reusable database query logic that can be used by both:
 * - API routes (/api/admin/stats)
 * - Server components (app/admin/page.tsx)
 *
 * This eliminates the port mismatch issue where server components were making
 * fetch calls to hardcoded URLs that became stale as Next.js auto-incremented ports.
 */

import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AdminStats {
  summary: {
    total_pending_items: number;
    pending_flags: number;
    pending_clubs: number;
    requires_attention: boolean;
  };
  flags: {
    event_flags: {
      total: number;
      pending: number;
      reviewed: number;
      resolved: number;
      dismissed: number;
    };
    club_flags: {
      total: number;
      pending: number;
      reviewed: number;
      resolved: number;
      dismissed: number;
    };
    combined: {
      total: number;
      pending: number;
      reviewed: number;
      resolved: number;
      dismissed: number;
    };
  };
  clubs: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    approval_rate: string;
  };
  recent_activity: Array<{
    id: string;
    admin_id: string;
    admin_email: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: Record<string, unknown> | null;
    created_at: string;
  }>;
  fetched_at: string;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Fetch comprehensive admin dashboard statistics
 *
 * This function:
 * 1. Verifies the caller is an admin (throws if not)
 * 2. Queries the database for all relevant statistics
 * 3. Returns formatted statistics for the admin dashboard
 *
 * @throws {AdminAuthError} If user is not authenticated or not an admin
 * @returns Promise<AdminStats> - Comprehensive admin dashboard statistics
 *
 * @example
 * ```typescript
 * // In a server component
 * const stats = await getAdminStats();
 *
 * // In an API route
 * try {
 *   const stats = await getAdminStats();
 *   return Response.json(stats);
 * } catch (error) {
 *   return handleAdminError(error);
 * }
 * ```
 */
export async function getAdminStats(): Promise<AdminStats> {
  // Verify admin access - this will throw AdminAuthError if unauthorized
  await requireAdmin();

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
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(async (res) => {
        if (!res.data) return [];

        // Fetch admin emails separately
        const adminIds = [...new Set(res.data.map((log) => log.admin_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', adminIds);

        const profileMap = new Map(
          profiles?.map((p) => [p.id, p.email]) || []
        );

        return res.data.map((log) => ({
          ...log,
          admin_email: profileMap.get(log.admin_id) || 'Unknown',
        }));
      }),
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

  // Format recent activity (already has admin_email from the query)
  const recentActivity = recentModerationLogs.map((log: any) => ({
    id: log.id,
    admin_id: log.admin_id,
    admin_email: log.admin_email,
    action: log.action,
    entity_type: log.entity_type,
    entity_id: log.entity_id,
    details: log.details,
    created_at: log.created_at,
  }));

  // Calculate summary statistics
  const totalPendingItems = eventFlagsPending + clubFlagsPending + clubsPending;

  return {
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
      approval_rate:
        clubsTotal > 0
          ? ((clubsApproved / clubsTotal) * 100).toFixed(1) + '%'
          : '0%',
    },
    recent_activity: recentActivity,
    fetched_at: new Date().toISOString(),
  };
}
