import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req: Request) => {
  try {
    const { profile_ids, title, body, data } = await req.json();

    if (!profile_ids || !Array.isArray(profile_ids)) {
      return new Response(JSON.stringify({ error: "profile_ids array is required" }), { status: 400 });
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch push tokens for all users in the array
    const { data: tokens, error: tokenError } = await supabaseClient
      .from("expo_push_tokens")
      .select("token, profile_id")
      .in("profile_id", profile_ids);

    if (tokenError || !tokens || tokens.length === 0) {
      console.log(`No tokens found for profile_ids: ${profile_ids.join(", ")}`);
      return new Response(JSON.stringify({ success: true, message: "No tokens found" }), { status: 200 });
    }

    const messages = tokens.map((t: { token: string, profile_id: string }) => ({
      to: t.token,
      sound: "default",
      title,
      body,
      data: { ...data, target_profile_id: t.profile_id } || {},
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log("Expo response:", result);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error sending push notification:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
