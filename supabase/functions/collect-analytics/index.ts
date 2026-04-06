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

    const body = await req.json()
    const { tracking_id, event, path, title, referrer, cid, dt, br, ua } = body

    if (!tracking_id) {
      return new Response(JSON.stringify({ error: 'Missing tracking_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 1. Find client ID
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('id')
      .eq('tracking_id', tracking_id)
      .maybeSingle()

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: 'Invalid tracking_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // 2. Insert record
    const { error: insertError } = await supabaseClient
      .from('site_analytics')
      .insert({
        client_id: client.id,
        event_type: event || 'pageview',
        page_path: path,
        page_title: title,
        referrer: referrer,
        session_id: cid,
        device_type: dt,
        browser: br,
        user_agent: ua,
      })

    if (insertError) throw insertError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
