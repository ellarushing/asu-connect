'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Trash2,
  RefreshCcw,
} from 'lucide-react';

interface Flag {
  id: string;
  entity_id: string;
  entity_type: 'event' | 'club';
  entity_title: string;
  user_id: string;
  user_email: string | null;
  reason: string;
  details: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewed_by: string | null;
  reviewer_email: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface FlagDetails extends Flag {
  entity: any;
  reporter: any;
  reviewer: any;
}

interface Statistics {
  total: number;
  event_flags: number;
  club_flags: number;
  pending: number;
  event_flags_pending: number;
  club_flags_pending: number;
}

interface ConfirmationDialog {
  open: boolean;
  title: string;
  description: string;
  action: 'update' | 'delete';
  flagId: string | null;
  newStatus?: 'reviewed' | 'resolved' | 'dismissed';
  deleteEntity?: boolean;
}

type StatusFilter = 'all' | 'pending' | 'reviewed' | 'resolved' | 'dismissed';
type TypeFilter = 'all' | 'event' | 'club';

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingFlagId, setUpdatingFlagId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Detailed view
  const [selectedFlag, setSelectedFlag] = useState<FlagDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationDialog>({
    open: false,
    title: '',
    description: '',
    action: 'update',
    flagId: null,
  });

  useEffect(() => {
    fetchFlags();
  }, [statusFilter, typeFilter]);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      params.append('limit', '100');
      params.append('offset', '0');

      const response = await fetch(`/api/admin/flags?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch flags');
      }

      const data = await response.json();
      setFlags(data.flags || []);
      setStatistics(data.statistics);
    } catch (err) {
      console.error('Error fetching flags:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch flags');
    } finally {
      setLoading(false);
    }
  };

  const fetchFlagDetails = async (flagId: string) => {
    try {
      setLoadingDetails(true);
      const response = await fetch(`/api/admin/flags/${flagId}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch flag details');
      }

