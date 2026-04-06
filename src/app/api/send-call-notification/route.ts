import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with Service Role Key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Configure VAPID details
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:seo.primansh@gmail.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { meeting_id, caller_id, caller_name, is_audio_only, conversation_id } = body;

    if (!meeting_id || !conversation_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    // 1. Get all conversation participants (excluding the caller)
    const { data: participants, error: partError } = await supabase
      .from('conversation_participants')
      .select('profile_id')
      .eq('conversation_id', conversation_id)
      .neq('profile_id', caller_id);

    if (partError || !participants?.length) {
      return new Response(JSON.stringify({ sent: 0, note: 'No participants to notify' }), { status: 200 });
    }

    const participantIds = participants.map((p: any) => p.profile_id);
    console.log('[Push] Target participants:', participantIds);

    // 2. Fetch push subscriptions for all participants
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('profile_id', participantIds);

    if (subError || !subscriptions?.length) {
      console.warn('[Push] No subscriptions found for participants:', participantIds);
      return new Response(JSON.stringify({ sent: 0, note: 'No push subscriptions found' }), { status: 200 });
    }

    console.log('[Push] Found subscriptions count:', subscriptions.length);

    // 3. Build the notification payload
    const payload = JSON.stringify({
      title: `📞 Incoming ${is_audio_only ? 'Voice' : 'Video'} Call`,
      body: `${caller_name} is calling you`,
      meetingId: meeting_id,
      isAudioOnly: is_audio_only,
      callerName: caller_name,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    });

    // 4. Send push to all subscribers in parallel
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          console.log('[Push] Success for:', sub.profile_id);
          return { success: true, profile_id: sub.profile_id };
        } catch (err: any) {
          console.error('[Push] Delivery failed for:', sub.profile_id, err.message);
          // If subscription is expired/invalid (410 Gone), remove it from DB
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint);
          }
          return { success: false, profile_id: sub.profile_id, error: err.message };
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
    console.log('[Push] Final result: sent', sent, 'of', subscriptions.length);
    
    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[send-call-notification] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
