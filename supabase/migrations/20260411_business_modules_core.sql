-- Database Enhancement for Business Modules (Leads, SEO, Testimonials, Case Studies)

-- 1. LEADS SYSTEM ENHANCEMENTS
-- ============================

-- Add new columns to leads
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS linked_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS budget TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Update status constraints for Leads
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check 
  CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost'));

-- Function to convert Lead to Client
CREATE OR REPLACE FUNCTION public.convert_lead_to_client(lead_id UUID, admin_id UUID)
RETURNS UUID AS $$
DECLARE
  v_lead leads%ROWTYPE;
  v_client_id UUID;
  v_slug TEXT;
BEGIN
  -- 1. Get lead data
  SELECT * INTO v_lead FROM leads WHERE id = lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF v_lead.status = 'converted' THEN RAISE EXCEPTION 'Lead already converted'; END IF;

  -- 2. Generate slug
  v_slug := lower(regexp_replace(v_lead.name, '[^a-zA-Z0-9]+', '-', 'g'));

  -- 3. Create client record
  INSERT INTO clients (
    firm_name,
    location,
    contact_name,
    contact_email,
    contact_phone,
    assigned_to,
    status,
    plan_type,
    slug
  ) VALUES (
    COALESCE(v_lead.industry, v_lead.name || ' Practice'),
    'Online',
    v_lead.name,
    COALESCE(v_lead.email, 'contact@' || v_slug || '.com'),
    v_lead.phone,
    COALESCE(v_lead.assigned_to, admin_id),
    'trial',
    'basic',
    v_slug || '-' || floor(random()*1000)::text
  ) RETURNING id INTO v_client_id;

  -- 4. Update lead status
  UPDATE leads 
  SET 
    status = 'converted',
    linked_client_id = v_client_id,
    updated_at = now()
  WHERE id = lead_id;

  RETURN v_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. SEO PANEL ENHANCEMENTS
-- =========================

-- Add metrics to keywords
ALTER TABLE keywords 
  ADD COLUMN IF NOT EXISTS traffic_estimate INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS page_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volume TEXT DEFAULT 'low';

-- Create Ranking History Table
CREATE TABLE IF NOT EXISTS public.keyword_rankings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger to automatically log ranking changes
CREATE OR REPLACE FUNCTION public.log_keyword_rank_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.current_pos IS DISTINCT FROM NEW.current_pos) THEN
    INSERT INTO keyword_rankings_history (keyword_id, position)
    VALUES (NEW.id, NEW.current_pos);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_keyword_rank_update
  AFTER INSERT OR UPDATE ON keywords
  FOR EACH ROW EXECUTE FUNCTION public.log_keyword_rank_change();


-- 3. TESTIMONIALS SYSTEM ENHANCEMENTS
-- ===================================

-- Add fields for production-ready testimonials
ALTER TABLE testimonials 
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved'));

-- Unified access for admin, read-only for public if approved
DROP POLICY IF EXISTS "Allow public read access" ON testimonials;
CREATE POLICY "Allow public read access if approved" ON testimonials
  FOR SELECT USING (status = 'approved' OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'team')
  ));


-- 4. CASE STUDIES SYSTEM ENHANCEMENTS
-- ===================================

-- Refine case studies for professional display
ALTER TABLE case_studies 
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

-- Ensure RLS allows public view of published cases
DROP POLICY IF EXISTS "Allow public read access" ON case_studies;
CREATE POLICY "Allow public read access if published" ON case_studies
  FOR SELECT USING (is_published = true OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'team')
  ));


-- 5. REAL-TIME SYNCHRONIZATION
-- ============================

-- Add new tables to replication
DO $$ 
BEGIN
  -- keyword_rankings_history
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'keyword_rankings_history') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE keyword_rankings_history;
  END IF;

  -- leads
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'leads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
  END IF;

  -- keywords
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'keywords') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE keywords;
  END IF;

  -- testimonials
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'testimonials') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE testimonials;
  END IF;

  -- case_studies
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'case_studies') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE case_studies;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error during publication update: %', SQLERRM;
END $$;
