/**
 * Admin Authorization Utilities
 *
 * This module provides functions and middleware for admin-level authorization.
 * Admins have elevated permissions to manage content, users, and moderation.
 */

import { createClient } from '@/utils/supabase/server';
import type { User } from '@supabase/supabase-js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Extended user type that includes admin status
 */
export interface AdminUser extends User {
  is_admin: boolean;
}

/**
 * Profile data from the profiles table
 */
interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Moderation action types
 */
export enum ModerationAction {
  APPROVE_CLUB = 'approve_club',
  REJECT_CLUB = 'reject_club',
  DELETE_CLUB = 'delete_club',
  APPROVE_EVENT = 'approve_event',
  REJECT_EVENT = 'reject_event',
  DELETE_EVENT = 'delete_event',
  REVIEW_FLAG = 'review_flag',
  RESOLVE_FLAG = 'resolve_flag',
  DISMISS_FLAG = 'dismiss_flag',
  BAN_USER = 'ban_user',
  UNBAN_USER = 'unban_user',
  UPDATE_USER_ROLE = 'update_user_role',
}

/**
 * Entity types that can be moderated
 */
export type EntityType = 'club' | 'event' | 'flag' | 'user';

/**
 * User role types matching database enum
 */
export enum UserRole {
  STUDENT = 'student',
  STUDENT_LEADER = 'student_leader',
  ADMIN = 'admin',
}

/**
 * Moderation log entry
 */
export interface ModerationLog {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, any> | null;
  created_at: string;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Custom error class for admin authorization failures
 */
export class AdminAuthError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 403) {
    super(message);
    this.name = 'AdminAuthError';
    this.statusCode = statusCode;
  }
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Check if a user is an admin by querying the profiles table
 *
 * @param userId - The user's UUID
 * @returns Promise<boolean> - True if user is an admin, false otherwise
 *
 * @example
 * ```typescript
 * const adminStatus = await isAdmin('123e4567-e89b-12d3-a456-426614174000');
 * if (adminStatus) {
 *   // User is an admin
 * }
 * ```
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return profile?.is_admin === true;
  } catch (error) {
    console.error('Exception checking admin status:', error);
    return false;
  }
}

/**
 * Middleware helper that requires the current user to be an admin
 * Throws AdminAuthError if user is not authenticated or not an admin
 *
 * @param request - The incoming request object (optional, for future use)
 * @returns Promise<AdminUser> - The authenticated admin user
 * @throws {AdminAuthError} If user is not authenticated or not an admin
 *
 * @example
 * ```typescript
 * // In an API route
 * export async function POST(request: Request) {
 *   try {
 *     const admin = await requireAdmin(request);
 *     // Admin-only logic here
 *   } catch (error) {
 *     if (error instanceof AdminAuthError) {
 *       return Response.json({ error: error.message }, { status: error.statusCode });
 *     }
 *     throw error;
 *   }
 * }
 * ```
 */
export async function requireAdmin(request?: Request): Promise<AdminUser> {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new AdminAuthError('Authentication required', 401);
  }

  // Check if user is admin
  const adminStatus = await isAdmin(user.id);

  if (!adminStatus) {
    throw new AdminAuthError('Admin access required', 403);
  }

  // Return user with admin flag
  return {
    ...user,
    is_admin: true,
  };
}

/**
 * Get the current user if they are an admin, otherwise return null
 * Non-throwing version of requireAdmin for optional admin checks
 *
 * @param request - The incoming request object (optional, for future use)
 * @returns Promise<AdminUser | null> - The admin user or null
 *
 * @example
 * ```typescript
 * const admin = await getCurrentAdmin(request);
 * if (admin) {
 *   // Show admin-only UI elements
 * }
 * ```
 */
export async function getCurrentAdmin(request?: Request): Promise<AdminUser | null> {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    // Check if user is admin
    const adminStatus = await isAdmin(user.id);

    if (!adminStatus) {
      return null;
    }

    // Return user with admin flag
    return {
      ...user,
      is_admin: true,
    };
  } catch (error) {
    console.error('Error getting current admin:', error);
    return null;
  }
}

/**
 * Log a moderation action to the database for audit trail
 * Creates a record in the moderation_logs table
 *
 * @param adminId - The UUID of the admin performing the action
 * @param action - The action being performed (from ModerationAction enum)
 * @param entityType - The type of entity being moderated
 * @param entityId - The UUID of the entity being moderated
 * @param details - Optional additional details about the action
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * await logModerationAction(
 *   admin.id,
 *   ModerationAction.DELETE_EVENT,
 *   'event',
 *   eventId,
 *   { reason: 'Inappropriate content' }
 * );
 * ```
 */
export async function logModerationAction(
  adminId: string,
  action: string,
  entityType: EntityType,
  entityId: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('moderation_logs')
      .insert({
        admin_id: adminId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details: details || null,
      });

    if (error) {
      console.error('Error logging moderation action:', error);
      // Don't throw - logging failure shouldn't break the main action
    }
  } catch (error) {
    console.error('Exception logging moderation action:', error);
    // Don't throw - logging failure shouldn't break the main action
  }
}