      const data = await response.json();
      setSelectedFlag(data.flag);
      setDetailsOpen(true);
    } catch (err) {
      console.error('Error fetching flag details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch flag details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const updateFlagStatus = async (flagId: string, newStatus: 'reviewed' | 'resolved' | 'dismissed') => {
    try {
      setUpdatingFlagId(flagId);
      setError(null);

      const response = await fetch(`/api/admin/flags/${flagId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update flag status');
      }

      // Optimistic update
      setFlags((prevFlags) =>
        prevFlags.map((flag) =>
          flag.id === flagId ? { ...flag, status: newStatus } : flag
        )
      );

      // Refresh to get accurate data
      await fetchFlags();
    } catch (err) {
      console.error('Error updating flag status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update flag status');
    } finally {
      setUpdatingFlagId(null);
    }
  };

  const deleteFlag = async (flagId: string, deleteEntity: boolean = false) => {
    try {
      setUpdatingFlagId(flagId);
      setError(null);

      const params = new URLSearchParams();
      if (deleteEntity) params.append('deleteEntity', 'true');

      const response = await fetch(`/api/admin/flags/${flagId}?${params.toString()}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete flag');
      }

      // Remove flag from list
      setFlags((prevFlags) => prevFlags.filter((flag) => flag.id !== flagId));

      // Close details if open
      if (selectedFlag?.id === flagId) {
        setDetailsOpen(false);
        setSelectedFlag(null);
      }

      // Refresh statistics
      await fetchFlags();
    } catch (err) {
      console.error('Error deleting flag:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete flag');
    } finally {
      setUpdatingFlagId(null);
    }
  };

  const handleActionClick = (
    action: 'update' | 'delete',
    flagId: string,
    newStatus?: 'reviewed' | 'resolved' | 'dismissed',
    deleteEntity?: boolean
  ) => {
    if (action === 'update' && newStatus) {
      const statusLabels = {
        reviewed: 'mark this flag as reviewed',
        resolved: 'resolve this flag',
        dismissed: 'dismiss this flag',
      };

      setConfirmDialog({
        open: true,
        title: `Confirm ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
        description: `Are you sure you want to ${statusLabels[newStatus]}? This action will be logged.`,
        action: 'update',
        flagId,
        newStatus,
      });
    } else if (action === 'delete') {
      setConfirmDialog({
        open: true,
        title: deleteEntity ? 'Delete Flag and Entity' : 'Dismiss Flag',
        description: deleteEntity
          ? 'Are you sure you want to delete both the flag AND the flagged content? This action cannot be undone.'
          : 'Are you sure you want to dismiss this flag? The flag status will be updated to dismissed.',
        action: 'delete',
        flagId,
        deleteEntity,
      });
    }
  };

  const executeConfirmedAction = async () => {
    const { action, flagId, newStatus, deleteEntity } = confirmDialog;

    if (!flagId) return;

    if (action === 'update' && newStatus) {
      await updateFlagStatus(flagId, newStatus);
    } else if (action === 'delete') {
      await deleteFlag(flagId, deleteEntity);
    }

    setConfirmDialog({
      open: false,
      title: '',
      description: '',
      action: 'update',
      flagId: null,
    });
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

  const getTypeBadge = (type: string) => {
    return type === 'event' ? (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        Event
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
        Club
      </Badge>
    );
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

  // Filter flags based on search query
  const filteredFlags = flags.filter((flag) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      flag.entity_title.toLowerCase().includes(query) ||
      flag.reason.toLowerCase().includes(query) ||
      flag.user_email?.toLowerCase().includes(query) ||
      flag.details?.toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredFlags.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFlags = filteredFlags.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, searchQuery]);

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 w-full">
          <div className="flex items-center gap-4 p-6 border-b">
            <SidebarTrigger />
            <h1 className="text-3xl font-bold">Flagged Content Review</h1>
          </div>

          <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </CardHeader>
                </Card>
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 w-full">
        <div className="flex items-center justify-between gap-4 p-6 border-b">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-3xl font-bold">Flagged Content Review</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFlags}
            disabled={loading}
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Error Display */}
          {error && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="flex items-center gap-3 pt-6">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="text-xs text-destructive/75">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistics Cards */}
          {statistics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardDescription>Total Flags</CardDescription>
                  <CardTitle className="text-3xl">{statistics.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Pending Review</CardDescription>
                  <CardTitle className="text-3xl text-yellow-600">
                    {statistics.pending}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Event Flags</CardDescription>
                  <CardTitle className="text-3xl text-blue-600">
                    {statistics.event_flags}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Club Flags</CardDescription>
                  <CardTitle className="text-3xl text-purple-600">
                    {statistics.club_flags}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Filters and Search */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-slate-600" />
                  <CardTitle className="text-lg">Filters</CardTitle>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search flags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={typeFilter}
                    onValueChange={(value) => setTypeFilter(value as TypeFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="event">Events</SelectItem>
                      <SelectItem value="club">Clubs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Flags List */}
          {paginatedFlags.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                    ? 'No flags match your current filters.'
                    : 'No flags have been reported yet.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-4">
                {paginatedFlags.map((flag) => (
                  <Card key={flag.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex flex-col md:flex-row gap-4 justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start gap-3 flex-wrap">
                            {getTypeBadge(flag.entity_type)}
                            {getStatusBadge(flag.status)}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg text-slate-900 break-words">
                                {flag.reason}
                              </h3>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-700">Entity:</span>
                              <Link
                                href={`/${flag.entity_type}s/${flag.entity_id}`}
                                className="text-blue-600 hover:underline flex items-center gap-1"
                                target="_blank"
                              >
                                {flag.entity_title}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">Reporter:</span>{' '}
                              <span className="text-slate-600">
                                {flag.user_email || 'Unknown'}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-slate-700">Reported:</span>{' '}
                              <span className="text-slate-600">
                                {formatDate(flag.created_at)}
                              </span>
                            </div>
                            {flag.details && (
                              <div className="bg-slate-50 rounded-md p-3 border mt-2">
                                <p className="text-sm text-slate-700 break-words">
                                  {flag.details}
                                </p>
                              </div>
                            )}
                            {flag.reviewed_at && flag.reviewer_email && (
                              <div className="bg-blue-50 rounded-md p-2 border border-blue-200 mt-2">
                                <p className="text-xs text-blue-700">
                                  Reviewed by {flag.reviewer_email} on{' '}
                                  {formatDate(flag.reviewed_at)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex md:flex-col gap-2 flex-wrap md:flex-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchFlagDetails(flag.id)}
                            disabled={loadingDetails}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>

                          {flag.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleActionClick('update', flag.id, 'reviewed')}
                                disabled={updatingFlagId === flag.id}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Review
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleActionClick('update', flag.id, 'resolved')}
                                disabled={updatingFlagId === flag.id}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleActionClick('update', flag.id, 'dismissed')}
                                disabled={updatingFlagId === flag.id}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Dismiss
                              </Button>
                            </>
                          )}

                          {(flag.status === 'reviewed' || flag.status === 'pending') && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleActionClick('delete', flag.id, undefined, true)}
                              disabled={updatingFlagId === flag.id}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete Entity
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-600">
                        Showing {startIndex + 1} to {Math.min(endIndex, filteredFlags.length)} of{' '}
                        {filteredFlags.length} flags
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Flag Details Sheet */}
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            {selectedFlag && (
              <>
                <SheetHeader>
                  <SheetTitle>Flag Details</SheetTitle>
                  <SheetDescription>
                    Complete information about this flag report
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Status and Type */}
                  <div className="flex gap-2">
                    {getTypeBadge(selectedFlag.entity_type)}
                    {getStatusBadge(selectedFlag.status)}
                  </div>

                  {/* Flag Information */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold">Reason</Label>
                      <p className="text-sm mt-1">{selectedFlag.reason}</p>
                    </div>

                    {selectedFlag.details && (
                      <div>
                        <Label className="text-sm font-semibold">Details</Label>
                        <div className="bg-slate-50 rounded-md p-3 border mt-1">
                          <p className="text-sm">{selectedFlag.details}</p>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label className="text-sm font-semibold">Reported By</Label>
                      <p className="text-sm mt-1">
                        {selectedFlag.reporter?.email || selectedFlag.user_email || 'Unknown'}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-semibold">Reported On</Label>
                      <p className="text-sm mt-1">{formatDate(selectedFlag.created_at)}</p>
                    </div>

                    {selectedFlag.reviewed_at && (
                      <>
                        <div>
                          <Label className="text-sm font-semibold">Reviewed By</Label>
                          <p className="text-sm mt-1">
                            {selectedFlag.reviewer?.email || selectedFlag.reviewer_email || 'Unknown'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-semibold">Reviewed On</Label>
                          <p className="text-sm mt-1">{formatDate(selectedFlag.reviewed_at)}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Entity Information */}
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">
                      Flagged {selectedFlag.entity_type === 'event' ? 'Event' : 'Club'}
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-semibold">
                          {selectedFlag.entity_type === 'event' ? 'Title' : 'Name'}
                        </Label>
                        <p className="text-sm mt-1">
                          {selectedFlag.entity?.title || selectedFlag.entity?.name || selectedFlag.entity_title}
                        </p>
                      </div>

                      {selectedFlag.entity?.description && (
                        <div>
                          <Label className="text-sm font-semibold">Description</Label>
                          <div className="bg-slate-50 rounded-md p-3 border mt-1">
                            <p className="text-sm">{selectedFlag.entity.description}</p>
                          </div>
                        </div>
                      )}

                      {selectedFlag.entity_type === 'event' && selectedFlag.entity?.event_date && (
                        <div>
                          <Label className="text-sm font-semibold">Event Date</Label>
                          <p className="text-sm mt-1">
                            {formatDate(selectedFlag.entity.event_date)}
                          </p>
                        </div>
                      )}

                      {selectedFlag.entity_type === 'event' && selectedFlag.entity?.location && (
                        <div>
                          <Label className="text-sm font-semibold">Location</Label>
                          <p className="text-sm mt-1">{selectedFlag.entity.location}</p>
                        </div>
                      )}

                      <div>
                        <Link
                          href={`/${selectedFlag.entity_type}s/${selectedFlag.entity_id}`}
                          target="_blank"
                          className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                        >
                          View {selectedFlag.entity_type === 'event' ? 'Event' : 'Club'} Page
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {selectedFlag.status === 'pending' && (
                    <div className="border-t pt-4 space-y-2">
                      <Label className="text-sm font-semibold">Actions</Label>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            handleActionClick('update', selectedFlag.id, 'reviewed');
                            setDetailsOpen(false);
                          }}
                          disabled={updatingFlagId === selectedFlag.id}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Mark as Reviewed
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            handleActionClick('update', selectedFlag.id, 'resolved');
                            setDetailsOpen(false);
                          }}
                          disabled={updatingFlagId === selectedFlag.id}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Resolve Flag
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            handleActionClick('update', selectedFlag.id, 'dismissed');
                            setDetailsOpen(false);
                          }}
                          disabled={updatingFlagId === selectedFlag.id}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Dismiss Flag
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            handleActionClick('delete', selectedFlag.id, undefined, true);
                            setDetailsOpen(false);
                          }}
                          disabled={updatingFlagId === selectedFlag.id}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Flagged Content
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmDialog.title}</DialogTitle>
              <DialogDescription>{confirmDialog.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
              >
                Cancel
              </Button>
              <Button
                variant={confirmDialog.deleteEntity ? 'destructive' : 'default'}
                onClick={executeConfirmedAction}
                disabled={updatingFlagId !== null}
              >
                {updatingFlagId ? 'Processing...' : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </SidebarProvider>
  );
}
