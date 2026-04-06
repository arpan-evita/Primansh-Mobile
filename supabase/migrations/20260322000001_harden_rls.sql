-- Hardening case_studies table security
-- We want to allow public read access, but only authenticated users can modify data.

-- First, drop the permissive policy created in the first migration
DROP POLICY IF EXISTS "Allow all access for now" ON case_studies;

-- Create secure policies for Authenticated Users (Admins)
CREATE POLICY "Enable insert for authenticated users only" ON case_studies
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON case_studies
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON case_studies
  FOR DELETE USING (auth.role() = 'authenticated');

-- Ensure public read access remains
-- Existing "Allow public read access" policy is sufficient (true for all).
