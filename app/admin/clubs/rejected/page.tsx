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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { XCircle, Eye, RotateCcw } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

interface RejectedClub {
  id: string;
  name: string;
  description: string;
  created_by: string;
  creator_email: string | null;
  created_at: string;
  rejected_at: string;
  rejected_by_email: string | null;
  rejection_reason: string | null;
  approval_status: string;
}

interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
  returned: number;
}

export default function AdminRejectedClubsPage() {
  const [clubs, setClubs] = useState<RejectedClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState<PaginationInfo>({
    limit: 50,
    offset: 0,
    total: 0,
    returned: 0,
  });

  // Dialog states
  const [detailsDialog, setDetailsDialog] = useState<{
    open: boolean;
    club: RejectedClub | null;
  }>({ open: false, club: null });

  const [reapproveDialog, setReapproveDialog] = useState<{
    open: boolean;
    club: RejectedClub | null;
  }>({ open: false, club: null });

  useEffect(() => {
    fetchRejectedClubs();
  }, [pagination.offset]);

  const fetchRejectedClubs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/admin/clubs/rejected?limit=${pagination.limit}&offset=${pagination.offset}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch rejected clubs');
      }

      const data = await response.json();
      setClubs(data.clubs || []);
      setPagination(data.pagination);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch rejected clubs';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReapprove = async (club: RejectedClub) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(club.id));

      const response = await fetch(`/api/admin/clubs/${club.id}/approve`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to re-approve club');
      }

      toast.success(`Club "${club.name}" has been re-approved`);

      // Remove from rejected list
      setClubs((prev) => prev.filter((c) => c.id !== club.id));
      setPagination((prev) => ({ ...prev, total: prev.total - 1 }));

      setReapproveDialog({ open: false, club: null });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to re-approve club';
      toast.error(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(club.id);
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

  return (
    <main className="w-full">
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background p-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-2xl font-bold">Rejected Clubs</h1>
          <p className="text-sm text-muted-foreground">
            View and manage rejected club submissions
          </p>
        </div>
      </div>

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Rejected Club Approvals</CardTitle>
            <CardDescription>
              Clubs that have been rejected. You can re-approve them if needed.
            </CardDescription>
            {pagination.total > 0 && (
              <div className="pt-2">
                <Badge variant="secondary">{pagination.total}</Badge>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <XCircle className="mx-auto h-12 w-12 text-destructive" />
                <h3 className="mt-4 text-lg font-semibold">
                  Failed to fetch rejected clubs
                </h3>
                <p className="text-muted-foreground mt-2">{error}</p>
                <Button onClick={fetchRejectedClubs} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : clubs.length === 0 ? (
              <div className="text-center py-8">
                <XCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">
                  No rejected club approvals
                </h3>
                <p className="text-muted-foreground mt-2">
                  All rejected clubs are displayed here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {clubs.map((club) => (
                  <Card key={club.id} className="overflow-hidden">
                    <CardHeader className="bg-muted/50">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-xl">{club.name}</CardTitle>
                          <CardDescription className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span>Created by: {club.creator_email || 'Unknown'}</span>
                            </div>
                            <div className="text-xs">
                              Rejected on {formatDate(club.rejected_at)}
                              {club.rejected_by_email && ` by ${club.rejected_by_email}`}
                            </div>
                          </CardDescription>
                        </div>
                        <Badge variant="destructive">Rejected</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {club.description && (
                        <p className="text-sm text-muted-foreground mb-4">
                          {club.description}
                        </p>
                      )}

                      {club.rejection_reason && (
                        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                          <p className="text-sm font-medium text-destructive mb-1">
                            Rejection Reason:
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {club.rejection_reason}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailsDialog({ open: true, club })}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setReapproveDialog({ open: true, club })}
                          disabled={processingIds.has(club.id)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Re-approve Club
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && !error && pagination.total > pagination.limit && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {pagination.offset + 1} to{' '}
                  {Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
                  {pagination.total} rejected clubs
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        offset: Math.max(0, prev.offset - prev.limit),
                      }))
                    }
                    disabled={pagination.offset === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        offset: prev.offset + prev.limit,
                      }))
                    }
                    disabled={pagination.offset + pagination.limit >= pagination.total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      <Dialog
        open={detailsDialog.open}
        onOpenChange={(open) =>
          setDetailsDialog({ open, club: open ? detailsDialog.club : null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailsDialog.club?.name}</DialogTitle>
            <DialogDescription>Club Details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium">Description</p>
              <p className="text-sm text-muted-foreground mt-1">
                {detailsDialog.club?.description || 'No description provided'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Creator Email</p>
              <p className="text-sm text-muted-foreground mt-1">
                {detailsDialog.club?.creator_email || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Submitted</p>
              <p className="text-sm text-muted-foreground mt-1">
                {detailsDialog.club?.created_at &&
                  formatDate(detailsDialog.club.created_at)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Rejected</p>
              <p className="text-sm text-muted-foreground mt-1">
                {detailsDialog.club?.rejected_at &&
                  formatDate(detailsDialog.club.rejected_at)}
                {detailsDialog.club?.rejected_by_email &&
                  ` by ${detailsDialog.club.rejected_by_email}`}
              </p>
            </div>
            {detailsDialog.club?.rejection_reason && (
              <div>
                <p className="text-sm font-medium">Rejection Reason</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {detailsDialog.club.rejection_reason}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailsDialog({ open: false, club: null })}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-approve Confirmation Dialog */}
      <Dialog
        open={reapproveDialog.open}
        onOpenChange={(open) =>
          setReapproveDialog({ open, club: open ? reapproveDialog.club : null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-approve Club</DialogTitle>
            <DialogDescription>
              Are you sure you want to re-approve "{reapproveDialog.club?.name}"?
              This will make the club visible to all users.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReapproveDialog({ open: false, club: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={() => reapproveDialog.club && handleReapprove(reapproveDialog.club)}
              disabled={processingIds.has(reapproveDialog.club?.id || '')}
            >
              Re-approve Club
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
