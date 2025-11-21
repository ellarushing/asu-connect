import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/utils/supabase/server';
import { Calendar, Users, Megaphone, ExternalLink } from 'lucide-react';

interface Club {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

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
}

async function getAdminClubs(userId: string): Promise<Club[]> {
  const supabase = await createClient();

  // Fetch clubs where user is an admin
  const { data: adminMemberships } = await supabase
    .from('club_members')
    .select(`
      club_id,
      clubs:club_id (
        id,
        name,
        description,
        created_by,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', userId)
    .eq('role', 'admin')
    .eq('status', 'approved');

  const clubs = (adminMemberships || [])
    .map((membership: { clubs: Club | null }) => membership.clubs)
    .filter((club: Club | null): club is Club => club !== null);

  return clubs;
}

async function getUserClubs(userId: string) {
  const supabase = await createClient();

  // Fetch clubs where user is a member
  const { data: clubMembers, error: memberError } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', userId);

  if (memberError) {
    throw new Error(memberError.message);
  }

  if (!clubMembers || clubMembers.length === 0) {
    return [];
  }

  // Fetch club details
  const clubIds = clubMembers.map((m) => m.club_id);
  const { data: clubs, error: clubsError } = await supabase
    .from('clubs')
    .select('*')
    .in('id', clubIds);

  if (clubsError) {
    throw new Error(clubsError.message);
  }

  return clubs || [];
}

async function getUserEvents(userId: string) {
  const supabase = await createClient();

  // Fetch events where user is registered
  const { data: registrations, error: regError } = await supabase
    .from('event_registrations')
    .select('event_id')
    .eq('user_id', userId);

  if (regError) {
    throw new Error(regError.message);
  }

  if (!registrations || registrations.length === 0) {
    return [];
  }

  // Fetch event details
  const eventIds = registrations.map((r) => r.event_id);
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .in('id', eventIds)
    .order('event_date', { ascending: true });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  return events || [];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect('/login');
  }

  let userClubs: Club[] = [];
  let adminClubs: Club[] = [];
  let userEvents: Event[] = [];
  let clubsError: string | null = null;
  let adminClubsError: string | null = null;
  let eventsError: string | null = null;

  try {
    userClubs = await getUserClubs(data.user.id);
  } catch (err) {
    clubsError = err instanceof Error ? err.message : 'Failed to fetch clubs';
  }

  try {
    adminClubs = await getAdminClubs(data.user.id);
  } catch (err) {
    adminClubsError = err instanceof Error ? err.message : 'Failed to fetch admin clubs';
  }

  try {
    userEvents = await getUserEvents(data.user.id);
  } catch (err) {
    eventsError = err instanceof Error ? err.message : 'Failed to fetch events';
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 w-full">
        <div className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b">
          <SidebarTrigger />
        </div>

        <div className="p-6 md:p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back! Here&apos;s an overview of your clubs and registered
              events.
            </p>
          </div>

          {/* My Clubs Section */}
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5" />
              <h2 className="text-2xl font-semibold">My Clubs</h2>
            </div>

            {clubsError ? (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="flex items-center gap-3 pt-6">
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      Error loading clubs
                    </p>
                    <p className="text-xs text-destructive/75">{clubsError}</p>
                  </div>
                </CardContent>
              </Card>
            ) : userClubs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userClubs.map((club) => (
                  <Link key={club.id} href={`/clubs/${club.id}`}>
                    <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                      <CardHeader>
                        <CardTitle className="line-clamp-2">
                          {club.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {club.description || 'No description provided'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-0">
                        <p className="text-xs text-muted-foreground">
                          Joined{' '}
                          {new Date(club.created_at).toLocaleDateString()}
                        </p>
                      </CardContent>
                      <CardFooter className="pt-4">
                        <Button variant="outline" size="sm" className="w-full">
                          View Details
                        </Button>
                      </CardFooter>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    You haven&apos;t joined any clubs yet.{' '}
                    <Link href="/clubs" className="text-primary hover:underline">
                      Browse clubs
                    </Link>{' '}
                    to get started!
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Manage Your Clubs Section - Only for Club Admins */}
          {adminClubs.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <Megaphone className="w-5 h-5" />
                <h2 className="text-2xl font-semibold">Manage Your Clubs</h2>
              </div>

              {adminClubsError ? (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="flex items-center gap-3 pt-6">
                    <div>
                      <p className="text-sm font-medium text-destructive">
                        Error loading admin clubs
                      </p>
                      <p className="text-xs text-destructive/75">{adminClubsError}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {adminClubs.map((club) => (
                    <Card key={club.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="line-clamp-1 flex items-center gap-2">
                              {club.name}
                              <Badge variant="secondary" className="text-xs">
                                Admin
                              </Badge>
                            </CardTitle>
                            <CardDescription className="line-clamp-2 mt-2">
                              {club.description || 'No description provided'}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                          Post announcements, manage members, and create events for this club.
                        </p>
                      </CardContent>
                      <CardFooter className="flex gap-2">
                        <Link href={`/clubs/${club.id}`} className="flex-1">
                          <Button variant="default" size="sm" className="w-full">
                            <Megaphone className="w-4 h-4 mr-2" />
                            Post Announcement
                          </Button>
                        </Link>
                        <Link href={`/clubs/${club.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Manage Club
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* My Events Section */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5" />
              <h2 className="text-2xl font-semibold">My Events</h2>
            </div>

            {eventsError ? (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="flex items-center gap-3 pt-6">
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      Error loading events
                    </p>
                    <p className="text-xs text-destructive/75">{eventsError}</p>
                  </div>
                </CardContent>
              </Card>
            ) : userEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userEvents.map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`}>
                    <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                      <CardHeader>
                        <CardTitle className="line-clamp-2">
                          {event.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {event.description || 'No description provided'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-0 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Date:</span>{' '}
                          {formatDate(event.event_date)}
                        </p>
                        {event.location && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Location:</span>{' '}
                            {event.location}
                          </p>
                        )}
                      </CardContent>
                      <CardFooter className="pt-4">
                        <Button variant="outline" size="sm" className="w-full">
                          View Details
                        </Button>
                      </CardFooter>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    You haven&apos;t registered for any events yet.{' '}
                    <Link
                      href="/events"
                      className="text-primary hover:underline"
                    >
                      Browse events
                    </Link>{' '}
                    to get started!
                  </p>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </main>
    </SidebarProvider>
  );
}
