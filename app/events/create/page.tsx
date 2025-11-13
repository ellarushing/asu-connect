'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

interface Club {
  id: string;
  name: string;
}

export default function CreateEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    event_time: '12:00',
    location: '',
    club_id: '',
  });

  // Fetch clubs on component mount
  useEffect(() => {
    const fetchClubs = async () => {
      try {
        const response = await fetch('/api/clubs');
        if (!response.ok) {
          throw new Error('Failed to fetch clubs');
        }
        const data = await response.json();
        setClubs(data.clubs || []);

        // Auto-select first club if available
        if (data.clubs && data.clubs.length > 0) {
          setFormData((prev) => ({
            ...prev,
            club_id: data.clubs[0].id,
          }));
        }
      } catch (err) {
        console.error('Error fetching clubs:', err);
      } finally {
        setClubsLoading(false);
      }
    };

    fetchClubs();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate form
      if (!formData.title.trim()) {
        throw new Error('Event title is required');
      }

      if (formData.title.length > 255) {
        throw new Error('Event title must be 255 characters or less');
      }

      if (!formData.event_date) {
        throw new Error('Event date is required');
      }

      if (!formData.club_id) {
        throw new Error('Please select a club');
      }

      if (formData.description.length > 2000) {
        throw new Error('Description must be 2000 characters or less');
      }

      // Combine date and time into ISO format
      const eventDateTime = `${formData.event_date}T${formData.event_time}:00`;

      // Submit to API
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          event_date: eventDateTime,
          location: formData.location.trim() || null,
          club_id: formData.club_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create event');
      }

      const data = await response.json();

      // Redirect to events page
      router.push('/events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <div className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background p-4">
          <SidebarTrigger />
          <Link href="/events">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Create Event</h1>
        </div>

        <div className="p-6 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>New Event</CardTitle>
              <CardDescription>
                Create a new event for your club
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-md">
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              {clubsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Loading clubs...</p>
                </div>
              ) : clubs.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    You need to create or join a club before creating an event.
                  </p>
                  <Link href="/clubs">
                    <Button>Browse Clubs</Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Event Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Event Title *</Label>
                    <Input
                      id="title"
                      name="title"
                      type="text"
                      placeholder="Enter event title"
                      value={formData.title}
                      onChange={handleInputChange}
                      maxLength={255}
                      required
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.title.length}/255 characters
                    </p>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Enter event description (optional)"
                      value={formData.description}
                      onChange={handleInputChange}
                      maxLength={2000}
                      rows={4}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.description.length}/2000 characters
                    </p>
                  </div>

                  {/* Date and Time Row */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Event Date */}
                    <div className="space-y-2">
                      <Label htmlFor="event_date">Event Date *</Label>
                      <Input
                        id="event_date"
                        name="event_date"
                        type="date"
                        value={formData.event_date}
                        onChange={handleInputChange}
                        required
                        disabled={loading}
                      />
                    </div>

                    {/* Event Time */}
                    <div className="space-y-2">
                      <Label htmlFor="event_time">Time *</Label>
                      <Input
                        id="event_time"
                        name="event_time"
                        type="time"
                        value={formData.event_time}
                        onChange={handleInputChange}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      name="location"
                      type="text"
                      placeholder="Enter event location (optional)"
                      value={formData.location}
                      onChange={handleInputChange}
                      disabled={loading}
                    />
                  </div>

                  {/* Club Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="club_id">Club *</Label>
                    <select
                      id="club_id"
                      name="club_id"
                      value={formData.club_id}
                      onChange={handleInputChange}
                      required
                      disabled={loading || clubs.length === 0}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                    >
                      <option value="">Select a club</option>
                      {clubs.map((club) => (
                        <option key={club.id} value={club.id}>
                          {club.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex gap-3 pt-6">
                    <Link href="/events" className="flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                    </Link>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={loading}
                    >
                      {loading ? 'Creating...' : 'Create Event'}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </SidebarProvider>
  );
}
