import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

interface Club {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ClubUpdateInput {
  name?: string;
  description?: string;
}

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// ============================================================================
// COMMAND PATTERN - Update and Delete Operations
// ============================================================================

interface Command<T> {
  execute(): Promise<T>;
}

class UpdateClubCommand implements Command<Club> {
  private clubId: string;
  private updates: ClubUpdateInput;
  private userId: string;

  constructor(clubId: string, updates: ClubUpdateInput, userId: string) {
    this.clubId = clubId;
    this.updates = updates;
    this.userId = userId;
  }

  async execute(): Promise<Club> {
    const supabase = await createClient();

    // Verify ownership
    const { data: existingClub, error: fetchError } = await supabase
      .from('clubs')
      .select('created_by')
      .eq('id', this.clubId)
      .single();

    if (fetchError || !existingClub) {
      throw new Error('Club not found');
    }

    if (existingClub.created_by !== this.userId) {
      throw new Error('Unauthorized: Only club creator can update');
    }

    // Perform update
    const { data, error } = await supabase
      .from('clubs')
      .update({
        ...this.updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.clubId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update club: ${error.message}`);
    }

    return data as Club;
  }
}

class DeleteClubCommand implements Command<void> {
  private clubId: string;
  private userId: string;

  constructor(clubId: string, userId: string) {
    this.clubId = clubId;
    this.userId = userId;
  }

  async execute(): Promise<void> {
    const supabase = await createClient();

    // Verify ownership
    const { data: existingClub, error: fetchError } = await supabase
      .from('clubs')
      .select('created_by')
      .eq('id', this.clubId)
      .single();

    if (fetchError || !existingClub) {
      throw new Error('Club not found');
    }

    if (existingClub.created_by !== this.userId) {
      throw new Error('Unauthorized: Only club creator can delete');
    }

    // Perform deletion
    const { error } = await supabase
      .from('clubs')
      .delete()
      .eq('id', this.clubId);

    if (error) {
      throw new Error(`Failed to delete club: ${error.message}`);
    }
  }
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * GET /api/clubs/[id]
 * Get a single club by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid club ID format' },
        { status: 400 }
      );
    }

    const { data: club, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !club) {
      return NextResponse.json(
        { error: 'Club not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ club });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clubs/[id]
 * Update a club
 *
 * Body:
 * {
 *   "name": "Updated Name",
 *   "description": "Updated description"
 * }
 */
export async function PUT(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid club ID format' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, description } = body;

    // Validate input
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Club name cannot be empty' },
          { status: 400 }
        );
      }

      if (name.length > 255) {
        return NextResponse.json(
          { error: 'Club name must be 255 characters or less' },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updates: ClubUpdateInput = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Use Command Pattern to update club
    const updateCommand = new UpdateClubCommand(id, updates, user.id);
    const club = await updateCommand.execute();

    return NextResponse.json({
      club,
      message: 'Club updated successfully',
    });

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Club not found') {
        return NextResponse.json(
          { error: 'Club not found' },
          { status: 404 }
        );
      }

      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }

      if (error.message.includes('Failed to update club')) {
        return NextResponse.json(
          { error: 'Failed to update club', details: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clubs/[id]
 * Delete a club
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid club ID format' },
        { status: 400 }
      );
    }

    // Use Command Pattern to delete club
    const deleteCommand = new DeleteClubCommand(id, user.id);
    await deleteCommand.execute();

    return NextResponse.json({
      message: 'Club deleted successfully',
    });

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Club not found') {
        return NextResponse.json(
          { error: 'Club not found' },
          { status: 404 }
        );
      }

      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }

      if (error.message.includes('Failed to delete club')) {
        return NextResponse.json(
          { error: 'Failed to delete club', details: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
