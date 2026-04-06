import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Elementor usually sends data as JSON in the Webhook Action.
    const body = await req.json()
    const url = new URL(req.url)
    const client_id = url.searchParams.get('client_id')
    const tracking_id = url.searchParams.get('tracking_id')

    if (!client_id && !tracking_id) {
      return new Response(JSON.stringify({ error: 'Missing client_id or tracking_id in URL params' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 1. Resolve client
    let resolvedClientId = client_id;
    if (tracking_id && !client_id) {
      const { data: client, error: clientError } = await supabaseClient
        .from('clients')
        .select('id')
        .eq('tracking_id', tracking_id)
        .maybeSingle()
      
      if (client) resolvedClientId = client.id;
    }

    if (!resolvedClientId) {
      return new Response(JSON.stringify({ error: 'Client not identified' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // 2. Parse fields (Support various form structures)
    const fields = body.fields || body;
    
    // Attempt to map common field names
    const getName = () => {
      const candidates = ['name', 'Name', 'full_name', 'Full Name', 'first_name', 'your-name'];
      for (const c of candidates) if (fields[c]) return fields[c];
      return 'Webhook Lead';
    }

    const getEmail = () => {
        const candidates = ['email', 'Email', 'your-email', 'e-mail'];
        for (const c of candidates) if (fields[c]) return fields[c];
        return null;
    }

    const getPhone = () => {
        const candidates = ['phone', 'Phone', 'tel', 'telephone', 'mobile', 'Your Phone'];
        for (const c of candidates) if (fields[c]) return fields[c];
        return null;
    }

    const lead = {
      client_id: resolvedClientId,
      name: getName(),
      email: getEmail(),
      phone: getPhone(),
      notes: fields.message || fields.Message || fields.comments || JSON.stringify(fields),
      source: 'website',
      status: 'new',
      payload: fields
    }

    // 3. Insert Lead
    const { error: insertError } = await supabaseClient
      .from('leads')
      .insert(lead)

    if (insertError) throw insertError

    // 4. Return success to Elementor
    return new Response(JSON.stringify({ success: true, message: 'Lead captured successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
