-- ============================================================
-- DEFINITIVE STORAGE POLICIES FOR AVATARS BUCKET
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Ensure the 'avatars' bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Clear out any existing conflicting policies to ensure a clean slate
DROP POLICY IF EXISTS "Public read from avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to manage avatars" ON storage.objects;

-- 3. Create a single, broad policy for authenticated users to manage avatars
-- This ensures admins, team members, and specialists can all upload/update/delete.
CREATE POLICY "Allow authenticated users to manage avatars"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

-- 4. Create a public read policy so avatars can be viewed via public URL
CREATE POLICY "Public read from avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
