import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1">
        <SidebarTrigger />
        <div className="flex flex-col items-center justify-center min-h-screen p-8 sm:p-20">
          {/* Hero Section */}
          <div className="max-w-2xl w-full text-center space-y-6">
            {/* Header */}
            <div className="space-y-4">
              <h1 className="text-6xl sm:text-7xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-500 bg-clip-text text-transparent">
                Welcome to ASU Connect
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                Your hub for discovering clubs, events, and campus connections at Arizona State University
              </p>
            </div>

            {/* Description */}
            <div className="bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-lg p-6 my-8">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Connect with fellow Sun Devils through clubs and events. Explore diverse communities on campus,
                find events that match your interests, and manage your campus experience all in one place.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
              <Link href="/clubs" className="flex-1 sm:flex-none">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  Browse Clubs
                </Button>
              </Link>
              <Link href="/events" className="flex-1 sm:flex-none">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-2"
                >
                  Browse Events
                </Button>
              </Link>
              <Link href="/dashboard" className="flex-1 sm:flex-none">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  View Dashboard
                </Button>
              </Link>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 pt-8 border-t border-gray-200 dark:border-slate-700">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">Discover</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Find clubs and organizations that match your passions
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">Engage</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Explore upcoming events and campus activities
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">Connect</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Build meaningful relationships with your community
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}
