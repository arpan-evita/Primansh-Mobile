-- Add associated_client_id to profiles table to link client users to their firm
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS associated_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.associated_client_id IS 'Link to the clients table for users with the client role';
