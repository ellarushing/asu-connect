import {
  Calendar,
  Home,
  Inbox,
  Link,
  Search,
  Settings,
  UsersRound,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";
import { createClient } from "@/utils/supabase/server";
import { checkAdminAccess } from "@/lib/auth/admin";

// Menu items.
const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Dashboard",
    url: "dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Clubs",
    url: "clubs",
    icon: UsersRound,
  },
  {
    title: "Events",
    url: "events",
    icon: Calendar,
  },
];

export async function AppSidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profileData, error } = await supabase
    .from("profile")
    .select("*")
    .eq("user_id", user?.id)
    .single();

  // Check if user is an admin
  const isAdmin = await checkAdminAccess();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Admin Section - Only visible to admins */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/admin">
                      <ShieldCheck />
                      <span>Admin Dashboard</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>ASU-Connect</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: profileData?.name || "",
            email: user?.email || "",
            avatar: profileData?.avatar || "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
