'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Flag } from 'lucide-react';
import { ClubMembershipRequests } from '@/components/club-membership-requests';
import { ClubFlagDialog } from '@/components/club-flag-dialog';
import { ClubFlagsList } from '@/components/club-flags-list';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/toast';

interface Club {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
}

interface Membership {
  role: string;
  status: string;
}

export default function ClubDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clubId = params.id as string;

  const [club, setClub] = useState<Club | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [hasUserFlagged, setHasUserFlagged] = useState(false);

  useEffect(() => {
    fetchClubDetails();
  }, [clubId]);

  const fetchClubDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch club details
      const clubResponse = await fetch(`/api/clubs/${clubId}`);
      if (!clubResponse.ok) {
        throw new Error('Failed to fetch club details');
      }
      const clubData = await clubResponse.json();
      setClub(clubData.club);

      // Check if current user is admin (creator of the club)
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && clubData.club.created_by === user.id) {
        setIsAdmin(true);
      }

      // Fetch club events
      const eventsResponse = await fetch(`/api/events?club_id=${clubId}`);
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setEvents(eventsData.events || []);
      }

      // Check membership status
      const membershipResponse = await fetch(
        `/api/clubs/${clubId}/membership`
      );
      if (membershipResponse.ok) {
        const membershipData = await membershipResponse.json();
        setMembership(membershipData.membership);
      }

      // Check if user has already flagged this club
      await checkUserFlagStatus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  const checkUserFlagStatus = async () => {
    try {
      // Check if user has already flagged this club
      const flagResponse = await fetch(`/api/clubs/${clubId}/flag`);
      if (flagResponse.ok) {
        const flagData = await flagResponse.json();
        setHasUserFlagged(flagData.hasFlagged || false);
      }
    } catch (err) {
      console.error('Error checking flag status:', err);
    }
  };

  const handleJoinClub = async () => {
    try {
      setActionLoading(true);
      setActionError(null);

      const response = await fetch(`/api/clubs/${clubId}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      });

      if (!response.ok) {
        throw new Error('Failed to join club');
      }

      const data = await response.json();
      setMembership(data.membership);
      // Clear action error on success
      setActionError(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to join club'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveClub = async () => {
    try {
      setActionLoading(true);
      setActionError(null);

      const response = await fetch(`/api/clubs/${clubId}/membership`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to leave club');
      }

      setMembership(null);
      // Clear action error on success
      setActionError(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to leave club'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const getMembershipButtonText = () => {
    if (actionLoading) {
      return membership ? 'Leaving...' : 'Submitting...';
    }

    if (membership) {
      if (membership.status === 'pending') {
        return 'Cancel Request';
      }
      return 'Leave Club';
    }

    return 'Request to Join';
  };

  const getMembershipButtonAction = () => {
    if (membership) {
      return handleLeaveClub;
    }
    return handleJoinClub;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleFlagSuccess = () => {
    toast.success('Club flagged successfully', {
      description: 'Thank you for reporting. The club creator will review your flag.',
    });
    setHasUserFlagged(true);
  };

  return (
    <SidebarProvider>
      <Toaster />
      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-40 flex items-center gap-4 border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        <div className="p-6 max-w-4xl mx-auto">
          {error && (
            <Card className="mb-6 border-destructive bg-destructive/5">
              <CardContent className="pt-6">
                <p className="text-destructive text-sm">{error}</p>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-8 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-1/4" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : club ? (
            <>
              {/* Club Header */}
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-3xl">
                          {club.name}
                        </CardTitle>
                        {isAdmin && (
                          <Badge variant="success">Admin</Badge>
                        )}
                      </div>
                      <CardDescription>
                        Created on {formatDate(club.created_at)}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {actionError && (
                        <p className="text-destructive text-xs">
                          {actionError}
                        </p>
                      )}
                      {!isAdmin && (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            {membership?.status === 'pending' && (
                              <Badge variant="warning">Request Pending</Badge>
                            )}
                            {membership?.status === 'approved' && (
                              <Badge variant="success">Member</Badge>
                            )}
                            <Button
                              variant={membership ? 'destructive' : 'default'}
                              onClick={getMembershipButtonAction()}
                              disabled={actionLoading}
                              size="sm"
                            >
                              {getMembershipButtonText()}
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFlagDialogOpen(true)}
                            disabled={hasUserFlagged}
                          >
                            <Flag className="w-4 h-4 mr-2" />
                            {hasUserFlagged ? 'Club Flagged' : 'Flag Club'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {club.description && (
                  <CardContent>
                    <p className="text-muted-foreground">
                      {club.description}
                    </p>
                  </CardContent>
                )}
              </Card>

              {/* Pending Requests Section (Admin Only) */}
              {isAdmin && (
                <div className="mb-6">
                  <ClubMembershipRequests clubId={clubId} />
                </div>
              )}

              {/* Club Flags Section (Admin Only) */}
              {isAdmin && (
                <div className="mb-6">
                  <ClubFlagsList
                    clubId={clubId}
                    onStatusUpdate={() => {
                      toast.success('Flag status updated successfully');
                    }}
                  />
                </div>
              )}

              {/* Events Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">
                    Events ({events.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {events.length > 0 ? (
                    <div className="space-y-4">
                      {events.map((event) => (
                        <div
                          key={event.id}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-base">
                              {event.title}
                            </h3>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(event.event_date)}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {event.description}
                            </p>
                          )}
                          {event.location && (
                            <p className="text-xs text-muted-foreground">
                              Location: {event.location}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No events yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Club not found
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Club Flag Dialog */}
        <ClubFlagDialog
          open={flagDialogOpen}
          onOpenChange={setFlagDialogOpen}
          clubId={clubId}
          onSuccess={handleFlagSuccess}
        />
      </main>
    </SidebarProvider>
  );
}
