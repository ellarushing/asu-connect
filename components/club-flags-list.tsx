'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, Eye } from 'lucide-react';

interface ClubFlag {
  id: string;
  club_id: string;
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

interface ClubFlagsListProps {
  clubId: string;
  onStatusUpdate?: () => void;
}

export function ClubFlagsList({ clubId, onStatusUpdate }: ClubFlagsListProps) {
  const [flags, setFlags] = useState<ClubFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingFlagId, setUpdatingFlagId] = useState<string | null>(null);

  useEffect(() => {
    fetchFlags();
  }, [clubId]);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/clubs/${clubId}/flags`);

      if (!response.ok) {
        const data = await response.json();
        // Silently fail if the table doesn't exist - flags feature is optional
        if (response.status === 500 && data.details?.includes('relation "club_flags" does not exist')) {
          console.log('Club flags table does not exist yet - feature not available');
          setFlags([]);
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Failed to fetch flags');
      }

      const data = await response.json();
      setFlags(data.flags || []);
    } catch (err) {
      console.error('Error fetching flags:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch flags');
    } finally {
      setLoading(false);
    }
  };

  const updateFlagStatus = async (flagId: string, status: 'reviewed' | 'resolved' | 'dismissed') => {
    try {
      setUpdatingFlagId(flagId);
      setError(null);

      const response = await fetch(`/api/clubs/${clubId}/flag`, {
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
    // Don't show error UI to users - just return null to hide the section
    return null;
  }

  if (flags.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Club Flags</CardTitle>
          <CardDescription>No flags have been reported for this club.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Club Flags ({flags.length})</CardTitle>
        <CardDescription>
          Review and manage flags reported by users for this club.
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
