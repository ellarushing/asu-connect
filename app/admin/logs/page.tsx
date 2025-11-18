'use client';

import { useEffect, useState } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertCircle,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ModerationLog {
  id: string;
  admin_id: string;
  admin_email: string | null;
  admin_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, any> | null;
  created_at: string;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  returned: number;
}

type ActionFilter = 'all' | string;
type EntityTypeFilter = 'all' | 'club' | 'event' | 'flag' | 'user';

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<EntityTypeFilter>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Detailed view
  const [selectedLog, setSelectedLog] = useState<ModerationLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityTypeFilter, currentPage]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (actionFilter !== 'all') params.append('action', actionFilter);
      if (entityTypeFilter !== 'all') params.append('entity_type', entityTypeFilter);
      params.append('limit', itemsPerPage.toString());
      params.append('offset', ((currentPage - 1) * itemsPerPage).toString());

      const response = await fetch(`/api/admin/logs?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    // Map action types to badge variants and colors
    if (action.includes('approve')) {
      return <Badge variant="success">Approve</Badge>;
    } else if (action.includes('reject')) {
      return <Badge variant="destructive">Reject</Badge>;
    } else if (action.includes('delete')) {
      return <Badge variant="destructive">Delete</Badge>;
    } else if (action.includes('ban')) {
      return <Badge variant="destructive">Ban</Badge>;
    } else if (action.includes('unban')) {
      return <Badge variant="success">Unban</Badge>;
    } else if (action.includes('resolve')) {
      return <Badge variant="success">Resolve</Badge>;
    } else if (action.includes('dismiss')) {
      return <Badge variant="secondary">Dismiss</Badge>;
    } else if (action.includes('review')) {
      return <Badge variant="default">Review</Badge>;
    } else if (action.includes('update')) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        Update
      </Badge>;
    } else {
      return <Badge variant="outline">{formatActionLabel(action)}</Badge>;
    }
  };

  const getEntityTypeBadge = (type: string) => {
    switch (type) {
      case 'event':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Event
          </Badge>
        );
      case 'club':
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            Club
          </Badge>
        );
      case 'flag':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            Flag
          </Badge>
        );
      case 'user':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            User
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatActionLabel = (action: string) => {
    return action
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const openDetailsDialog = (log: ModerationLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [actionFilter, entityTypeFilter]);

  // Calculate total pages
  const totalPages = pagination ? Math.ceil(pagination.total / itemsPerPage) : 1;

  if (loading && logs.length === 0) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 w-full">
          <div className="flex items-center gap-4 p-6 border-b">
            <SidebarTrigger />
            <h1 className="text-3xl font-bold">Moderation Logs</h1>
          </div>

          <div className="p-6 max-w-7xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
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
            <h1 className="text-3xl font-bold">Moderation Logs</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
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

          {/* Total Count Card */}
          {pagination && (
            <Card>
              <CardHeader>
                <CardDescription>Total Moderation Actions</CardDescription>
                <CardTitle className="text-3xl">{pagination.total}</CardTitle>
              </CardHeader>
            </Card>
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-slate-600" />
                <CardTitle className="text-lg">Filters</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <Select
                    value={actionFilter}
                    onValueChange={(value) => setActionFilter(value as ActionFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="approve_club">Approve Club</SelectItem>
                      <SelectItem value="reject_club">Reject Club</SelectItem>
                      <SelectItem value="delete_club">Delete Club</SelectItem>
                      <SelectItem value="approve_event">Approve Event</SelectItem>
                      <SelectItem value="reject_event">Reject Event</SelectItem>
                      <SelectItem value="delete_event">Delete Event</SelectItem>
                      <SelectItem value="review_flag">Review Flag</SelectItem>
                      <SelectItem value="resolve_flag">Resolve Flag</SelectItem>
                      <SelectItem value="dismiss_flag">Dismiss Flag</SelectItem>
                      <SelectItem value="ban_user">Ban User</SelectItem>
                      <SelectItem value="unban_user">Unban User</SelectItem>
                      <SelectItem value="update_user_role">Update User Role</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Entity Type</Label>
                  <Select
                    value={entityTypeFilter}
                    onValueChange={(value) => setEntityTypeFilter(value as EntityTypeFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="club">Clubs</SelectItem>
                      <SelectItem value="event">Events</SelectItem>
                      <SelectItem value="flag">Flags</SelectItem>
                      <SelectItem value="user">Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logs List */}
          {logs.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    {actionFilter !== 'all' || entityTypeFilter !== 'all'
                      ? 'No logs match your current filters.'
                      : 'No moderation logs have been recorded yet.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-4">
                {logs.map((log) => {
                  const isExpanded = expandedLogs.has(log.id);
                  const hasDetails = log.details && Object.keys(log.details).length > 0;

                  return (
                    <Card key={log.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          {/* Header Row */}
                          <div className="flex items-start gap-3 flex-wrap justify-between">
                            <div className="flex items-center gap-3 flex-wrap flex-1">
                              {getActionBadge(log.action)}
                              {getEntityTypeBadge(log.entity_type)}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-lg text-slate-900">
                                  {formatActionLabel(log.action)}
                                </h3>
                              </div>
                            </div>
                            <span className="text-sm text-slate-500 whitespace-nowrap">
                              {formatRelativeTime(log.created_at)}
                            </span>
                          </div>

                          {/* Admin and Entity Info */}
                          <div className="space-y-2 text-sm">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              <div>
                                <span className="font-medium text-slate-700">Admin:</span>{' '}
                                <span className="text-slate-600">
                                  {log.admin_name || log.admin_email || 'Unknown'}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-slate-700">Entity ID:</span>{' '}
                                <span className="text-slate-600 font-mono text-xs">
                                  {log.entity_id.substring(0, 8)}...
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-slate-700">Timestamp:</span>{' '}
                                <span className="text-slate-600" title={formatFullDate(log.created_at)}>
                                  {formatRelativeTime(log.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Details Section */}
                          {hasDetails && (
                            <div className="border-t pt-3 mt-3">
                              <button
                                onClick={() => toggleLogExpansion(log.id)}
                                className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                                {isExpanded ? 'Hide' : 'Show'} Details
                              </button>

                              {isExpanded && (
                                <div className="mt-3 bg-slate-50 rounded-md p-4 border">
                                  <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap break-words">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="mt-2 p-0 h-auto text-blue-600"
                                    onClick={() => openDetailsDialog(log)}
                                  >
                                    View Full Details
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination && totalPages > 1 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-sm text-slate-600">
                        Showing {pagination.offset + 1} to{' '}
                        {Math.min(pagination.offset + pagination.returned, pagination.total)} of{' '}
                        {pagination.total} logs
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1 || loading}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium px-2">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages || loading}
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

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            {selectedLog && (
              <>
                <DialogHeader>
                  <DialogTitle>Moderation Log Details</DialogTitle>
                  <DialogDescription>
                    Full information about this moderation action
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {/* Action and Type */}
                  <div className="flex gap-2">
                    {getActionBadge(selectedLog.action)}
                    {getEntityTypeBadge(selectedLog.entity_type)}
                  </div>

                  {/* Log Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold">Action</Label>
                      <p className="text-sm mt-1">{formatActionLabel(selectedLog.action)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">Entity Type</Label>
                      <p className="text-sm mt-1 capitalize">{selectedLog.entity_type}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">Admin</Label>
                      <p className="text-sm mt-1">
                        {selectedLog.admin_name && <span className="font-medium">{selectedLog.admin_name}<br /></span>}
                        {selectedLog.admin_email || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">Timestamp</Label>
                      <p className="text-sm mt-1">{formatFullDate(selectedLog.created_at)}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-semibold">Entity ID</Label>
                      <p className="text-sm mt-1 font-mono bg-slate-50 p-2 rounded border break-all">
                        {selectedLog.entity_id}
                      </p>
                    </div>
                  </div>

                  {/* Details JSON */}
                  {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                    <div className="border-t pt-4">
                      <Label className="text-sm font-semibold mb-2 block">Additional Details</Label>
                      <div className="bg-slate-50 rounded-md p-4 border">
                        <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(selectedLog.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </SidebarProvider>
  );
}
