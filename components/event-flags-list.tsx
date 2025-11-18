'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, Eye, AlertCircle, RefreshCcw } from 'lucide-react';

interface EventFlag {
  id: string;
  event_id: string;
  user_id: string;
  user_email: string;
  reason: string;
  details: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewed_by: string | null;
  reviewer_email: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EventFlagsListProps {
  eventId: string;
  onStatusUpdate?: () => void;
}

export function EventFlagsList({ eventId, onStatusUpdate }: EventFlagsListProps) {
  const [flags, setFlags] = useState<EventFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingFlagId, setUpdatingFlagId] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState(true); // Track if the table exists

  useEffect(() => {
    fetchFlags();
  }, [eventId]);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/events/${eventId}/flags`);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        // Check if the table doesn't exist - look in both error message and details
        const errorMessage = data.error?.toLowerCase() || '';
        const errorDetails = data.details?.toLowerCase() || '';
        const isMissingTable =
          errorMessage.includes('event_flags') && errorMessage.includes('does not exist') ||
          errorDetails.includes('relation "event_flags" does not exist') ||
          errorDetails.includes('table "event_flags" does not exist');

        // Silently fail if the table doesn't exist - flags feature is optional
        if (response.status === 500 && isMissingTable) {
          console.log('[EventFlagsList] Event flags table does not exist - feature not available for this event');
          console.debug('[EventFlagsList] Error details:', { status: response.status, error: data.error, details: data.details });
          setFlags([]);
          setTableExists(false); // Mark table as non-existent
          setLoading(false);
          return null; // Return null to indicate silent failure
        }

        // Log error details for debugging
        console.error('[EventFlagsList] Error fetching flags:', {
          eventId,
          status: response.status,
          error: data.error,
          details: data.details,
          timestamp: new Date().toISOString()
        });

        // Set specific error messages based on status code
        if (response.status === 404) {
          setError('Event not found. This event may have been deleted.');
        } else if (response.status === 403) {
          setError('You do not have permission to view flags for this event.');
        } else if (response.status === 401) {
          setError('You must be logged in to view event flags.');
        } else if (response.status >= 500) {
          setError('Unable to load event flags due to a technical issue. Please try again later.');
        } else {
          setError(data.error || 'Unable to load event flags. Please try again.');
        }
        return;
      }

      const data = await response.json();
      setFlags(data.flags || []);
      console.debug('[EventFlagsList] Successfully loaded', data.flags?.length || 0, 'flags for event', eventId);
    } catch (err) {
      console.error('[EventFlagsList] Exception while fetching flags:', {
        eventId,
        error: err,
        errorMessage: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString()
      });

      // Network errors or other unexpected issues
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('An unexpected error occurred while loading flags. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateFlagStatus = async (flagId: string, status: 'reviewed' | 'resolved' | 'dismissed') => {
    try {
      setUpdatingFlagId(flagId);
      setError(null);

      const response = await fetch(`/api/events/${eventId}/flag`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flag_id: flagId,
          status,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update flag status');
      }

      // Refresh flags list
      await fetchFlags();

      // Call callback if provided
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (err) {
      console.error('Error updating flag status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update flag status');
    } finally {
      setUpdatingFlagId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'reviewed':
        return <Badge variant="default">Reviewed</Badge>;
      case 'resolved':
        return <Badge variant="success">Resolved</Badge>;
      case 'dismissed':
        return <Badge variant="secondary">Dismissed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Don't render anything if the table doesn't exist
  if (!tableExists) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <CardTitle className="text-red-900">Unable to Load Event Flags</CardTitle>
              <CardDescription className="text-red-700 mt-2">
                {error}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={fetchFlags}
            variant="outline"
            size="sm"
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (flags.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Event Flags</CardTitle>
          <CardDescription>No flags have been reported for this event.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Flags ({flags.length})</CardTitle>
        <CardDescription>
          Review and manage flags reported by users for this event.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {flags.map((flag) => (
            <div
              key={flag.id}
              className="border rounded-lg p-4 space-y-3 bg-slate-50"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-900">{flag.reason}</h4>
                    {getStatusBadge(flag.status)}
                  </div>
                  <p className="text-sm text-slate-600">
                    Reported by {flag.user_email} on {formatDate(flag.created_at)}
                  </p>
                </div>
              </div>

              {flag.details && (
                <div className="bg-white rounded-md p-3 border">
                  <p className="text-sm text-slate-700">{flag.details}</p>
                </div>
              )}

              {flag.reviewed_at && flag.reviewer_email && (
                <div className="text-sm text-slate-600 bg-white rounded-md p-2 border">
                  Reviewed by {flag.reviewer_email} on {formatDate(flag.reviewed_at)}
                </div>
              )}

              {flag.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateFlagStatus(flag.id, 'reviewed')}
                    disabled={updatingFlagId === flag.id}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Mark as Reviewed
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => updateFlagStatus(flag.id, 'resolved')}
                    disabled={updatingFlagId === flag.id}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => updateFlagStatus(flag.id, 'dismissed')}
                    disabled={updatingFlagId === flag.id}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
