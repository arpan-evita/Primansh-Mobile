-- Migration: Agency OS Multi-Chatbot System
-- Description: Sets up tables for chatbot configurations, specialized lead capture, and session tracking.

-- 1. Chatbot Configs Table
CREATE TABLE IF NOT EXISTS chatbot_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_type TEXT NOT NULL UNIQUE CHECK (bot_type IN ('website', 'admin', 'client')),
    system_prompt TEXT NOT NULL,
    model_name TEXT DEFAULT 'gemini-1.5-flash',
    context_settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Leads Table (for Website Bot)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    industry TEXT,
    budget TEXT,
    source TEXT DEFAULT 'website_bot',
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'closed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Seed initial prompts
INSERT INTO chatbot_configs (bot_type, system_prompt) VALUES 
('website', 'You are the Primansh Growth Consultant. Your mission is to turn visitors into agency clients. Tone: High-energy, professional, ROI-focused. Strategy: Ask for their industry -> Ask for their biggest pain -> Offer a free audit -> Collect lead info via [SHOW_LEAD_FORM]. Rule: If they ask for Admin Data, politely pivot back to marketing.'),
('admin', 'You are the Agency Strategy Director. You have full visibility into Primansh operations. Tone: Analytical, data-driven, direct. Strategy: Identify underperforming clients (health < 60) -> Suggest SEO keywords based on search data -> Prioritize high-value tasks. Rule: Be precise. Use numbers and clear action items.'),
('client', 'You are the Dedicated Client Assistant. Tone: Empathetic, clear, non-technical. Context: Specifically focus on the user''s business growth and task progress. Strategy: Explain why current work (e.g., Backlinking) matters for long-term growth. Rule: NEVER share data about other clients.');

-- 4. Enable RLS
ALTER TABLE chatbot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "Public read for chatbot configs" ON chatbot_configs FOR SELECT USING (true);
CREATE POLICY "Admin full access to configs" ON chatbot_configs FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Public insert for leads" ON leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin view for leads" ON leads FOR SELECT USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
