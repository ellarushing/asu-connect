"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, ChevronDown, Clock, CheckCircle, XCircle } from "lucide-react";

interface Club {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  created_by: string;
}

type SortOption = "name" | "newest" | "oldest";

export function ClubsList() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("name");

  const fetchClubs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/clubs?sortBy=${sortBy}`, {
        cache: 'no-store', // Always fetch fresh data
      });

      if (!response.ok) {
        throw new Error("Failed to fetch clubs");
      }

      const data = await response.json();
      setClubs(data.clubs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  // Refresh clubs when the page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchClubs();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  const getSortLabel = () => {
    const labels: Record<SortOption, string> = {
      name: "Name",
      newest: "Newest",
      oldest: "Oldest",
    };
    return labels[sortBy];
  };

  return (
    <>
      {/* Sort Dropdown */}
      <div className="mb-6 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              Sort by: {getSortLabel()}
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setSortBy("name")}
              className={sortBy === "name" ? "bg-accent" : ""}
            >
              Name
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy("newest")}
              className={sortBy === "newest" ? "bg-accent" : ""}
            >
              Newest First
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortBy("oldest")}
              className={sortBy === "oldest" ? "bg-accent" : ""}
            >
              Oldest First
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="cursor-wait">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="mt-2 h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : clubs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Users className="mb-3 size-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No clubs yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create the first club or wait for others to create clubs
          </p>
          <Link href="/clubs/create">
            <Button className="mt-4" size="sm">
              Create a Club
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <Link key={club.id} href={`/clubs/${club.id}`}>
              <Card className="h-full transition-all duration-200 hover:shadow-lg hover:ring-1 hover:ring-primary/20 cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <CardTitle className="line-clamp-2 flex-1">{club.name}</CardTitle>
                    {club.approval_status === 'pending' && (
                      <Badge variant="outline" className="flex items-center gap-1 shrink-0">
                        <Clock className="size-3" />
                        Pending
                      </Badge>
                    )}
                    {club.approval_status === 'rejected' && (
                      <Badge variant="destructive" className="flex items-center gap-1 shrink-0">
                        <XCircle className="size-3" />
                        Rejected
                      </Badge>
                    )}
                    {club.approval_status === 'approved' && (
                      <Badge variant="success" className="flex items-center gap-1 shrink-0">
                        <CheckCircle className="size-3" />
                        Approved
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="line-clamp-2">
                    {club.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  <span>
                    {club.member_count}{" "}
                    {club.member_count === 1 ? "member" : "members"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
