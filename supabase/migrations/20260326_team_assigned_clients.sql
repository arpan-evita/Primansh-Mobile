-- Add assigned_team_member_id to clients table
-- Run this in Supabase Dashboard -> SQL Editor

ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_team_member_id UUID REFERENCES profiles(id);

-- Allow team members to read only their assigned clients
DROP POLICY IF EXISTS "Team member read assigned clients" ON clients;
CREATE POLICY "Team member read assigned clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) != 'team'
    OR assigned_team_member_id = auth.uid()
  );
