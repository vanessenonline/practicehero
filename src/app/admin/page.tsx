import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';

/**
 * Admin Dashboard Page
 * Server Component that verifies admin access before rendering the client component
 */
export default async function AdminPage() {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login');
  }

  // Verify admin status
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin, role')
    .eq('id', user.id)
    .single();

  // Redirect if not admin
  if (error || !profile?.is_admin) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🛡️ Admin Panel</h1>
          <p className="text-gray-600">
            Welkom, {profile.role}. Beheer users, bekijk statistieken en audit logs.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <AdminDashboard />
        </div>
      </div>
    </div>
  );
}
