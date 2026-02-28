-- Migration 010: Handle New User Trigger
-- Creates profiles and families automatically when new Supabase Auth users are created
-- Handles parent, teacher, and child roles differently

-- ============================================================
-- 1. Function to handle new user creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  family_id_val UUID;
  display_name_val TEXT;
BEGIN
  -- Extract role from user metadata
  user_role := NEW.raw_user_meta_data->>'role';
  display_name_val := NEW.raw_user_meta_data->>'display_name';

  -- Default to 'child' if role not specified
  IF user_role IS NULL THEN
    user_role := 'child';
  END IF;

  -- Handle parent role: create family and profile
  IF user_role = 'parent' THEN
    -- Create a new family with the family name from metadata
    INSERT INTO families (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'family_name', 'Familie ' || NEW.email))
    RETURNING id INTO family_id_val;

    -- Create profile for parent in the new family
    INSERT INTO profiles (
      id,
      family_id,
      role,
      display_name,
      locale
    ) VALUES (
      NEW.id,
      family_id_val,
      user_role::user_role,
      COALESCE(display_name_val, 'Ouder'),
      COALESCE(NEW.raw_user_meta_data->>'locale', 'nl')
    );

  -- Handle teacher role: create profile WITHOUT family
  ELSIF user_role = 'teacher' THEN
    INSERT INTO profiles (
      id,
      family_id,
      role,
      display_name,
      locale
    ) VALUES (
      NEW.id,
      NULL,  -- Teachers don't belong to families
      user_role::user_role,
      COALESCE(display_name_val, 'Docent'),
      COALESCE(NEW.raw_user_meta_data->>'locale', 'nl')
    );

  -- Handle child role: will be linked to parent's family via parent API
  ELSIF user_role = 'child' THEN
    -- Child profiles are created with explicit family_id from the addChild() API
    -- This trigger doesn't handle children - they're created server-side
    -- But if a child somehow gets created here, link to parent's family
    -- Get family_id from metadata if provided
    family_id_val := (NEW.raw_user_meta_data->>'family_id')::UUID;

    IF family_id_val IS NOT NULL THEN
      INSERT INTO profiles (
        id,
        family_id,
        role,
        display_name,
        locale
      ) VALUES (
        NEW.id,
        family_id_val,
        user_role::user_role,
        COALESCE(display_name_val, 'Kind'),
        COALESCE(NEW.raw_user_meta_data->>'locale', 'nl')
      );
    END IF;
  ELSE
    -- Default: create profile with NULL family (will be filled in later)
    INSERT INTO profiles (
      id,
      family_id,
      role,
      display_name,
      locale
    ) VALUES (
      NEW.id,
      NULL,
      user_role::user_role,
      COALESCE(display_name_val, NEW.email),
      COALESCE(NEW.raw_user_meta_data->>'locale', 'nl')
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the trigger
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Trigger on auth.users table
-- ============================================================
-- Drop the trigger if it exists (in case of re-running migrations)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 3. Create initial streak when profile is created for a child
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_child_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only create initial streak for children (not parents or teachers)
  IF NEW.role = 'child'::user_role AND NEW.family_id IS NOT NULL THEN
    INSERT INTO streaks (
      child_id,
      family_id,
      current_count,
      last_practice_date
    ) VALUES (
      NEW.id,
      NEW.family_id,
      0,
      NULL
    )
    ON CONFLICT (child_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS on_new_profile_created ON profiles;

-- Create the trigger
CREATE TRIGGER on_new_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_child_profile();
