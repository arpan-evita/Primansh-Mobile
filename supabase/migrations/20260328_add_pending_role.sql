-- Drop the existing profiles_role_check constraint and add the new 'pending' role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'team', 'client', 'seo', 'content', 'developer', 'pending'));

-- Update the handle_new_user trigger to default to 'pending' if no role is provided
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'pending'),
    new.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error or handle gracefully so signup doesn't fail with 500
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
