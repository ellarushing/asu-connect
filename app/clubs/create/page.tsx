import Link from 'next/link';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ClubCreateForm } from '@/components/club-create-form';
import { ArrowLeft } from 'lucide-react';

export default function CreateClubPage() {
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
