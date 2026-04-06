-- Fix tasks schema to support name-based assignment for agency operations
-- This allows the agency to use member names directly without needing a full-scale profile UUID registry.

ALTER TABLE tasks DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE tasks ADD COLUMN assigned_to TEXT;

-- Seed some operational tasks if the table is empty
INSERT INTO tasks (client_id, title, status, priority, module, assigned_to)
SELECT 
  id as client_id,
  'Initial SEO Audit' as title,
  'todo' as status,
  'high' as priority,
  'seo' as module,
  'Arjun Mehta' as assigned_to
FROM clients
LIMIT 1
ON CONFLICT DO NOTHING;
