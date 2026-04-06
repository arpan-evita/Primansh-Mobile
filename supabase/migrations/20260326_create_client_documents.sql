-- Create client_documents table
CREATE TABLE IF NOT EXISTS client_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'credentials', 'asset', 'report', etc.
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    size BIGINT NOT NULL,
    secure BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow full access to admins" ON client_documents
    FOR ALL USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow view access to matching team members" ON client_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'seo', 'content', 'developer')
        )
    );

CREATE POLICY "Allow view access to clients for their own docs" ON client_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND client_id = client_documents.client_id
        )
    );
