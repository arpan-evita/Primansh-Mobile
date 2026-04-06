-- Drop the old broad view policy
DROP POLICY IF EXISTS "Allow view access to matching team members" ON client_documents;

-- Create a new restrictive policy for team members and other staff
CREATE POLICY "Team members can view assigned client documents" ON client_documents
FOR SELECT TO authenticated
USING (
    -- Admin has full access (already covered by another policy usually, but let's be explicit)
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    -- Or they are assigned to the client
    OR EXISTS (
        SELECT 1 FROM clients
        WHERE id = client_documents.client_id
        AND assigned_team_member_id = auth.uid()
    )
    -- Or they are the client themselves (already covered by another policy, but let's be safe)
    OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'client'
        AND client_id = client_documents.client_id
    )
);

-- Ensure team members cannot delete or upload unless they are admins
-- (This is already the case as there's only an ALL policy for admins)
