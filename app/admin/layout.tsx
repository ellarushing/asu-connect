import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentAdmin } from '@/lib/auth/admin';
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
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { NavUser } from '@/components/nav-user';
import { createClient } from '@/utils/supabase/server';
import {
  LayoutDashboard,
  Flag,
  ShieldCheck,
  ScrollText,
  AlertTriangle,
} from 'lucide-react';

// Admin navigation items
const adminMenuItems = [
  {
    title: 'Dashboard',
    url: '/admin',
    icon: LayoutDashboard,
    description: 'Overview and statistics',
  },
  {
    title: 'Flagged Content',
    url: '/admin/flags',
    icon: Flag,
    description: 'Review reported content',
  },
  {
    title: 'Pending Clubs',
    url: '/admin/clubs',
    icon: ShieldCheck,
    description: 'Approve or reject clubs',
  },
  {
    title: 'Moderation Logs',
    url: '/admin/logs',
    icon: ScrollText,
    description: 'View moderation history',
  },
];

async function AdminSidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from('profile')
    .select('*')
    .eq('user_id', user?.id)
    .single();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin Panel</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    <span>Back to User Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser
          user={{
            name: profileData?.name || '',
            email: user?.email || '',
            avatar: profileData?.avatar || '',
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check admin access
  const admin = await getCurrentAdmin();

  if (!admin) {
    // Redirect to home page if not an admin
    redirect('/');
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <main className="flex-1 w-full">
        <div className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <SidebarTrigger />
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Admin Mode
              </span>
            </div>
          </div>
        </div>
        {children}
      </main>
    </SidebarProvider>
  );
}
