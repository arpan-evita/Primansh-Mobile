import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = new Set(["admin", "team", "client", "seo", "content", "developer", "pending"]);

function normalizeRole(role: string) {
  const normalized = (role || "client").toLowerCase().trim().replace(/[\s_-]+/g, "");

  if (normalized.includes("admin") || normalized.includes("manager") || normalized.includes("owner")) return "admin";
  if (normalized.includes("seo")) return "seo";
  if (normalized.includes("content")) return "content";
  if (normalized.includes("dev")) return "developer";
  if (normalized.includes("team")) return "team";
  if (normalized.includes("pending")) return "pending";
  return "client";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Admin client with service role key - can do anything
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, password, full_name, role, associated_client_id } = await req.json();
    const normalizedRole = normalizeRole(role);

    // 1. Basic Validation
    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields (email, password, role)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ALLOWED_ROLES.has(normalizedRole)) {
      return new Response(
        JSON.stringify({ error: "Invalid role supplied" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (associated_client_id && normalizedRole !== "client") {
      return new Response(
        JSON.stringify({ error: "Only client users can be linked to a client record" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Security Check: Verify the requester is an authenticated Admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use caller's token to verify their identity
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the requester has the 'admin' role in the profiles table
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || normalizeRole(callerProfile?.role || "") !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (associated_client_id) {
      const { data: clientRecord, error: clientError } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("id", associated_client_id)
        .single();

      if (clientError || !clientRecord) {
        return new Response(
          JSON.stringify({ error: "Associated client not found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Create the new user via the Admin API (bypasses email confirmation)
    const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Mark email as confirmed immediately
      user_metadata: { full_name, role: normalizedRole },
    });

    if (createError) {
      console.error("[create-user] Creation failed:", createError.message);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = newUserData.user.id;
    console.log(`[create-user] Created user: ${email} (${newUserId}) with role: ${normalizedRole}`);

    // 4. If a client ID is provided, link the new profile to that client firm
    if (associated_client_id) {
      const { error: linkError } = await supabaseAdmin
        .from("profiles")
        .update({ associated_client_id })
        .eq("id", newUserId);

      if (linkError) {
        // Non-fatal: user was created, just the link failed
        console.warn("[create-user] Failed to link profile to client:", linkError.message);
      } else {
        console.log(`[create-user] Linked user ${newUserId} to client ${associated_client_id}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUserId,
          email: newUserData.user.email,
          role: normalizedRole,
          associated_client_id: associated_client_id ?? null,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[create-user] Unhandled error:", err.message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
