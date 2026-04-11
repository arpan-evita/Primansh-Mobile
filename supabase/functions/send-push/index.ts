import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_EXPO_BATCH_SIZE = 100;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type PushPayload = {
  profile_ids?: string[];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: string | null;
};

function isExpoPushToken(token: string) {
  return /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token);
}

function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { profile_ids, title, body, data, sound }: PushPayload = await req.json();
    const uniqueProfileIds = Array.from(new Set((profile_ids || []).filter(Boolean)));

    if (uniqueProfileIds.length === 0) {
      return new Response(JSON.stringify({ error: "profile_ids array is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!title?.trim() || !body?.trim()) {
      return new Response(JSON.stringify({ error: "title and body are required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: tokenRows, error: tokenError } = await supabaseClient
      .from("expo_push_tokens")
      .select("id, token, profile_id")
      .in("profile_id", uniqueProfileIds);

    if (tokenError) throw tokenError;

    const dedupedRows = Array.from(
      new Map(
        (tokenRows || [])
          .filter((row) => row.token && isExpoPushToken(row.token))
          .map((row) => [row.token, row])
      ).values()
    );

    if (dedupedRows.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          delivered_batches: 0,
          delivered_messages: 0,
          invalid_tokens: 0,
          message: "No valid Expo push tokens found",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const batches = chunk(
      dedupedRows.map((row) => ({
        to: row.token,
        sound: sound ?? "default",
        title: title.trim(),
        body: body.trim(),
        data: { ...(data || {}), target_profile_id: row.profile_id },
      })),
      MAX_EXPO_BATCH_SIZE
    );

    const invalidTokens = new Set<string>();
    const expoResponses: unknown[] = [];

    for (const messageBatch of batches) {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(messageBatch),
      });

      const result = await response.json();
      expoResponses.push(result);

      if (!response.ok) {
        throw new Error(result?.errors?.[0]?.message || "Expo push dispatch failed");
      }

      const tickets = Array.isArray(result?.data) ? result.data : [];
      tickets.forEach((ticket: any, index: number) => {
        const targetToken = messageBatch[index]?.to;
        if (
          ticket?.status === "error" &&
          ticket?.details?.error === "DeviceNotRegistered" &&
          targetToken
        ) {
          invalidTokens.add(targetToken);
        }
      });
    }

    if (invalidTokens.size > 0) {
      await supabaseClient.from("expo_push_tokens").delete().in("token", Array.from(invalidTokens));
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivered_batches: batches.length,
        delivered_messages: dedupedRows.length,
        invalid_tokens: invalidTokens.size,
        expo: expoResponses,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error: any) {
    console.error("[send-push] Error sending push notification:", error);
    return new Response(JSON.stringify({ error: error.message || "Push dispatch failed" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
