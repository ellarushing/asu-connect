import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ClubCreateForm } from '@/components/club-create-form';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { isAdmin } from '@/lib/auth/admin';

export default async function CreateClubPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // Check if user is authenticated
  if (!data?.user) {
    redirect('/login?message=You must be logged in to access this page');
  }

  // Check if user is an admin
  const userIsAdmin = await isAdmin(data.user.id);

  if (!userIsAdmin) {
    redirect('/clubs?error=Only administrators can create clubs');
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <div className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background p-4">
          <SidebarTrigger />
          <Link href="/clubs">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Create Club</h1>
        </div>

        <div className="p-6 max-w-2xl mx-auto">
          <ClubCreateForm />
        </div>
      </main>
    </SidebarProvider>
  );
}
