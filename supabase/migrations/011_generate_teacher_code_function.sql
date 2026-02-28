-- Migration 011: Generate Teacher Code RPC Function
-- Creates a function to generate unique teacher codes

CREATE OR REPLACE FUNCTION public.generate_teacher_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Keep generating codes until we find a unique one
  LOOP
    -- Generate a 6-character alphanumeric code (uppercase)
    new_code := UPPER(SUBSTRING(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      (RANDOM() * 36 + 1)::INT, 1) ||
      SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      (RANDOM() * 36 + 1)::INT, 1) ||
      SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      (RANDOM() * 36 + 1)::INT, 1) ||
      SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      (RANDOM() * 36 + 1)::INT, 1) ||
      SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      (RANDOM() * 36 + 1)::INT, 1) ||
      SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      (RANDOM() * 36 + 1)::INT, 1)
    );

    -- Check if this code already exists
    SELECT EXISTS(SELECT 1 FROM studios WHERE teacher_code = new_code) INTO code_exists;

    -- If code is unique, return it
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_teacher_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_teacher_code() TO service_role;
