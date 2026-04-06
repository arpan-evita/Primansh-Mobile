-- Add missing columns to leads table for website forms
ALTER TABLE leads ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS service TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS firm_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;

-- Allow public unauthenticated insert (website visitors not logged in)
DROP POLICY IF EXISTS "Public insert for leads" ON leads;
CREATE POLICY "Public insert for leads" ON leads FOR INSERT WITH CHECK (true);

-- Allow admin to delete leads
DROP POLICY IF EXISTS "Admin delete for leads" ON leads;
CREATE POLICY "Admin delete for leads" ON leads FOR DELETE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Allow admin to update leads (status changes)
DROP POLICY IF EXISTS "Admin update for leads" ON leads;
CREATE POLICY "Admin update for leads" ON leads FOR UPDATE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
