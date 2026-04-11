-- Master Database Migration for Production Billing & Invoice System

-- 1. SEQUENTIAL NUMBERING SYSTEM
-- ===============================

-- Create a sequence for invoice numbering
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;

-- Function to generate the next invoice number (INV-YYYY-XXXX)
CREATE OR REPLACE FUNCTION generate_next_invoice_number() 
RETURNS TEXT AS $$
DECLARE
  v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
  v_seq_val BIGINT;
BEGIN
  v_seq_val := nextval('invoice_number_seq');
  RETURN 'INV-' || v_year || '-' || lpad(v_seq_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql;


-- 2. SCHEMA ENHANCEMENTS
-- ======================

-- Add and update columns in invoices
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 18.0, -- Default 18% tax as requested
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Update status constraints
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'pending')); -- Keep 'pending' for backward compat, though logic will favor 'sent'

-- Trigger to auto-generate invoice number if missing
CREATE OR REPLACE FUNCTION trg_set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_next_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_invoice_insert_number ON invoices;
CREATE TRIGGER on_invoice_insert_number
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION trg_set_invoice_number();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_invoice_update_timestamp ON invoices;
CREATE TRIGGER on_invoice_update_timestamp
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();


-- 3. HARDENED ROLE-BASED ACCESS (RLS)
-- ===================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Drop generic policies
DROP POLICY IF EXISTS "Allow authenticated invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;

-- Admin Policy: Full Control
CREATE POLICY "Admins have full billing control" ON invoices
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Team Policy: View invoices for assigned clients
CREATE POLICY "Team can view assigned client invoices" ON invoices
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p 
    JOIN clients c ON c.assigned_to = p.id
    WHERE p.id = auth.uid() AND c.id = invoices.client_id AND p.role != 'client'
  ));

-- Client Policy: View own invoices ONLY if status is NOT 'draft'
CREATE POLICY "Clients can view their issued invoices" ON invoices
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND client_id = invoices.client_id
  ) AND status NOT IN ('draft'));


-- 4. AUTOMATED OVERDUE LOGIC
-- ==========================

CREATE OR REPLACE FUNCTION check_overdue_invoices()
RETURNS VOID AS $$
BEGIN
  UPDATE invoices
  SET status = 'overdue'
  WHERE status = 'sent' 
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;


-- 5. REAL-TIME PUBLICATION
-- ========================

-- Ensure invoices is in the realtime publication
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'invoices') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
  END IF;
END $$;
