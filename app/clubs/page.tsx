"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
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
import { Plus, Users, ChevronDown } from "lucide-react";

interface Club {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count: number;
}

type SortOption = "name" | "newest" | "oldest";

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("name");

  useEffect(() => {
    fetchClubs();
  }, [sortBy]);

  const fetchClubs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/clubs?sortBy=${sortBy}`);

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

  const getSortLabel = () => {
    const labels: Record<SortOption, string> = {
      name: "Name",
      newest: "Newest",
      oldest: "Oldest",
    };
    return labels[sortBy];
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background p-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-2xl font-bold">Clubs</h1>
          </div>
          <Link href="/clubs/create">
            <Button size="sm" className="gap-2">
              <Plus className="size-4" />
              Create Club
            </Button>
          </Link>
        </div>

        <div className="p-6">
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
                      <CardTitle className="line-clamp-2">{club.name}</CardTitle>
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
        </div>
      </main>
    </SidebarProvider>
  );
}
