import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { invoiceId, clientEmail, invoiceNumber, amount, clientName, clientSlug } = await req.json();

    console.log(`[SendInvoice] Processing: ${invoiceNumber} for ${clientName} (${clientEmail})`);

    const publicUrl = Deno.env.get("PUBLIC_URL") || "https://primansh.com";
    const invoiceUrl = `${publicUrl}/clientportal/${clientSlug}/invoice/${invoiceId}`;

    // 1. Generate Email Content (HTML) - Premium Branded Template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; margin: 0; padding: 0; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; background-color: #f6f9fc; }
          .container { width: 100%; max-width: 580px; margin: 0 auto; padding: 20px; }
          .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
          .header { background: #0f172a; padding: 40px 30px; text-align: center; }
          .content { padding: 40px 30px; }
          .logo { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; margin: 0; }
          .logo-sub { font-size: 10px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }
          .h1 { font-size: 20px; font-weight: 700; color: #1e293b; margin-top: 0; margin-bottom: 24px; }
          .p { color: #475569; margin: 0 0 20px 0; }
          .billing-info { background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
          .label { color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
          .value { color: #0f172a; font-size: 18px; font-weight: 800; }
          .btn-container { text-align: center; margin-top: 30px; }
          .btn { background-color: #3b82f6; border-radius: 10px; color: #ffffff; display: inline-block; font-size: 14px; font-weight: 700; line-height: 1; padding: 16px 32px; text-decoration: none; text-transform: none; }
          .footer { padding-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h1 class="logo">PRIMANSH</h1>
              <div class="logo-sub">Digital Growth Partner</div>
            </div>
            <div class="content">
              <h1 class="h1">New Invoice Issued</h1>
              <p class="p">Hi ${clientName},</p>
              <p class="p">A new digital invoice has been generated for your recent services. You can find the summary below and access the full breakdown in your portal.</p>
              
              <div class="billing-info">
                <div style="margin-bottom: 20px;">
                  <div class="label">Invoice Number</div>
                  <div class="value">${invoiceNumber || invoiceId.substring(0,8)}</div>
                </div>
                <div>
                  <div class="label">Amount Due</div>
                  <div class="value" style="color: #2563eb;">INR ${amount.toLocaleString()}</div>
                </div>
              </div>

              <div class="btn-container">
                <a href="${invoiceUrl}" class="btn">View Full Invoice Details</a>
              </div>
            </div>
          </div>
          <div class="footer">
            <p>Primansh Digital Solutions · India (Remote-First Agency)</p>
            <p>Official Support: chat@primansh.com | +91 6202490512</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // 2. DISPATCH VIA RESEND
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.warn("[SendInvoice] RESEND_API_KEY not set. Simulation mode active.");
      console.log("--- SIMULATED EMAIL DISPATCH ---");
      console.log(`To: ${clientEmail}`);
      console.log(`Subject: Invoice ${invoiceNumber}`);
    } else {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Primansh Billing <onboarding@resend.dev>",
          to: [clientEmail],
          subject: `Invoice ${invoiceNumber} from Primansh`,
          html: emailHtml,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        console.error("[SendInvoice] Resend API Error:", resData);
        throw new Error(resData.message || "Failed to dispatch email via Resend.");
      }
      console.log("[SendInvoice] Dispatch Successful:", resData.id);
    }

    // 3. Update 'sent_at' in Database
    const { error: updateError } = await supabaseClient
      .from("invoices")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", invoiceId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, message: "Invoice dispatched successfully." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
