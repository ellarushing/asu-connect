import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Flag,
  ShieldCheck,
  TrendingUp,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

interface AdminStats {
  summary: {
    total_pending_items: number;
    pending_flags: number;
    pending_clubs: number;
    requires_attention: boolean;
  };
  flags: {
    event_flags: {
      total: number;
      pending: number;
      reviewed: number;
      resolved: number;
      dismissed: number;
    };
    club_flags: {
      total: number;
      pending: number;
      reviewed: number;
      resolved: number;
      dismissed: number;
    };
    combined: {
      total: number;
      pending: number;
      reviewed: number;
      resolved: number;
      dismissed: number;
    };
  };
  clubs: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    approval_rate: string;
  };
  recent_activity: Array<{
    id: string;
    admin_id: string;
    admin_email: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: Record<string, unknown> | null;
    created_at: string;
  }>;
  fetched_at: string;
}

async function getAdminStats(): Promise<AdminStats | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/stats`,
      {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch admin stats:', response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return null;
  }
}

function formatActionName(action: string): string {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

  if (!stats) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Failed to load dashboard statistics
              </p>
              <p className="text-xs text-destructive/75">
                Please try refreshing the page
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor and manage content, clubs, and user reports
        </p>
      </div>

      {/* Alert Banner - Show if requires attention */}
      {stats.summary.requires_attention && (
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {stats.summary.total_pending_items} item
                {stats.summary.total_pending_items !== 1 ? 's' : ''} require
                {stats.summary.total_pending_items === 1 ? 's' : ''} your
                attention
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {stats.summary.pending_flags} pending flag
                {stats.summary.pending_flags !== 1 ? 's' : ''} and{' '}
                {stats.summary.pending_clubs} pending club
                {stats.summary.pending_clubs !== 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Pending Flags Card */}
        <Link href="/admin/flags">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Flags
              </CardTitle>
              <Flag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.summary.pending_flags}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.flags.combined.total} total flags
              </p>
              {stats.summary.pending_flags > 0 && (
                <Button variant="outline" size="sm" className="w-full mt-3">
                  Review Flags
                </Button>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Pending Clubs Card */}
        <Link href="/admin/clubs">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Clubs
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.clubs.pending}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.clubs.total} total clubs
              </p>
              {stats.clubs.pending > 0 && (
                <Button variant="outline" size="sm" className="w-full mt-3">
                  Review Clubs
                </Button>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Approval Rate Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Approval Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clubs.approval_rate}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.clubs.approved} approved, {stats.clubs.rejected} rejected
            </p>
          </CardContent>
        </Card>

        {/* Recent Activity Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recent Actions
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.recent_activity.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 10 moderation actions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Flags Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Flags Overview</CardTitle>
            <CardDescription>
              Content moderation and flag statistics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">Pending</span>
              </div>
              <span className="text-sm font-bold">
                {stats.flags.combined.pending}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Resolved</span>
              </div>
              <span className="text-sm font-bold">
                {stats.flags.combined.resolved}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Dismissed</span>
              </div>
              <span className="text-sm font-bold">
                {stats.flags.combined.dismissed}
              </span>
            </div>
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Event Flags</span>
                <span className="text-sm">
                  {stats.flags.event_flags.pending} /{' '}
                  {stats.flags.event_flags.total}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-medium">Club Flags</span>
                <span className="text-sm">
                  {stats.flags.club_flags.pending} /{' '}
                  {stats.flags.club_flags.total}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Moderation Activity</CardTitle>
            <CardDescription>
              Latest actions taken by administrators
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recent_activity.length > 0 ? (
              <div className="space-y-4">
                {stats.recent_activity.slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start justify-between gap-3 pb-3 border-b last:border-b-0 last:pb-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {formatActionName(activity.action)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.entity_type} • {activity.admin_email}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(activity.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common administrative tasks and navigation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link href="/admin/flags">
              <Button variant="outline" className="w-full justify-start">
                <Flag className="w-4 h-4 mr-2" />
                Review Flagged Content
              </Button>
            </Link>
            <Link href="/admin/clubs">
              <Button variant="outline" className="w-full justify-start">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Approve Pending Clubs
              </Button>
            </Link>
            <Link href="/admin/logs">
              <Button variant="outline" className="w-full justify-start">
                <Activity className="w-4 h-4 mr-2" />
                View Moderation Logs
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
