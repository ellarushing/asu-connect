import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ClubsList } from "@/components/clubs-list";
import { createClient } from "@/utils/supabase/server";
import { isAdmin, canCreateClubs } from "@/lib/auth/admin";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default async function ClubsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const isAuthenticated = !!data?.user;
  const userIsAdmin = data?.user ? await isAdmin(data.user.id) : false;
  const userCanCreateClubs = data?.user ? await canCreateClubs(data.user.id) : false;

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background p-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-2xl font-bold">Clubs</h1>
          </div>
          {userCanCreateClubs && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/clubs/create">
                  <Button size="sm" className="gap-2">
                    <Plus className="size-4" />
                    Create Club
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create a new club{userIsAdmin ? " (will be auto-approved)" : " (requires admin approval)"}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="p-6">
          <ClubsList />
        </div>
      </main>
    </SidebarProvider>
  );
}
