import { redirect } from 'next/navigation';

/**
 * Admin Clubs Page
 *
 * This page redirects to the pending clubs page.
 * The main admin clubs functionality is at /admin/clubs/pending
 * where admins can review and approve/reject club submissions.
 */
export default function AdminClubsPage() {
  redirect('/admin/clubs/pending');
}