/**
 * Get moderation logs for a specific entity
 * Useful for viewing the moderation history of clubs, events, etc.
 *
 * @param entityType - The type of entity
 * @param entityId - The UUID of the entity
 * @returns Promise<ModerationLog[]> - Array of moderation log entries
 *
 * @example
 * ```typescript
 * const logs = await getModerationLogs('event', eventId);
 * console.log(`Event has ${logs.length} moderation actions`);
 * ```
 */
export async function getModerationLogs(
  entityType: EntityType,
  entityId: string
): Promise<ModerationLog[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('moderation_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching moderation logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching moderation logs:', error);
    return [];
  }
}

/**
 * Get all recent moderation actions by an admin
 * Useful for admin activity monitoring
 *
 * @param adminId - The UUID of the admin
 * @param limit - Maximum number of logs to return (default: 50)
 * @returns Promise<ModerationLog[]> - Array of moderation log entries
 *
 * @example
 * ```typescript
 * const recentActions = await getAdminModerationHistory(admin.id, 20);
 * ```
 */
export async function getAdminModerationHistory(
  adminId: string,
  limit: number = 50
): Promise<ModerationLog[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('moderation_logs')
      .select('*')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching admin moderation history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching admin moderation history:', error);
    return [];
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Helper function to format admin-related error responses
 *
 * @param error - The error to format
 * @returns Response object with appropriate status code and message
 *
 * @example
 * ```typescript
 * try {
 *   await requireAdmin();
 * } catch (error) {
 *   return handleAdminError(error);
 * }
 * ```
 */
export function handleAdminError(error: unknown): Response {
  if (error instanceof AdminAuthError) {
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  console.error('Unexpected admin error:', error);
  return Response.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

/**
 * Check if the current user has admin privileges
 * Convenience function for server components
 *
 * @returns Promise<boolean>
 *
 * @example
 * ```typescript
 * // In a server component
 * const hasAdminAccess = await checkAdminAccess();
 * if (hasAdminAccess) {
 *   // Render admin UI
 * }
 * ```
 */
export async function checkAdminAccess(): Promise<boolean> {
  try {
    const admin = await getCurrentAdmin();
    return admin !== null;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// STUDENT LEADER ROLE FUNCTIONS
// ============================================================================

/**
 * Get user's role from the database
 *
 * @param userId - The user's UUID
 * @returns Promise<UserRole> - The user's role (defaults to STUDENT if not found)
 *
 * @example
 * ```typescript
 * const role = await getUserRole(user.id);
 * if (role === UserRole.STUDENT_LEADER) {
 *   // Allow club creation
 * }
 * ```
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  try {
    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      console.error('Error fetching user role:', error);
      return UserRole.STUDENT;
    }

    return (profile.role as UserRole) || UserRole.STUDENT;
  } catch (error) {
    console.error('Exception getting user role:', error);
    return UserRole.STUDENT;
  }
}

/**
 * Check if a user is a student leader or admin
 *
 * @param userId - The user's UUID
 * @returns Promise<boolean> - True if user is a student leader or admin
 *
 * @example
 * ```typescript
 * const canCreate = await isStudentLeader(user.id);
 * if (!canCreate) {
 *   return { error: 'Only student leaders can create clubs' };
 * }
 * ```
 */
export async function isStudentLeader(userId: string): Promise<boolean> {
  try {
    const role = await getUserRole(userId);
    return role === UserRole.STUDENT_LEADER || role === UserRole.ADMIN;
  } catch (error) {
    console.error('Exception checking student leader status:', error);
    return false;
  }
}

/**
 * Check if user can create clubs (student leader or admin)
 *
 * @param userId - The user's UUID
 * @returns Promise<boolean> - True if user can create clubs
 *
 * @example
 * ```typescript
 * const canCreate = await canCreateClubs(user.id);
 * ```
 */
export async function canCreateClubs(userId: string): Promise<boolean> {
  return await isStudentLeader(userId);
}

/**
 * Check if user can create events in a specific club
 * Must be student leader/admin AND have admin role in the club
 *
 * @param userId - The user's UUID
 * @param clubId - The club UUID
 * @returns Promise<boolean> - True if user can create events in this club
 *
 * @example
 * ```typescript
 * const canCreate = await canCreateEvents(user.id, clubId);
 * if (!canCreate) {
 *   return { error: 'You must be a student leader and club admin' };
 * }
 * ```
 */
export async function canCreateEvents(userId: string, clubId: string): Promise<boolean> {
  try {
    // Must be student leader or admin
    const hasLeaderRole = await isStudentLeader(userId);
    if (!hasLeaderRole) {
      return false;
    }

    // Must also be a club admin
    const supabase = await createClient();
    const { data: membership } = await supabase
      .from('club_members')
      .select('role, status')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .single();

    return membership?.role === 'admin' && membership?.status === 'approved';
  } catch (error) {
    console.error('Exception checking event creation permission:', error);
    return false;
  }
}
