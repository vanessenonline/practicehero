-- Migration 012: Admin Panel Schema and Audit Logging
-- Adds admin role support and audit logging for admin actions

-- Add is_admin column to profiles table
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;

-- Create admin_logs table for audit trail
CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'delete_user', 'password_reset', 'role_change', 'view_user'
  target_user_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);

-- Enable RLS on admin_logs
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view admin_logs
CREATE POLICY "Admins can view admin_logs"
  ON admin_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- RLS Policy: Only service_role can insert admin_logs
CREATE POLICY "Service role can insert admin_logs"
  ON admin_logs
  FOR INSERT
  WITH CHECK (true);

-- Create RPC function to get admin statistics
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_users', COUNT(*)::INT,
    'parents', COUNT(*) FILTER (WHERE role = 'parent')::INT,
    'children', COUNT(*) FILTER (WHERE role = 'child')::INT,
    'teachers', COUNT(*) FILTER (WHERE role = 'teacher')::INT,
    'total_families', (SELECT COUNT(DISTINCT family_id) FROM profiles WHERE family_id IS NOT NULL)::INT,
    'registrations_today', (SELECT COUNT(*) FROM profiles WHERE DATE(created_at) = CURRENT_DATE)::INT
  ) INTO v_result
  FROM profiles;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_admin_stats() TO authenticated, service_role;

-- Create RPC function to get admin stats with time grouping
CREATE OR REPLACE FUNCTION get_admin_stats_timeline()
RETURNS TABLE(date DATE, count INT, role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at),
    COUNT(*)::INT,
    role::TEXT
  FROM profiles
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY DATE(created_at), role
  ORDER BY DATE(created_at) DESC, role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_admin_stats_timeline() TO authenticated, service_role;
