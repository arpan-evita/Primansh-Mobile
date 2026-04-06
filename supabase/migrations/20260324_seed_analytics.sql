-- Seed data for Growth Intelligence Analytics

-- Assumes clients c1, c2, c3 exist (based on earlier migration)
-- Sharma & Associates (c1) - id can vary, so we select by name

DO $$ 
DECLARE
  sharma_id UUID;
  gupta_id UUID;
  mehta_id UUID;
  admin_id UUID;
BEGIN
  SELECT id INTO sharma_id FROM clients WHERE firm_name = 'Sharma & Associates' LIMIT 1;
  SELECT id INTO gupta_id FROM clients WHERE firm_name = 'Gupta Tax Consultants' LIMIT 1;
  SELECT id INTO mehta_id FROM clients WHERE firm_name = 'Mehta Financial Services' LIMIT 1;
  SELECT id INTO admin_id FROM profiles LIMIT 1; -- Just use first profile for assignment

  -- Tasks for Sharma & Associates (c1)
  INSERT INTO tasks (client_id, title, status, priority, module, due_date) VALUES
  (sharma_id, 'Monthly SEO Audit', 'done', 'high', 'seo', CURRENT_DATE - INTERVAL '5 days'),
  (sharma_id, 'Content Strategy Plan', 'done', 'medium', 'content', CURRENT_DATE - INTERVAL '2 days'),
  (sharma_id, 'Keyword Research', 'in_progress', 'high', 'seo', CURRENT_DATE + INTERVAL '2 days'),
  (sharma_id, 'GMB Optimization', 'todo', 'low', 'seo', CURRENT_DATE + INTERVAL '5 days');

  -- Leads for Sharma & Associates
  INSERT INTO leads (client_id, name, source, status) VALUES
  (sharma_id, 'Vikram Nair', 'google', 'new'),
  (sharma_id, 'Meena Iyer', 'website', 'contacted'),
  (sharma_id, 'Rohit Bansal', 'referral', 'converted');

  -- SEO for Sharma & Associates
  INSERT INTO keywords (client_id, keyword, target_pos, current_pos, trend) VALUES
  (sharma_id, 'CA in Delhi', 1, 3, 'up'),
  (sharma_id, 'GST Filing Delhi', 1, 5, 'up');

  -- Invoices for Sharma & Associates
  INSERT INTO invoices (client_id, amount, status, issued_date) VALUES
  (sharma_id, 25000, 'paid', CURRENT_DATE - INTERVAL '30 days'),
  (sharma_id, 25000, 'pending', CURRENT_DATE - INTERVAL '1 day');

  -- Tasks for Gupta Tax Consultants (c2)
  INSERT INTO tasks (client_id, title, status, priority, module) VALUES
  (gupta_id, 'Website Redesign', 'in_progress', 'high', 'website'),
  (gupta_id, 'ITR Filing Social Ads', 'todo', 'medium', 'content');

  -- Leads for Gupta Tax Consultants
  INSERT INTO leads (client_id, name, source, status) VALUES
  (gupta_id, 'Sunita Rao', 'social', 'new'),
  (gupta_id, 'Manish Thakur', 'google', 'lost');

  -- SEO for Gupta Tax Consultants
  INSERT INTO keywords (client_id, keyword, target_pos, current_pos) VALUES
  (gupta_id, 'CA in Mumbai', 3, 11),
  (gupta_id, 'Tax Returns Mumbai', 1, 6);

  -- Invoices for Gupta Tax Consultants
  INSERT INTO invoices (client_id, amount, status) VALUES
  (gupta_id, 18000, 'overdue');

  -- Tasks for Mehta Financial Services (c3)
  INSERT INTO tasks (client_id, title, status, priority, module) VALUES
  (mehta_id, 'Annual Audit Prep', 'done', 'high', 'general'),
  (mehta_id, 'Performance Report', 'done', 'medium', 'general');

  -- Leads for Mehta Financial Services
  INSERT INTO leads (client_id, name, source, status) VALUES
  (mehta_id, 'Pooja Shah', 'website', 'converted');

  -- SEO for Mehta Financial Services
  INSERT INTO keywords (client_id, keyword, target_pos, current_pos) VALUES
  (mehta_id, 'Audit firm Ahmedabad', 1, 1);

END $$;
