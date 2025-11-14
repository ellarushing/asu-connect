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
import { ChevronDown, Calendar, MapPin, Users } from "lucide-react";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  club_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  category: string | null;
  is_free: boolean;
  price: number | null;
}

interface ApiResponse {
  events: Event[];
  sortBy?: string;
}

type SortOption = "date" | "name" | "popularity";
type CategoryOption = "all" | "Academic" | "Social" | "Sports" | "Arts" | "Career" | "Community Service" | "Other";
type PricingOption = "all" | "free" | "paid";

export function EventsList() {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [category, setCategory] = useState<CategoryOption>("all");
  const [pricing, setPricing] = useState<PricingOption>("all");

  // Fetch events from API
  const fetchEvents = async (sortOption: SortOption, categoryOption: CategoryOption, pricingOption: PricingOption) => {
    try {
      setLoading(true);
      setError(null);

      // Build query params
      const params = new URLSearchParams();
      params.append('sortBy', sortOption);
      if (categoryOption !== 'all') {
        params.append('category', categoryOption);
      }
      params.append('pricing', pricingOption);

      const response = await fetch(
        `/api/events?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.statusText}`);
      }

      const data: ApiResponse = await response.json();
      setEvents(data.events || []);
      setSortBy(sortOption);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchEvents(sortBy, category, pricing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle filter changes
  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    fetchEvents(newSort, category, pricing);
  };

  const handleCategoryChange = (newCategory: CategoryOption) => {
    setCategory(newCategory);
    fetchEvents(sortBy, newCategory, pricing);
  };

  const handlePricingChange = (newPricing: PricingOption) => {
    setPricing(newPricing);
    fetchEvents(sortBy, category, newPricing);
  };

  return (
    <>
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Category filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                Category: {category === "all" ? "All" : category}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleCategoryChange("all")}>
                All Categories
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryChange("Academic")}>
                Academic
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryChange("Social")}>
                Social
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryChange("Sports")}>
                Sports
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryChange("Arts")}>
                Arts
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryChange("Career")}>
                Career
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryChange("Community Service")}>
                Community Service
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCategoryChange("Other")}>
                Other
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Pricing filter */}
          <div className="flex gap-2 border rounded-md p-1">
            <Button
              variant={pricing === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => handlePricingChange("all")}
              className="flex-1 sm:flex-none"
            >
              All
            </Button>
            <Button
              variant={pricing === "free" ? "default" : "ghost"}
              size="sm"
              onClick={() => handlePricingChange("free")}
              className="flex-1 sm:flex-none"
            >
              Free
            </Button>
            <Button
              variant={pricing === "paid" ? "default" : "ghost"}
              size="sm"
              onClick={() => handlePricingChange("paid")}
              className="flex-1 sm:flex-none"
            >
              Paid
            </Button>
          </div>
        </div>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              Sort by {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleSortChange("date")}>
              Date
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSortChange("name")}>
              Name
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSortChange("popularity")}>
              Popularity
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p className="font-semibold">Error loading events</p>
          <p className="text-sm">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => fetchEvents(sortBy, category, pricing)}
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && !error && (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No events found</h2>
          <p className="text-muted-foreground mb-4">
            There are no events at the moment. Be the first to create one!
          </p>
          <Link href="/events/create">
            <Button>Create Event</Button>
          </Link>
        </div>
      )}

      {/* Events grid */}
      {!loading && events.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <CardTitle className="line-clamp-2 flex-1">
                      {event.title}
                    </CardTitle>
                    <div className="flex flex-col gap-1">
                      {event.category && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary whitespace-nowrap">
                          {event.category}
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap ${
                        event.is_free
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {event.is_free ? "FREE" : `$${event.price?.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {event.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Date and time */}
                  <div className="flex items-start gap-2 text-sm">
                    <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">{formatDate(event.event_date)}</p>
                    </div>
                  </div>

                  {/* Location */}
                  {event.location && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <p className="line-clamp-2 flex-1">{event.location}</p>
                    </div>
                  )}

                  {/* Club info - you might want to fetch club name separately */}
                  <div className="flex items-start gap-2 text-sm">
                    <Users className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <p className="text-muted-foreground">Club ID: {event.club_id.substring(0, 8)}...</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
