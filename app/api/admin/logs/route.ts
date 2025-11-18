import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin, handleAdminError } from '@/lib/auth/admin';

/**
 * GET /api/admin/logs
 * Fetch moderation logs from the system (admin only)
 * Query params:
 *   - action: Filter by specific action type (optional)
 *   - entity_type: Filter by entity type: 'club', 'event', 'flag', 'user' (optional)
 *   - limit: Number of logs to return (default 50, max 100)
 *   - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const admin = await requireAdmin();

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entity_type') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate entity_type if provided
    if (entityType && !['club', 'event', 'flag', 'user'].includes(entityType)) {
      return NextResponse.json(
        { error: 'Invalid entity_type. Must be: club, event, flag, or user' },
        { status: 400 }
      );
    }

    // Build the query
    let query = supabase
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
          email,
          full_name
        )
      `, { count: 'exact' });

    // Apply filters if provided
    if (action) {
      query = query.eq('action', action);
    }

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    // Execute query with ordering and pagination
    const { data: logs, error: logsError, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (logsError) {
      console.error('Error fetching moderation logs:', logsError);
      return NextResponse.json(
        { error: 'Failed to fetch moderation logs', details: logsError.message },
        { status: 500 }
      );
    }

    // Format the logs with admin info
    const formattedLogs = (logs || []).map((log: any) => ({
      id: log.id,
      admin_id: log.admin_id,
      admin_email: log.admin?.email || null,
      admin_name: log.admin?.full_name || null,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      details: log.details,
      created_at: log.created_at,
    }));

    return NextResponse.json(
      {
        logs: formattedLogs,
        pagination: {
          total: count || 0,
          limit,
          offset,
          returned: formattedLogs.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/admin/logs:', error);
    return handleAdminError(error);
  }
}
