'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, Plus } from 'lucide-react';
import { ClubAnnouncementCard } from './club-announcement-card';
import { ClubAnnouncementForm } from './club-announcement-form';
import { createClient } from '@/utils/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role?: string;
}

interface Announcement {
  id: string;
  club_id: string;
  created_by: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

interface ClubMember {
  role: string;
}

interface ClubAnnouncementsListProps {
  clubId: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ClubAnnouncementsList({ clubId }: ClubAnnouncementsListProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [userMembership, setUserMembership] = useState<ClubMember | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<
    string | null
  >(null);

  // Check if user can post announcements
  const canPostAnnouncements = useCallback(() => {
    if (!currentUser) return false;

    // Platform admins can post to any club
    if (currentUser.role === 'admin') return true;

    // Club admins can post to their clubs
    if (userMembership?.role === 'admin') return true;

    // Student leaders who are approved members can post
    if (currentUser.role === 'student_leader' && userMembership) return true;

    return false;
  }, [currentUser, userMembership]);

  // Check if user can edit/delete a specific announcement
  const canModifyAnnouncement = useCallback(
    (announcement: Announcement) => {
      if (!currentUser) return false;

      // Platform admins can modify any announcement
      if (currentUser.role === 'admin') return true;

      // Club admins can modify any announcement in their club
      if (userMembership?.role === 'admin') return true;

      // Users can modify their own announcements
      if (announcement.created_by === currentUser.id) return true;

      return false;
    },
    [currentUser, userMembership]
  );

  // Fetch current user and their club membership
  const fetchUserInfo = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCurrentUser(null);
        setUserMembership(null);
        return;
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', user.id)
        .single();

      setCurrentUser(profile);

      // Fetch club membership
      const { data: membership } = await supabase
        .from('club_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('club_id', clubId)
        .eq('status', 'approved')
        .single();

      setUserMembership(membership);
    } catch (err) {
      console.error('Error fetching user info:', err);
    }
  }, [clubId]);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/clubs/${clubId}/announcements`);

      if (!response.ok) {
        throw new Error('Failed to fetch announcements');
      }

      const data = await response.json();
      setAnnouncements(data.announcements || []);
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load announcements'
      );
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  // Initial data fetch
  useEffect(() => {
    fetchUserInfo();
    fetchAnnouncements();
  }, [fetchUserInfo, fetchAnnouncements]);

  // Handle delete announcement
  const handleDelete = async (announcementId: string) => {
    try {
      const response = await fetch(
        `/api/clubs/${clubId}/announcements/${announcementId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete announcement');
      }

      // Refresh announcements list
      fetchAnnouncements();
    } catch (err) {
      console.error('Error deleting announcement:', err);
      alert(
        err instanceof Error ? err.message : 'Failed to delete announcement'
      );
    }
  };

  // Handle form success
  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingAnnouncementId(null);
    fetchAnnouncements();
  };

  // Handle cancel form
  const handleCancelForm = () => {
    setShowForm(false);
    setEditingAnnouncementId(null);
  };

  // Handle edit announcement
  const handleEdit = (announcementId: string) => {
    setEditingAnnouncementId(announcementId);
    setShowForm(true);
  };

  // Get announcement being edited
  const editingAnnouncement = editingAnnouncementId
    ? announcements.find((a) => a.id === editingAnnouncementId)
    : null;

  return (
    <div className="space-y-6">
      {/* Header and Create Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                Announcements
              </CardTitle>
              <CardDescription>
                {loading
                  ? 'Loading...'
                  : `${announcements.length} ${
                      announcements.length === 1
                        ? 'announcement'
                        : 'announcements'
                    }`}
              </CardDescription>
            </div>
            {canPostAnnouncements() && !showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Announcement
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Create/Edit Form */}
      {showForm && (
        <ClubAnnouncementForm
          clubId={clubId}
          announcementId={editingAnnouncementId || undefined}
          initialTitle={editingAnnouncement?.title}
          initialContent={editingAnnouncement?.content}
          onSuccess={handleFormSuccess}
          onCancel={handleCancelForm}
        />
      )}

      {/* Error State */}
      {error && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-destructive text-sm mb-4">{error}</p>
              <Button variant="outline" onClick={fetchAnnouncements}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && announcements.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                No announcements yet
              </p>
              {canPostAnnouncements() && !showForm && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Announcement
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Announcements List */}
      {!loading && !error && announcements.length > 0 && (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <ClubAnnouncementCard
              key={announcement.id}
              announcement={announcement}
              canEdit={canModifyAnnouncement(announcement)}
              canDelete={canModifyAnnouncement(announcement)}
              onEdit={() => handleEdit(announcement.id)}
              onDelete={() => handleDelete(announcement.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
