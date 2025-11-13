import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { EventsList } from "@/components/events-list";

export default function EventsPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 w-full">
        <div className="flex items-center justify-between gap-4 p-6 border-b">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-3xl font-bold">Events</h1>
          </div>
          <Link href="/events/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Event
            </Button>
          </Link>
        </div>

        <div className="p-6">
          <EventsList />
        </div>
      </main>
    </SidebarProvider>
  );
}
