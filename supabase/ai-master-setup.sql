-- MASTER AI SETUP: RAG, SITE CONTENT, AND AUTO-SYNC
-- Run this in the Supabase SQL Editor

-- 1. Enable Vector Support
create extension if not exists vector;

-- 2. Knowledge Base (RAG)
create table if not exists documents (
  id bigserial primary key,
  content text unique,
  metadata jsonb,
  embedding vector(768) -- Correct for gemini-embedding-001
);

-- Search Function for RAG
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- 3. Dynamic Site Content (Source of Truth)
create table if not exists site_content (
  id uuid default gen_random_uuid() primary key,
  page_slug text not null,
  section_name text not null,
  content_text text not null,
  updated_at timestamp with time zone default now(),
  unique(page_slug, section_name)
);

-- 4. AI Memory (Learned Facts)
create table if not exists chat_memory (
  id uuid default gen_random_uuid() primary key,
  session_id text,
  fact text not null,
  confidence float default 1.0,
  verified boolean default false,
  created_at timestamp with time zone default now()
);

-- 5. Auto-Sync Trigger
-- This function sends a notification to our Edge Function when content changes
create or replace function handle_site_content_update()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Trigger the knowledge-sync Edge Function
  -- Note: You'll need to set the project URL in the actual trigger or use HTTP extension
  perform
    net.http_post(
      url := 'YOUR_SUPABASE_PROJECT_URL/functions/v1/knowledge-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || auth.role()
      ),
      body := jsonb_build_object(
        'type', 'site_content_update',
        'record', row_to_json(new)
      )
    );
  return new;
end;
$$;

-- Note: The 'net' extension is required for the trigger above. 
-- For now, we'll use a standard Database Webhook in the Supabase UI instead.

-- Row Level Security
alter table documents enable row level security;
alter table site_content enable row level security;
alter table chat_memory enable row level security;

-- Read access for matching (ANON)
create policy "Public read access for documents" on documents for select using (true);
create policy "Public read access for content" on site_content for select using (true);

-- Service role access for indexing
create policy "Service role full access" on documents to service_role using (true) with check (true);
create policy "Service role full access" on site_content to service_role using (true) with check (true);
create policy "Service role full access" on chat_memory to service_role using (true) with check (true);
