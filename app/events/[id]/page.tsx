'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MapPin, Calendar, Users } from 'lucide-react';
import { Event } from '@/lib/types/database';

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

      // Fetch club name
      if (data.event.club_id) {
        fetchClubName(data.event.club_id);
      }

      // Check registration status
      checkRegistrationStatus();
    } catch (err) {
      console.error('Error fetching event:', err);
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
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

  const checkRegistrationStatus = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}`);
      if (response.ok) {
        const data = await response.json();
        // If we have user info, we can check registration
        // For now, this will be handled by the registration endpoints
        setIsRegistered(false);
      }
    } catch (err) {
      console.error('Error checking registration:', err);
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

  return (
    <SidebarProvider>
      <AppSidebar />
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
                <CardTitle className="text-3xl mb-2">{event.title}</CardTitle>
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
                </div>

                {/* Description */}
                {event.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Description</h3>
                    <p className="text-slate-600 leading-relaxed">{event.description}</p>
                  </div>
                )}

                {/* Registration Button */}
                <div className="pt-4 border-t">
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
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </SidebarProvider>
  );
}
