import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteParams {
  params: Promise<{
    id: string;
    announcementId: string;
  }>;
}

/**
 * GET /api/clubs/[id]/announcements/[announcementId]
 * Get a single announcement with creator profile information
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id: clubId, announcementId } = await context.params;
    const supabase = await createClient();

    // Fetch announcement
    const { data: announcement, error } = await supabase
      .from('club_announcements')
      .select('*')
      .eq('id', announcementId)
      .eq('club_id', clubId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Announcement not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to fetch announcement', details: error.message },
        { status: 500 }
      );
    }

    // Fetch the creator's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', announcement.created_by)
      .single();

    return NextResponse.json({
      announcement: {
        ...announcement,
        profile: profile || null,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/clubs/[id]/announcements/[announcementId]:', error);
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
 * PUT /api/clubs/[id]/announcements/[announcementId]
 * Update an announcement
 * Authorization is handled by RLS policies
 */
export async function PUT(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id: clubId, announcementId } = await context.params;
    const supabase = await createClient();

    // Check authentication
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

    // Parse request body
    const body = await request.json();
    const { title, content } = body;

    // Validate required fields
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: title and content' },
        { status: 400 }
      );
    }

    // Validate title length (1-200 characters)
    if (typeof title !== 'string' || title.trim().length < 1 || title.trim().length > 200) {
      return NextResponse.json(
        { error: 'Title must be between 1 and 200 characters' },
        { status: 400 }
      );
    }

    // Validate content length (1-5000 characters)
    if (typeof content !== 'string' || content.trim().length < 1 || content.trim().length > 5000) {
      return NextResponse.json(
        { error: 'Content must be between 1 and 5000 characters' },
        { status: 400 }
      );
    }

    // Update announcement - RLS policies will handle authorization
    const { data: announcement, error: updateError } = await supabase
      .from('club_announcements')
      .update({
        title: title.trim(),
        content: content.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', announcementId)
      .eq('club_id', clubId)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Announcement not found or you do not have permission to update it' },
          { status: 404 }
        );
      }

      // Check if it's a permission error
      if (updateError.code === '42501' || updateError.message.includes('permission')) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to update this announcement' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to update announcement', details: updateError.message },
        { status: 500 }
      );
    }

    // Fetch the creator's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', announcement.created_by)
      .single();

    return NextResponse.json({
      announcement: {
        ...announcement,
        profile: profile || null,
      },
      message: 'Announcement updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/clubs/[id]/announcements/[announcementId]:', error);
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
 * DELETE /api/clubs/[id]/announcements/[announcementId]
 * Delete an announcement
 * Authorization is handled by RLS policies
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id: clubId, announcementId } = await context.params;
    const supabase = await createClient();

    // Check authentication
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

    // Delete announcement - RLS policies will handle authorization
    const { error: deleteError } = await supabase
      .from('club_announcements')
      .delete()
      .eq('id', announcementId)
      .eq('club_id', clubId);

    if (deleteError) {
      // Check if it's a permission error
      if (deleteError.code === '42501' || deleteError.message.includes('permission')) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to delete this announcement' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to delete announcement', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Announcement deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/clubs/[id]/announcements/[announcementId]:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
