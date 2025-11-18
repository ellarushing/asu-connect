import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { EventsList } from "@/components/events-list";
import { createClient } from "@/utils/supabase/server";
import { isAdmin } from "@/lib/auth/admin";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check if user can create events (platform admin OR admin of at least one club)
  let canCreateEvents = false;

  if (user) {
    // Check if user is a platform admin
    const isPlatformAdmin = await isAdmin(user.id);

    if (isPlatformAdmin) {
      canCreateEvents = true;
    } else {
      // Check if user is an admin of any club
      const { data: adminMemberships } = await supabase
        .from('club_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .eq('status', 'approved')
        .limit(1);

      canCreateEvents = (adminMemberships && adminMemberships.length > 0);
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 w-full">
        <div className="flex items-center justify-between gap-4 p-6 border-b">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-3xl font-bold">Events</h1>
          </div>
          {canCreateEvents && (
            <Link href="/events/create">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Event
              </Button>
            </Link>
          )}
        </div>

        <div className="p-6">
          <EventsList />
        </div>
      </main>
    </SidebarProvider>
  );
}
