'use client';

import { useState, useEffect } from 'react';
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

interface PendingRequest {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

interface ClubMembershipRequestsProps {
  clubId: string;
}

export function ClubMembershipRequests({ clubId }: ClubMembershipRequestsProps) {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [actionStatus, setActionStatus] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    fetchPendingRequests();
  }, [clubId]);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/clubs/${clubId}/membership/pending`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch pending requests');
      }

      const data = await response.json();
      setRequests(data.pending_requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    await handleAction(userId, 'approve');
  };

  const handleReject = async (userId: string) => {
    await handleAction(userId, 'reject');
  };

  const handleAction = async (userId: string, action: 'approve' | 'reject') => {
    try {
      setProcessingIds(prev => new Set(prev).add(userId));
      setActionStatus(null);

      const response = await fetch(`/api/clubs/${clubId}/membership`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${action} membership`);
      }

      const data = await response.json();

      // Show success message
      setActionStatus({
        message: data.message || `Membership request ${action}d successfully`,
        type: 'success',
      });

      // Remove the processed request from the list
      setRequests(prev => prev.filter(req => req.user_id !== userId));

      // Clear success message after 3 seconds
      setTimeout(() => setActionStatus(null), 3000);
    } catch (err) {
      setActionStatus({
        message: err instanceof Error ? err.message : `Failed to ${action} membership`,
        type: 'error',
      });

      // Clear error message after 5 seconds
      setTimeout(() => setActionStatus(null), 5000);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
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
          <CardTitle className="text-xl">Pending Membership Requests</CardTitle>
          <CardDescription>Review and approve membership requests</CardDescription>
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
            <CardTitle className="text-xl">Pending Membership Requests</CardTitle>
            <CardDescription>Review and approve membership requests</CardDescription>
          </div>
          <Badge variant="secondary">{requests.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {actionStatus && (
          <div
            className={`mb-4 p-3 rounded-md text-sm ${
              actionStatus.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {actionStatus.message}
          </div>
        )}

        {requests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No pending membership requests
          </p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const isProcessing = processingIds.has(request.user_id);
              const userName = request.profiles?.full_name || 'Unknown User';
              const userEmail = request.profiles?.email || '';

              return (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base">{userName}</h3>
                      <Badge variant="warning" className="text-xs">
                        Pending
                      </Badge>
                    </div>
                    {userEmail && (
                      <p className="text-sm text-muted-foreground mb-1">
                        {userEmail}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Requested on {formatDate(request.joined_at)}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleApprove(request.user_id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Processing...' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(request.user_id)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Processing...' : 'Reject'}
                    </Button>
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
