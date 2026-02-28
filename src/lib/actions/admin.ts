'use server';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Delete a user from Supabase Auth
 * WARNING: This is a destructive operation that cannot be undone
 */
export async function deleteAuthUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    // Delete the user from auth.users
    const { error } = await admin.auth.admin.deleteUser(userId);

    if (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: error.message };
    }

    console.log(`User ${userId} deleted successfully`);
    return { success: true };
  } catch (err) {
    console.error('Error in deleteAuthUser:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Onbekende fout',
    };
  }
}

/**
 * Delete all test data for a user
 */
export async function deleteUserData(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    // Delete from multiple tables to ensure referential integrity
    // Start with child tables first (foreign key dependencies)

    // Delete practice sessions
    await admin.from('practice_sessions').delete().eq('child_id', userId);

    // Delete streaks
    await admin.from('streaks').delete().eq('child_id', userId);

    // Delete points
    await admin.from('points').delete().eq('child_id', userId);

    // Delete super credits
    await admin.from('super_credits').delete().eq('child_id', userId);

    // Delete profile
    const { error: profileError } = await admin.from('profiles').delete().eq('id', userId);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
      return { success: false, error: profileError.message };
    }

    console.log(`All data for user ${userId} deleted successfully`);
    return { success: true };
  } catch (err) {
    console.error('Error in deleteUserData:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Onbekende fout',
    };
  }
}
