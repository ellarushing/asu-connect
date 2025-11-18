'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MapPin, Calendar, Flag } from 'lucide-react';
import { Event } from '@/lib/types/database';
import { EventFlagDialog } from '@/components/event-flag-dialog';
import { EventFlagsList } from '@/components/event-flags-list';
import { EventRegistrationsList } from '@/components/event-registrations-list';
import { Toaster } from '@/components/ui/toast';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

interface EventWithClub extends Event {
  club?: {
    name: string;
  };
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventWithClub | null>(null);
  const [clubName, setClubName] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [hasUserFlagged, setHasUserFlagged] = useState(false);
  const [isEventCreator, setIsEventCreator] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/events/${eventId}`);
      if (!response.ok) {
        throw new Error('Failed to load event');
      }

      const data = await response.json();
      setEvent(data.event);

      // Set registration status from API response
      setIsRegistered(data.isUserRegistered || false);

      // Fetch club name
      if (data.event.club_id) {
        fetchClubName(data.event.club_id);
      }

      // Check if user has already flagged
      await checkUserFlagStatus();

      // Check if user is event creator
      await checkIfEventCreator(data.event);
    } catch (err) {
      console.error('Error fetching event:', err);
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const checkUserFlagStatus = async () => {
    try {
      // Check if user has already flagged this event
      const flagResponse = await fetch(`/api/events/${eventId}/flag`);
      if (flagResponse.ok) {
        const flagData = await flagResponse.json();
        setHasUserFlagged(flagData.hasFlagged || false);
      }
    } catch (err) {
      console.error('Error checking flag status:', err);
    }
  };

  const fetchClubName = async (clubId: string) => {
    try {
      const response = await fetch(`/api/clubs/${clubId}`);
      if (response.ok) {
        const data = await response.json();
        setClubName(data.club?.name || 'Unknown Club');
      }
    } catch (err) {
      console.error('Error fetching club:', err);
    }
  };


  const checkIfEventCreator = async (eventData: EventWithClub) => {
    try {
      // Get current user from Supabase client
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setCurrentUserId(user.id);
        if (eventData.created_by === user.id) {
          setIsEventCreator(true);
        }
      }
    } catch (err) {
      console.error('Error checking event creator:', err);
    }
  };

  const handleRegister = async () => {
    try {
      setIsRegistering(true);
      setError(null);

      const response = await fetch(`/api/events/${eventId}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to register');
      }

      setIsRegistered(true);
      // Show success message
    } catch (err) {
      console.error('Error registering:', err);
      setError(err instanceof Error ? err.message : 'Failed to register');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCancel = async () => {
    try {
      setIsRegistering(true);
      setError(null);

      const response = await fetch(`/api/events/${eventId}/register`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel registration');
      }

      setIsRegistered(false);
    } catch (err) {
      console.error('Error cancelling registration:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel registration');
    } finally {
      setIsRegistering(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleFlagSuccess = () => {
    toast.success('Event flagged successfully', {
      description: 'Thank you for reporting. The event creator will review your flag.',
    });
    setHasUserFlagged(true);
  };

  return (
    <SidebarProvider>
      <Toaster />
      <main className="w-full">
        <SidebarTrigger />
        <div className="container mx-auto p-6 max-w-2xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Events
          </Button>

          {/* Loading State */}
          {loading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-8 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-700">Error</CardTitle>
              </CardHeader>
              <CardContent className="text-red-600">
                {error}
              </CardContent>
            </Card>
          ) : event ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <CardTitle className="text-3xl flex-1">{event.title}</CardTitle>
                  <div className="flex flex-col gap-2">
                    {event.category && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary whitespace-nowrap">
                        {event.category}
                      </span>
                    )}
                    <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap ${
                      event.is_free
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {event.is_free ? "FREE" : `$${event.price?.toFixed(2)}`}
                    </span>
                  </div>
                </div>
                {clubName && (
                  <CardDescription className="text-lg">
                    Hosted by <span className="font-semibold text-slate-700">{clubName}</span>
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Event Details */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-slate-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-slate-600">Date & Time</p>
                      <p className="font-medium">{formatDate(event.event_date)}</p>
                    </div>
                  </div>

                  {event.location && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-slate-400 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-slate-600">Location</p>
                        <p className="font-medium">{event.location}</p>
                      </div>
                    </div>
                  )}

                  {/* Pricing Details */}
                  {!event.is_free && event.price && (
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 flex items-center justify-center mt-1 flex-shrink-0">
                        <span className="text-slate-400">$</span>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Price</p>
                        <p className="font-medium">${event.price.toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                {event.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Description</h3>
                    <p className="text-slate-600 leading-relaxed">{event.description}</p>
                  </div>
                )}

                {/* Registration and Flag Buttons */}
                <div className="pt-4 border-t space-y-3">
                  {isRegistered ? (
                    <Button
                      variant="destructive"
                      onClick={handleCancel}
                      disabled={isRegistering}
                      className="w-full"
                    >
                      {isRegistering ? 'Cancelling...' : 'Cancel Registration'}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleRegister}
                      disabled={isRegistering}
                      className="w-full"
                    >
                      {isRegistering ? 'Registering...' : 'Register for Event'}
                    </Button>
                  )}

                  {/* Flag Event Button */}
                  {!isEventCreator && (
                    <Button
                      variant="outline"
                      onClick={() => setFlagDialogOpen(true)}
                      disabled={hasUserFlagged}
                      className="w-full"
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      {hasUserFlagged ? 'Event Flagged' : 'Flag Event'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Event Registrations Section (for event creators) */}
          {event && isEventCreator && (
            <div className="mt-6">
              <EventRegistrationsList eventId={eventId} />
            </div>
          )}

          {/* Event Flags Section (for event creators) */}
          {event && isEventCreator && (
            <div className="mt-6">
              <EventFlagsList
                eventId={eventId}
                onStatusUpdate={() => {
                  toast.success('Flag status updated successfully');
                }}
              />
            </div>
          )}

          {/* Flag Dialog */}
          <EventFlagDialog
            open={flagDialogOpen}
            onOpenChange={setFlagDialogOpen}
            eventId={eventId}
            onSuccess={handleFlagSuccess}
          />
        </div>
      </main>
    </SidebarProvider>
  );
}
