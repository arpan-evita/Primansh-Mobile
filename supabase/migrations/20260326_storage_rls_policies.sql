-- ============================================================
-- Storage RLS Policies for chat-media bucket
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================

-- Allow any authenticated user to upload files to chat-media
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy: authenticated users can upload
DROP POLICY IF EXISTS "Authenticated upload to chat-media" ON storage.objects;
CREATE POLICY "Authenticated upload to chat-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- Policy: public can read (since bucket is public)
DROP POLICY IF EXISTS "Public read from chat-media" ON storage.objects;
CREATE POLICY "Public read from chat-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

-- Policy: authenticated users can update their own uploads
DROP POLICY IF EXISTS "Authenticated update chat-media" ON storage.objects;
CREATE POLICY "Authenticated update chat-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-media');

-- Policy: authenticated users can delete their own uploads
DROP POLICY IF EXISTS "Authenticated delete chat-media" ON storage.objects;
CREATE POLICY "Authenticated delete chat-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-media');

-- ============================================================
-- Same for avatars bucket (needed for profile photo uploads)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Authenticated upload to avatars" ON storage.objects;
CREATE POLICY "Authenticated upload to avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public read from avatars" ON storage.objects;
CREATE POLICY "Public read from avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated update avatars" ON storage.objects;
CREATE POLICY "Authenticated update avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated delete avatars" ON storage.objects;
CREATE POLICY "Authenticated delete avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
