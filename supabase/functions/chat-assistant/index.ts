import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-auth",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { messages, sessionId } = body;
        const apiKey = (Deno.env.get("GEMINI_API_KEY") ?? "AIzaSyBQrjLjtwSS13a6x0I7hzZ1bZRidb_UMoM").trim();
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Configuration Error: GEMINI_API_KEY is missing." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Use gemini-flash-latest as gemini-1.5-flash is not appearing in the list for this key
        const modelId = "gemini-flash-latest"; 

        // --- RAG STEP: Context Retrieval ---
        // 1. Retrieve Website Knowledge (RAG)
        let contextText = "";
        const userMessage = messages[messages.length - 1]?.content || "";
        try {
            const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
            const embedResp = await fetch(embedUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "models/gemini-embedding-001",
                    content: { parts: [{ text: userMessage }] },
                    output_dimensionality: 768
                })
            });
            if (embedResp.ok) {
                const embedData = await embedResp.json();
                const embedding = embedData.embedding.values;
                const { data: chunks } = await supabase.rpc('match_documents', {
                    query_embedding: embedding,
                    match_threshold: 0.5,
                    match_count: 5,
                });
                contextText = chunks?.map((c: any) => c.content).join("\n") || "";
            }
        } catch (e) {
            console.error("RAG error:", e);
        }

        // 2. Retrieve Session Memory (Learning)
        let sessionMemory = "";
        if (sessionId) {
            try {
                const { data: memory } = await supabase
                    .from('chat_memory')
                    .select('fact')
                    .eq('session_id', sessionId)
                    .limit(10);
                if (memory && memory.length > 0) {
                    sessionMemory = memory.map(m => m.fact).join("\n");
                }
            } catch (e) {
                console.error("Memory retrieval error:", e);
            }
        }

        const systemPrompt = `You are "Primansh", the hyper-intelligent AI Growth Assistant for Primansh, a CA Growth Agency.
        
        KNOWLEDGE CONTEXT (Website Data):
        ${contextText || "General agency knowledge: Primansh helps CAs build trust, automate SEO, and scale their practice."}

        SESSION MEMORY (Facts from this chat):
        ${sessionMemory || "No specific session memory yet."}

        CRITICAL INSTRUCTIONS:
        1. Answer based on the KNOWLEDGE CONTEXT and SESSION MEMORY provided.
        2. If the user corrects you or provides a new fact, confirm it and state that you've learned it.
        3. For "building a website", "SEO", "booking a call", or specific "project discussions", provide a brief response AND append "[SHOW_LEAD_FORM]". DO NOT show the form for simple requests for contact details, phone numbers, or branch locations.
        4. Mention CA-specific benefits (e.g., professionalism, ROI).
        5. Be proactive and growth-oriented.
        6. Concise responses (under 4 sentences).
        Official Contact: +91 6202490512 (Phone), chat@primansh.com (Email).
        Agency Head: +91 9332353118. `;


        const contents = messages.map((m: any) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }]
        }));

        // Add system prompt to first message
        if (contents.length > 0 && contents[0].role === "user") {
            contents[0].parts[0].text = `${systemPrompt}\n\nUser Question:\n${contents[0].parts[0].text}`;
        } else {
            contents.unshift({ role: "user", parts: [{ text: systemPrompt }] });
        }


        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        const genResp = await fetch(genUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: contents,
                generationConfig: { 
                    maxOutputTokens: 1024,
                    temperature: 0.7,
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        if (!genResp.ok) {
            const errText = await genResp.text();
            return new Response(JSON.stringify({ error: `Generation Failed: ${errText}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
        }

        const genData = await genResp.json();
        const responseText = genData.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

        // SAVE TO DB (Optional: Needs a 'chat_sessions' table)
        try {
            if (sessionId) {
                await supabase.from("chat_sessions").upsert({
                    id: sessionId,
                    messages: [...messages, { role: "assistant", content: responseText }],
                    updated_at: new Date().toISOString()
                });
            }
        } catch (e) { console.error("DB Error", e); }

        return new Response(JSON.stringify({ response: responseText, model: modelId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: `Server Error: ${error.message}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }
});
