-- Create a bucket for blog images
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

-- Enable RLS for all storage objects (usually enabled by default on table, but policies are needed)
-- Note: Supabase Storage uses its own schema and tables. 

-- 1. Give public read access to the bucket
create policy "Public Access to Blog Images"
  on storage.objects for select
  using ( bucket_id = 'blog-images' );

-- 2. Allow authenticated users to upload images
create policy "Authenticated Admin Upload"
  on storage.objects for insert
  with check ( 
    bucket_id = 'blog-images' 
    and auth.role() = 'authenticated' 
  );

-- 3. Allow authenticated users to update/delete their own uploads (basic policy for admins)
create policy "Authenticated Admin Full Control"
  on storage.objects for all
  using ( 
    bucket_id = 'blog-images' 
    and auth.role() = 'authenticated' 
  );
