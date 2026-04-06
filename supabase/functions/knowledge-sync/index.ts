import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ""
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? ""
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { record, type } = await req.json()

    console.log(`Knowledge sync triggered for type: ${type}`)

    if (!record || !record.content_text) {
        return new Response(JSON.stringify({ message: "No content to sync" }), { headers: { "Content-Type": "application/json" } })
    }

    // 1. Generate Embedding
    const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiApiKey}`;
    const embedResp = await fetch(embedUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text: record.content_text }] },
            output_dimensionality: 768
        })
    });

    if (!embedResp.ok) {
        throw new Error(`Embedding failed: ${await embedResp.text()}`)
    }

    const { embedding } = await embedResp.json()

    // 2. Upsert to documents table
    const { error } = await supabase.from('documents').upsert({
        content: record.content_text,
        metadata: { 
            source: record.page_slug, 
            section: record.section_name,
            auto_sync: true 
        },
        embedding: embedding.values
    }, { onConflict: 'content' })

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
