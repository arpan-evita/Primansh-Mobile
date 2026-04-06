import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders, status: 200 });
    }

    try {
        const body = await req.json();
        const { messages, botType, clientId, userId } = body;
        const apiKey = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "GEMINI_API_KEY is missing." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Fetch Bot Config
        const { data: config } = await supabase.from('chatbot_configs').select('system_prompt, context_settings').eq('bot_type', botType).single();
        let systemPrompt = config?.system_prompt || "You are a helpful assistant.";

        // 2. Context Engine - Fetch relevant data based on botType
        let contextText = "";
        if (botType === 'website') {
            const { data: services } = await supabase.from('clients').select('firm_name, services').limit(5); // Mock services context
            contextText = `Website Services: ${JSON.stringify(services)}`;
        } else if (botType === 'admin') {
            const { data: analytics } = await supabase.from('clients').select('firm_name, health_score, monthly_revenue');
            contextText = `Agency Analytics: ${JSON.stringify(analytics)}`;
        } else if (botType === 'client' && clientId) {
            const { data: clientData } = await supabase.from('clients').select('*').eq('id', clientId).single();
            const { data: tasks } = await supabase.from('conversations').select('*').eq('client_id', clientId);
            contextText = `Your Business Data: ${JSON.stringify(clientData)}. Your Recent Activity: ${JSON.stringify(tasks)}`;
        }

        // 3. Prepare AI Request
        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const contents = messages.map((m: any) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }]
        }));

        // Inject System Prompt + Context
        const fullSystemPrompt = `${systemPrompt}\n\nCONTEXT DATA:\n${contextText}\n\nUser ID: ${userId || 'anonymous'}`;
        if (contents.length > 0 && contents[0].role === "user") {
            contents[0].parts[0].text = `${fullSystemPrompt}\n\n${contents[0].parts[0].text}`;
        } else {
            contents.unshift({ role: "user", parts: [{ text: fullSystemPrompt }] });
        }

        const genResp = await fetch(genUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 1000 } })
        });

        const genData = await genResp.json();
        const responseText = genData.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble processing that right now.";

        return new Response(JSON.stringify({ response: responseText }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }
});
