import { NextRequest, NextResponse } from 'next/server';
import { handleAdminError } from '@/lib/auth/admin';
import { getAdminStats } from '@/lib/admin/stats';

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics (admin only)
 *
 * Returns:
 *   - Pending flags count (event + club)
 *   - Pending clubs count
 *   - Recent moderation activity
 *   - Summary statistics
 *
 * This endpoint uses the shared getAdminStats() function from lib/admin/stats.ts
 * which is also used by the admin dashboard server component to avoid port mismatches.
 */
export async function GET(request: NextRequest) {
  try {
    // Use the shared getAdminStats function which handles:
    // - Admin authentication/authorization
    // - Database queries
    // - Data formatting
    const stats = await getAdminStats();

    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/admin/stats:', error);
    return handleAdminError(error);
  }
}
