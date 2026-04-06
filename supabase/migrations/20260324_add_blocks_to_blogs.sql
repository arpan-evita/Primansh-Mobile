-- Add content_blocks column to blogs table
alter table public.blogs 
add column if not exists content_blocks jsonb default '[]'::jsonb;

-- Comment on column for better documentation
comment on column public.blogs.content_blocks is 'Modular, block-based content in JSON format for Gutenberg-style editing.';
