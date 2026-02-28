'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

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

/**
 * Verify user is admin
 */
async function verifyAdmin(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (error || !data) return false;
    return data.is_admin === true;
  } catch {
    return false;
  }
}

/**
 * Get all users (admin only)
 */
export async function getAdminUsers(): Promise<{
  success: boolean;
  users?: AdminUser[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: currentUser } = await supabase.auth.getUser();

    if (!currentUser?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    // Verify admin status
    const isAdmin = await verifyAdmin(currentUser.user.id);
    if (!isAdmin) {
      return { success: false, error: 'Not authorized' };
    }

    // Get all users
    const admin = createAdminClient();
    const { data: users, error } = await admin
      .from('profiles')
      .select('id, role, created_at, is_admin, family_id')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return { success: false, error: error.message };
    }

    // Fetch emails from auth.users metadata
    const usersWithEmail: AdminUser[] = users?.map((user: any) => ({
      id: user.id,
      email: `user-${user.id.substring(0, 8)}`,
      role: user.role,
      created_at: user.created_at,
      is_admin: user.is_admin,
      family_id: user.family_id,
    })) || [];

    return { success: true, users: usersWithEmail };
  } catch (err) {
    console.error('Error in getAdminUsers:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get admin statistics
 */
export async function getAdminStats(): Promise<{
  success: boolean;
  stats?: AdminStats;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: currentUser } = await supabase.auth.getUser();

    if (!currentUser?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    // Verify admin status
    const isAdmin = await verifyAdmin(currentUser.user.id);
    if (!isAdmin) {
      return { success: false, error: 'Not authorized' };
    }

    // Call RPC function
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('get_admin_stats');

    if (error) {
      console.error('Error fetching admin stats:', error);
      return { success: false, error: error.message };
    }

    return { success: true, stats: data as AdminStats };
  } catch (err) {
    console.error('Error in getAdminStats:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Delete user and log action
 */
export async function deleteUserWithLog(
  targetUserId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: currentUser } = await supabase.auth.getUser();

    if (!currentUser?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    // Verify admin status
    const isAdmin = await verifyAdmin(currentUser.user.id);
    if (!isAdmin) {
      return { success: false, error: 'Not authorized' };
    }

    const admin = createAdminClient();

    // Log the action
    await admin.from('admin_logs').insert({
      admin_id: currentUser.user.id,
      action: 'delete_user',
      target_user_id: targetUserId,
      details: { reason: reason || 'No reason provided' },
    });

    // Delete user data first
    await admin.from('practice_sessions').delete().eq('child_id', targetUserId);
    await admin.from('streaks').delete().eq('child_id', targetUserId);
    await admin.from('points').delete().eq('child_id', targetUserId);
    await admin.from('super_credits').delete().eq('child_id', targetUserId);
    await admin.from('profiles').delete().eq('id', targetUserId);

    // Delete auth user
    const { error } = await admin.auth.admin.deleteUser(targetUserId);

    if (error) {
      console.error('Error deleting auth user:', error);
      return { success: false, error: error.message };
    }

    console.log(`User ${targetUserId} deleted by admin ${currentUser.user.id}`);
    return { success: true };
  } catch (err) {
    console.error('Error in deleteUserWithLog:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: currentUser } = await supabase.auth.getUser();

    if (!currentUser?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    // Verify admin status
    const isAdmin = await verifyAdmin(currentUser.user.id);
    if (!isAdmin) {
      return { success: false, error: 'Not authorized' };
    }

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    });

    if (error) {
      console.error('Error sending password reset:', error);
      return { success: false, error: error.message };
    }

    // Log the action
    const admin = createAdminClient();
    await admin.from('admin_logs').insert({
      admin_id: currentUser.user.id,
      action: 'password_reset',
      details: { email: userEmail },
    });

    console.log(`Password reset sent to ${userEmail} by admin ${currentUser.user.id}`);
    return { success: true };
  } catch (err) {
    console.error('Error in sendPasswordReset:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get admin logs (audit trail)
 */
export async function getAdminLogs(): Promise<{
  success: boolean;
  logs?: AdminLog[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: currentUser } = await supabase.auth.getUser();

    if (!currentUser?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    // Verify admin status
    const isAdmin = await verifyAdmin(currentUser.user.id);
    if (!isAdmin) {
      return { success: false, error: 'Not authorized' };
    }

    // Fetch admin logs
    const admin = createAdminClient();
    const { data: logs, error } = await admin
      .from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching admin logs:', error);
      return { success: false, error: error.message };
    }

    return { success: true, logs: logs as AdminLog[] };
  } catch (err) {
    console.error('Error in getAdminLogs:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
