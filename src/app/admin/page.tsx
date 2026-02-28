'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { deleteAuthUser } from '@/lib/actions/admin';

interface User {
  id: string;
  email: string;
  created_at: string;
  user_metadata: Record<string, unknown>;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const supabase = await createClient();

      // Get current user to verify admin access
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        setError('Je bent niet ingelogd');
        return;
      }

      // Fetch all users from the profiles table
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, created_at, role')
        .order('created_at', { ascending: false });

      if (profileError) {
        setError('Kon users niet laden: ' + profileError.message);
        return;
      }

      // For each profile, try to get email from auth metadata
      const usersData: User[] = profiles?.map((profile) => ({
        id: profile.id,
        email: `user-${profile.id.substring(0, 8)}`,
        created_at: profile.created_at,
        user_metadata: { role: profile.role },
      })) || [];

      setUsers(usersData);
      setError(null);
    } catch (err) {
      setError('Fout bij laden van users: ' + (err instanceof Error ? err.message : 'Onbekende fout'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Weet je zeker dat je deze user wilt verwijderen?')) {
      return;
    }

    try {
      setDeleteLoading(userId);
      const result = await deleteAuthUser(userId);

      if (result.success) {
        // Refresh users list
        await loadUsers();
        setError(null);
      } else {
        setError(result.error || 'Kon user niet verwijderen');
      }
    } catch (err) {
      setError('Fout bij verwijderen: ' + (err instanceof Error ? err.message : 'Onbekende fout'));
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Panel</h1>
        <p className="text-gray-600 mb-8">Beheer users en testaccounts</p>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h2 className="text-xl font-semibold text-gray-900">
              Users ({users.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-600">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <p className="mt-4">Users laden...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              Geen users gevonden
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">User ID</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Rol</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Aangemaakt</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                        {user.id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {(user.user_metadata?.role as string) || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString('nl-NL')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={deleteLoading === user.id}
                          className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
                        >
                          {deleteLoading === user.id ? 'Verwijderen...' : 'Verwijderen'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 bg-gray-50 border-t">
            <button
              onClick={loadUsers}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              Vernieuwen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
