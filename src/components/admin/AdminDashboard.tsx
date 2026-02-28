'use client';

import React, { useState, useEffect } from 'react';
import {
  getAdminUsers,
  getAdminStats,
  getAdminLogs,
  deleteUserWithLog,
  sendPasswordReset,
} from '@/lib/actions/admin-actions';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  is_admin: boolean;
  family_id: string | null;
}

interface AdminStats {
  total_users: number;
  parents: number;
  children: number;
  teachers: number;
  total_families: number;
  registrations_today: number;
}

interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

type Tab = 'stats' | 'users' | 'logs';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);

  // Load data on component mount and tab change
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'stats') {
        const result = await getAdminStats();
        if (result.success && result.stats) {
          setStats(result.stats);
        } else {
          setError(result.error || 'Could not load statistics');
        }
      } else if (activeTab === 'users') {
        const result = await getAdminUsers();
        if (result.success && result.users) {
          setUsers(result.users);
        } else {
          setError(result.error || 'Could not load users');
        }
      } else if (activeTab === 'logs') {
        const result = await getAdminLogs();
        if (result.success && result.logs) {
          setLogs(result.logs);
        } else {
          setError(result.error || 'Could not load logs');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Weet je zeker dat je deze user wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
      return;
    }

    try {
      setDeletingUserId(userId);
      const result = await deleteUserWithLog(userId, 'Admin deletion');

      if (result.success) {
        setUsers(users.filter(u => u.id !== userId));
        setError(null);
      } else {
        setError(result.error || 'Could not delete user');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handlePasswordReset = async (email: string) => {
    try {
      setResettingEmail(email);
      const result = await sendPasswordReset(email);

      if (result.success) {
        setError(null);
        alert(`Password reset email sent to ${email}`);
      } else {
        setError(result.error || 'Could not send password reset');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setResettingEmail(null);
    }
  };

  return (
    <div className="w-full">
      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📊 Statistieken
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          👥 Users
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'logs'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📋 Logs
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600">Laden...</span>
        </div>
      ) : activeTab === 'stats' && stats ? (
        // Statistics Tab
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Totaal Users</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {stats.total_users}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Ouders</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">
              {stats.parents}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Kinderen</div>
            <div className="text-3xl font-bold text-green-600 mt-2">
              {stats.children}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Docenten</div>
            <div className="text-3xl font-bold text-orange-600 mt-2">
              {stats.teachers}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Families</div>
            <div className="text-3xl font-bold text-purple-600 mt-2">
              {stats.total_families}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Registraties vandaag</div>
            <div className="text-3xl font-bold text-red-600 mt-2">
              {stats.registrations_today}
            </div>
          </div>
        </div>
      ) : activeTab === 'users' && users ? (
        // Users Tab
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">User ID</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Email</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Rol</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Admin</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Aangemaakt</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                    {user.id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {user.is_admin ? (
                      <span className="text-green-600 font-medium">✓ Admin</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(user.created_at).toLocaleDateString('nl-NL')}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() => handlePasswordReset(user.email)}
                      disabled={resettingEmail === user.email}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
                    >
                      {resettingEmail === user.email ? '📧...' : '🔐'}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={deletingUserId === user.id}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
                    >
                      {deletingUserId === user.id ? '🗑️...' : '🗑️'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'logs' ? (
        // Logs Tab
        <div className="space-y-4">
          {logs.length === 0 ? (
            <div className="text-center text-gray-600 py-12">
              Geen logs beschikbaar
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-600">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">
                      {getActionLabel(log.action)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Admin: {log.admin_id.substring(0, 8)}...
                      {log.target_user_id && (
                        <span className="ml-4">
                          Target: {log.target_user_id.substring(0, 8)}...
                        </span>
                      )}
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="text-xs text-gray-500 mt-2">
                        {Object.entries(log.details).map(([key, value]) => (
                          <div key={key}>
                            {key}: {JSON.stringify(value)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap ml-4">
                    {new Date(log.created_at).toLocaleDateString('nl-NL')}{' '}
                    {new Date(log.created_at).toLocaleTimeString('nl-NL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    delete_user: '🗑️ User Verwijderd',
    password_reset: '🔐 Wachtwoord Reset',
    role_change: '👤 Rol Gewijzigd',
    view_user: '👁️ User Bekeken',
  };
  return labels[action] || action;
}
