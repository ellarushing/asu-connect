'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Users, Mail, Calendar } from 'lucide-react';

interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  registered_at: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

interface EventRegistrationsListProps {
  eventId: string;
}

export function EventRegistrationsList({ eventId }: EventRegistrationsListProps) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRegistrations();
  }, [eventId]);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/events/${eventId}/registrations`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch registrations');
      }

      const data = await response.json();
      setRegistrations(data.registrations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch registrations');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Users className="w-5 h-5" />
            Event Registrations
          </CardTitle>
          <CardDescription>View all registered attendees</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Users className="w-5 h-5" />
              Event Registrations
            </CardTitle>
            <CardDescription>View all registered attendees</CardDescription>
          </div>
          <Badge variant="secondary" className="text-base px-3 py-1">
            {registrations.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {registrations.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground">No registrations yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Registered attendees will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {registrations.map((registration) => {
              const userName = registration.profiles?.full_name || 'Unknown User';
              const userEmail = registration.profiles?.email || '';

              return (
                <div
                  key={registration.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-base truncate">
                          {userName}
                        </h3>
                      </div>
                      {userEmail && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{userEmail}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Registered {formatDate(registration.registered_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
