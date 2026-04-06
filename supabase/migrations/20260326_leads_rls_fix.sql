-- ============================================================
-- Fix: leads table RLS policies so website forms work
-- Run this in: Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Make sure RLS is enabled
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 2. Add missing columns (safe to re-run)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS service TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS firm_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget TEXT;

-- 3. Allow anonymous (website visitors) to INSERT leads
DROP POLICY IF EXISTS "Public insert for leads" ON leads;
CREATE POLICY "Public insert for leads"
  ON leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 4. Allow authenticated admins/team to SELECT all leads
DROP POLICY IF EXISTS "Authenticated read for leads" ON leads;
CREATE POLICY "Authenticated read for leads"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

-- 5. Allow admin to update lead status
DROP POLICY IF EXISTS "Admin update for leads" ON leads;
CREATE POLICY "Admin update for leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'seo', 'developer')
  );

-- 6. Allow admin to delete leads
DROP POLICY IF EXISTS "Admin delete for leads" ON leads;
CREATE POLICY "Admin delete for leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
