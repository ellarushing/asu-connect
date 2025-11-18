'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  email: string | null;
  full_name: string | null;
}

interface ClubMembersListProps {
  clubId: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ClubMembersList({ clubId }: ClubMembersListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, [clubId]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/clubs/${clubId}/members`);

      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error('Error fetching members:', err);
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getMemberDisplayName = (member: Member) => {
    if (member.full_name) {
      return member.full_name;
    }
    if (member.email) {
      return member.email.split('@')[0];
    }
    return 'Anonymous Member';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Users className="h-5 w-5" />
              Members
            </CardTitle>
            <CardDescription>
              {loading ? 'Loading...' : `${members.length} total members`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-center py-8">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && members.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No members yet</p>
          </div>
        )}

        {!loading && !error && members.length > 0 && (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">
                      {getMemberDisplayName(member)}
                    </p>
                    {member.role === 'admin' && (
                      <Badge variant="default" className="text-xs">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Joined {formatDate(member.joined_at)}
                  </p>
                </div>
                {member.email && member.full_name && (
                  <p className="text-xs text-muted-foreground hidden md:block">
                    {member.email}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
