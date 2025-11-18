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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Eye, Clock } from 'lucide-react';

interface PendingClub {
  id: string;
  name: string;
  description: string;
  created_by: string;
  creator_email: string | null;
  created_at: string;
  updated_at: string;
  approval_status: string;
}

interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
  returned: number;
}

export default function AdminPendingClubsPage() {
  const [clubs, setClubs] = useState<PendingClub[]>([]);
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
  const [approveDialog, setApproveDialog] = useState<{
    open: boolean;
    club: PendingClub | null;
  }>({ open: false, club: null });

  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    club: PendingClub | null;
  }>({ open: false, club: null });

  const [rejectionReason, setRejectionReason] = useState('');

  const [detailsDialog, setDetailsDialog] = useState<{
    open: boolean;
    club: PendingClub | null;
  }>({ open: false, club: null });

  useEffect(() => {
    fetchPendingClubs();
  }, [pagination.offset]);

  const fetchPendingClubs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/admin/clubs/pending?limit=${pagination.limit}&offset=${pagination.offset}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch pending clubs');
      }

      const data = await response.json();
      setClubs(data.clubs || []);
      setPagination(data.pagination);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch pending clubs';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = (club: PendingClub) => {
    setApproveDialog({ open: true, club });
  };

  const handleRejectClick = (club: PendingClub) => {
    setRejectDialog({ open: true, club });
    setRejectionReason('');
  };

  const handleViewDetails = (club: PendingClub) => {
    setDetailsDialog({ open: true, club });
  };

  const handleApproveConfirm = async () => {
    if (!approveDialog.club) return;

    const clubId = approveDialog.club.id;
    const clubName = approveDialog.club.name;

    try {
      setProcessingIds((prev) => new Set(prev).add(clubId));
      setApproveDialog({ open: false, club: null });

      const response = await fetch(`/api/admin/clubs/${clubId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve club');
      }

      const data = await response.json();

      // Optimistic UI update: Remove the club from the list
      setClubs((prev) => prev.filter((club) => club.id !== clubId));
      setPagination((prev) => ({ ...prev, total: prev.total - 1 }));

      toast.success(data.message || `Club "${clubName}" approved successfully`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to approve club';
      toast.error(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(clubId);
        return newSet;
      });
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectDialog.club) return;

    // Validate rejection reason
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    if (rejectionReason.length > 500) {
      toast.error('Rejection reason must be 500 characters or less');
      return;
    }

    const clubId = rejectDialog.club.id;
    const clubName = rejectDialog.club.name;

    try {
      setProcessingIds((prev) => new Set(prev).add(clubId));
      setRejectDialog({ open: false, club: null });

      const response = await fetch(`/api/admin/clubs/${clubId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject club');
      }

      const data = await response.json();

      // Optimistic UI update: Remove the club from the list
      setClubs((prev) => prev.filter((club) => club.id !== clubId));
      setPagination((prev) => ({ ...prev, total: prev.total - 1 }));

      toast.success(data.message || `Club "${clubName}" rejected successfully`);
      setRejectionReason('');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to reject club';
      toast.error(errorMessage);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(clubId);
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

  const handleNextPage = () => {
    if (pagination.offset + pagination.limit < pagination.total) {
      setPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
    }
  };

  const handlePreviousPage = () => {
    if (pagination.offset > 0) {
      setPagination((prev) => ({
        ...prev,
        offset: Math.max(0, prev.offset - prev.limit),
      }));
    }
  };

  if (loading && clubs.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Pending Club Approvals</CardTitle>
            <CardDescription>
              Review and manage clubs awaiting approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Pending Club Approvals</CardTitle>
              <CardDescription>
                Review and manage clubs awaiting approval
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {pagination.total}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-6 p-4 rounded-md bg-red-50 text-red-800 border border-red-200">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {clubs.length === 0 && !loading ? (
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                No pending club approvals
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                All clubs have been reviewed
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {clubs.map((club) => {
                  const isProcessing = processingIds.has(club.id);

                  return (
                    <Card
                      key={club.id}
                      className="border-2 hover:border-primary/50 transition-colors"
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg truncate">
                                {club.name}
                              </h3>
                              <Badge variant="warning" className="text-xs shrink-0">
                                Pending
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {club.description}
                            </p>
                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                              {club.creator_email && (
                                <p>
                                  <span className="font-medium">Creator:</span>{' '}
                                  {club.creator_email}
                                </p>
                              )}
                              <p>
                                <span className="font-medium">Submitted:</span>{' '}
                                {formatDate(club.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDetails(club)}
                              disabled={isProcessing}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApproveClick(club)}
                              disabled={isProcessing}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              {isProcessing ? 'Processing...' : 'Approve'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectClick(club)}
                              disabled={isProcessing}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              {isProcessing ? 'Processing...' : 'Reject'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination.total > pagination.limit && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {pagination.offset + 1} to{' '}
                    {Math.min(
                      pagination.offset + pagination.limit,
                      pagination.total
                    )}{' '}
                    of {pagination.total} clubs
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handlePreviousPage}
                      disabled={pagination.offset === 0 || loading}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleNextPage}
                      disabled={
                        pagination.offset + pagination.limit >= pagination.total ||
                        loading
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Approve Confirmation Dialog */}
      <Dialog
        open={approveDialog.open}
        onOpenChange={(open) => setApproveDialog({ open, club: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Club</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this club?
            </DialogDescription>
          </DialogHeader>
          {approveDialog.club && (
            <div className="py-4">
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <p className="font-semibold text-lg">{approveDialog.club.name}</p>
                <p className="text-sm text-muted-foreground">
                  {approveDialog.club.description}
                </p>
                {approveDialog.club.creator_email && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Creator:</span>{' '}
                    {approveDialog.club.creator_email}
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                This club will be made visible to all users and the creator will be
                notified.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialog({ open: false, club: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveConfirm}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Club
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) => {
          setRejectDialog({ open, club: null });
          if (!open) setRejectionReason('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Club</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this club. The creator will
              receive this feedback.
            </DialogDescription>
          </DialogHeader>
          {rejectDialog.club && (
            <div className="py-4 space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <p className="font-semibold text-lg">{rejectDialog.club.name}</p>
                <p className="text-sm text-muted-foreground">
                  {rejectDialog.club.description}
                </p>
              </div>
              <div>
                <label
                  htmlFor="rejection-reason"
                  className="text-sm font-medium mb-2 block"
                >
                  Rejection Reason <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Explain why this club cannot be approved..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  maxLength={500}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {rejectionReason.length}/500 characters
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialog({ open: false, club: null });
                setRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectionReason.trim()}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject Club
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog
        open={detailsDialog.open}
        onOpenChange={(open) => setDetailsDialog({ open, club: null })}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Club Details</DialogTitle>
            <DialogDescription>
              Review complete information about this club submission
            </DialogDescription>
          </DialogHeader>
          {detailsDialog.club && (
            <div className="py-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Club Name
                </h4>
                <p className="text-base font-semibold">
                  {detailsDialog.club.name}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">
                  Description
                </h4>
                <p className="text-sm">{detailsDialog.club.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Creator Email
                  </h4>
                  <p className="text-sm">
                    {detailsDialog.club.creator_email || 'N/A'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Status
                  </h4>
                  <Badge variant="warning">
                    {detailsDialog.club.approval_status}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Created At
                  </h4>
                  <p className="text-sm">
                    {formatDate(detailsDialog.club.created_at)}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Last Updated
                  </h4>
                  <p className="text-sm">
                    {formatDate(detailsDialog.club.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailsDialog({ open: false, club: null })}
            >
              Close
            </Button>
            {detailsDialog.club && (
              <>
                <Button
                  onClick={() => {
                    setDetailsDialog({ open: false, club: null });
                    handleApproveClick(detailsDialog.club!);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDetailsDialog({ open: false, club: null });
                    handleRejectClick(detailsDialog.club!);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
