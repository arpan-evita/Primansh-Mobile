-- Setup for RAG (Retrieval-Augmented Generation)
-- Run this in the Supabase SQL Editor

-- 1. Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- 2. Create the documents table
create table if not exists public.documents (
  id bigserial primary key,
  content text not null, -- The text chunk
  metadata jsonb,       -- Metadata (source file, title, etc)
  embedding vector(768) -- The embedding (768 for gemini-embedding-001)
);

-- 3. Create a function to search for documents based on similarity
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

-- 4. Enable Row Level Security (RLS)
-- For development, we might allow full access or restrict it to the service role.
alter table public.documents enable row level security;

-- Allow the service_role and authenticated users to read documents
create policy "Allow public read access"
  on public.documents for select
  using (true);

-- Allow service_role to manage documents
create policy "Allow service role management"
  on public.documents for all
  using (auth.role() = 'service_role');
