-- Fix Team Management persistence by allowing admins to update any profile role
-- This uses a security definer function to avoid RLS recursion

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add elevated policies for profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (public.is_admin());

-- Ensure the testing user is an admin so they can actually use these permissions
-- Replace with the user's actual email from the screenshot
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'arpansadhu13@gmail.com';
