# Primansh Agency OS Mobile Chat System Design

## 1. Goal

Design a production-grade, mobile-first chat system for `Primansh Agency OS` that delivers:

- WhatsApp-level usability for one-to-one messaging and voice notes
- Telegram-like speed, media flexibility, and responsive synchronization
- strict role-based communication between `admin`, `team`, and `client`
- scalable real-time delivery built on the current `Supabase + React + Expo` stack

This design is intentionally aligned with the current repo:

- web admin already uses `src/hooks/useMessages.ts`
- mobile app already has `mobile/app/(tabs)/messages.tsx`
- backend already has messaging, presence, and push foundations in `supabase/migrations`
- push notification infrastructure already exists in `supabase/functions/send-push` and related notification migrations

---

## 2. Product Scope

### Required in V1

- one-to-one conversations
- automatic conversation creation on first message
- text, image, voice note, and file messages
- sent, delivered, and read states
- typing indicators
- online/offline presence with optional last seen
- chat list with unread counts and last message preview
- search chats and search messages
- background push notifications
- secure media access

### Explicit non-goals for this document

- group chat as a user-facing V1 feature
- live audio/video calling inside chat
- end-to-end encryption

The data model stays extensible so group chat can be added later without replacing the core storage model.

---

## 3. Recommended Architecture

## 3.1 Control plane

Use Supabase as the chat control plane:

- `Supabase Auth` for identity
- `Postgres` for source-of-truth data
- `Realtime` for low-latency fanout
- `Storage` for media files
- `Edge Functions` for push notifications, signed media access helpers, and background processing entry points

## 3.2 App layer

### Mobile

- `Expo Router` app for chat list and conversation screens
- `expo-av` for voice note recording and playback
- `react-native-gesture-handler` + `react-native-reanimated` for press-hold-slide voice UX
- `AsyncStorage` for short-term cache in V1
- recommended production add-on: `expo-sqlite` or `react-native-mmkv` for persistent chat cache and offline queue

### Web admin

- keep `src/hooks/useMessages.ts` as the current entry point
- refactor into smaller conversation, message, receipt, and presence hooks as features grow

## 3.3 Real-time split

Use two categories of real-time updates:

- `Persisted events`: messages, receipts, conversation metadata; sourced from Postgres and replicated through Realtime
- `Ephemeral events`: typing and live presence heartbeats; sent via Realtime Broadcast/Presence and not stored as permanent chat records

## 3.4 Why this fits the repo

The repo already has:

- `conversations`, `conversation_participants`, and `messages`
- presence tracking via `profiles.last_seen_at`
- notification and Expo push groundwork

The recommended path is to extend the current schema rather than replace it.

---

## 4. Conversation Model

## 4.1 Conversation type

V1 supports `direct` conversations only.

Each direct conversation has:

- exactly 2 active participants
- one canonical conversation per user pair
- automatic creation when first message is sent

## 4.2 Conversation lifecycle

1. Sender taps a user from allowed contacts.
2. Mobile app calls `get_or_create_direct_conversation(target_profile_id)`.
3. Backend validates role permissions.
4. If conversation exists, return it.
5. If not, create conversation and both participant rows atomically.
6. First message is inserted in the same request path.

## 4.3 Conversation snapshots

Store a denormalized snapshot on the conversation row for fast chat list rendering:

- `last_message_id`
- `last_message_preview`
- `last_message_type`
- `last_message_at`
- `last_sender_id`

This avoids fetching the latest message separately for every row in the chat list.

---

## 5. Role-Based Communication Rules

These rules must be enforced in backend RPCs and RLS, not only in UI.

### Admin

- can start and receive chats with all users

### Team

- can chat with admins
- can chat with assigned clients only

### Client

- can chat with admins
- can chat with assigned team members only

### Required backend checks

Before creating a conversation or inserting a message:

- resolve sender role
- resolve recipient role
- verify assignment relationship where required
- reject unauthorized combinations with a clear error code

Recommended helper:

- `can_user_message(sender_id, recipient_id) -> boolean`

This helper should be called by:

- `get_or_create_direct_conversation`
- `send_message`
- `generate_signed_media_url`

---

## 6. Data Model

The current schema is a good base, but production chat needs three important upgrades:

- delivery/read tracking should be recipient-specific
- media metadata should be normalized
- list performance should come from denormalized conversation snapshots

## 6.1 `conversations`

Keep existing table and add:

- `conversation_type text check ('direct') default 'direct'`
- `last_message_id uuid null`
- `last_message_preview text null`
- `last_message_type text null`
- `last_message_at timestamptz null`
- `last_sender_id uuid null`
- `is_archived boolean default false`
- `created_by uuid null`

Indexes:

- `(updated_at desc)`
- `(last_message_at desc)`
- partial index on `is_archived = false`

## 6.2 `conversation_participants`

Keep existing table and add:

- `participant_role text not null`
- `last_delivered_message_id uuid null`
- `last_read_message_id uuid null`
- `last_read_at timestamptz null`
- `muted_until timestamptz null`
- `is_pinned boolean default false`
- `deleted_before_message_id uuid null`

Why:

- unread count can be derived from `last_read_message_id`
- delivery and read state become cheap to update in batches
- future archive/mute/pin stays per user, not global

## 6.3 `messages`

Keep existing table and evolve it into the canonical message record:

- `id uuid primary key`
- `client_message_id text not null`
- `conversation_id uuid not null`
- `sender_id uuid not null`
- `message_type text check ('text','image','audio','file','system')`
- `text_content text null`
- `attachment_id uuid null`
- `reply_to_message_id uuid null`
- `status text check ('sending','sent','delivered','read','failed')` for sender-facing convenience
- `created_at timestamptz not null`
- `server_received_at timestamptz not null default now()`
- `edited_at timestamptz null`
- `deleted_at timestamptz null`
- `metadata jsonb not null default '{}'::jsonb`

Key notes:

- `client_message_id` must be unique per sender to prevent duplicate inserts during retries
- `text_content` replaces overloading `content` for media metadata
- `metadata` stores non-index-critical details like waveform sample count, image dimensions, duration, retry info, or preview hints

Indexes:

- `(conversation_id, created_at desc)`
- `(sender_id, client_message_id)` unique
- `(conversation_id, id desc)` for cursor pagination

## 6.4 `message_attachments`

Add a separate attachments table:

- `id uuid primary key`
- `message_id uuid unique not null`
- `storage_bucket text not null`
- `storage_path text not null`
- `preview_path text null`
- `thumbnail_path text null`
- `mime_type text not null`
- `original_file_name text null`
- `size_bytes bigint not null`
- `duration_ms integer null`
- `width integer null`
- `height integer null`
- `waveform jsonb null`
- `checksum text null`
- `processing_status text check ('pending','ready','failed')`
- `created_at timestamptz not null default now()`

Why this matters:

- secure URLs can be generated from storage paths instead of storing public URLs permanently
- image and audio specific metadata stays structured
- future thumbnail/transcoding jobs become straightforward

## 6.5 `message_receipts`

Add recipient-specific receipt rows:

- `message_id uuid not null`
- `recipient_id uuid not null`
- `delivered_at timestamptz null`
- `read_at timestamptz null`
- `delivered_device_id text null`
- `read_device_id text null`
- primary key `(message_id, recipient_id)`

Why:

- one-to-one works cleanly today
- future group chat can reuse the same model
- sender message state is derived from receipts instead of guessing from `is_read`

## 6.6 `profile_presence`

Do not store every heartbeat permanently in the main chat tables.

Recommended approach:

- use Realtime Presence for live online/offline state
- continue storing `profiles.last_seen_at` as durable fallback
- optionally add `profile_presence` only if device-level presence auditing becomes necessary

## 6.7 Search

Add message search support with Postgres full-text search:

- generated `tsvector` on `messages.text_content`
- trigram index for chat name lookup
- search within a conversation by `conversation_id + search_vector`

---

## 7. Message State Model

For WhatsApp-style ticks in one-to-one chat:

- `sent`: server accepted the message
- `delivered`: recipient device received the message and acknowledged it
- `read`: recipient opened the conversation and message is below read cursor

### UI mapping

- single gray tick = `sent`
- double gray tick = `delivered`
- double blue tick = `read`
- spinner = local pending upload or local send queue
- retry icon = failed send

### Important implementation note

Do not rely on a single `messages.status` column as the only truth. It is fine as a sender-friendly cache, but the real truth should come from `message_receipts` or participant read/delivery cursors.

---

## 8. Real-Time Event Design

## 8.1 Channel model

Per active conversation, subscribe to:

- `conversation:{conversation_id}` for message and receipt updates
- `typing:{conversation_id}` for typing indicator events
- `presence:{profile_id}` or room presence for live online status

## 8.2 Persisted events

Persisted events should originate from database writes:

- `message.created`
- `message.updated`
- `receipt.delivered`
- `receipt.read`
- `conversation.updated`

Use Realtime database replication or a server-side broadcast after write completion.

## 8.3 Ephemeral events

Ephemeral events should use Realtime Broadcast/Presence:

- `typing.started`
- `typing.stopped`
- `presence.heartbeat`
- `presence.offline`

These should never be written as normal messages.

## 8.4 Event contracts

### `message.created`

```json
{
  "event": "message.created",
  "conversation_id": "uuid",
  "message_id": "uuid",
  "client_message_id": "text",
  "sender_id": "uuid",
  "message_type": "text|image|audio|file",
  "created_at": "iso8601"
}
```

### `typing.started`

```json
{
  "event": "typing.started",
  "conversation_id": "uuid",
  "profile_id": "uuid",
  "name": "Priyansh",
  "expires_in_ms": 4000
}
```

### `receipt.read`

```json
{
  "event": "receipt.read",
  "conversation_id": "uuid",
  "message_id": "uuid",
  "recipient_id": "uuid",
  "read_at": "iso8601"
}
```

## 8.5 Typing rules

- emit `typing.started` only after user actually enters content
- debounce outbound typing updates to roughly `1.5s`
- auto-expire typing state after `4s`
- send `typing.stopped` on message send, input clear, blur, or app background

## 8.6 Presence rules

- user is `online` when app has active authenticated socket heartbeat
- write `last_seen_at` on background, disconnect, and periodic idle checkpoints
- show `Online` if heartbeat fresh within 30 to 60 seconds
- otherwise show `Last seen X ago`

---

## 9. Core Message Flows

## 9.1 Direct message creation flow

1. User selects an allowed contact.
2. Client calls `get_or_create_direct_conversation`.
3. RPC validates role permissions.
4. RPC returns existing conversation or creates a new one.
5. Client opens chat screen and starts message stream subscription.

## 9.2 Text message send flow

1. Client generates `client_message_id`.
2. Message is inserted optimistically in local list with `sending`.
3. Client calls `send_message`.
4. RPC validates sender permission and conversation membership.
5. RPC inserts message.
6. RPC inserts receipt stub for recipient.
7. RPC updates conversation snapshot fields.
8. Realtime pushes `message.created`.
9. Sender replaces optimistic item with canonical server row and shows `sent`.
10. Recipient app acknowledges delivery with `mark_messages_delivered`.
11. Sender receives `receipt.delivered`.
12. When recipient opens the thread, client calls `mark_messages_read`.
13. Sender receives `receipt.read`.

## 9.3 Image send flow

1. User taps attachment sheet and selects image.
2. Mobile app compresses image before upload.
3. Client uploads to private bucket path under message-specific folder.
4. Attachment row is created with `processing_status = pending`.
5. Optional worker or function creates preview and thumbnail.
6. Client sends message referencing `attachment_id`.
7. Chat bubble renders low-size thumbnail first and expands on tap.

## 9.4 File send flow

1. User picks file.
2. Client validates size and mime allowlist.
3. Upload starts with progress UI.
4. On success, `message_attachments` row is stored.
5. Message bubble shows filename, extension badge, and size.
6. Tap downloads via a short-lived signed URL.

## 9.5 Voice note flow

1. User press-holds mic button.
2. Recording begins immediately with haptic and animated state.
3. User slides left to cancel.
4. On release, upload starts automatically if not cancelled.
5. Client stores duration and waveform summary.
6. Message is inserted as `audio`.
7. Recipient sees inline play control, waveform, duration, and progress.

## 9.6 Delivery acknowledgment flow

1. Recipient device receives `message.created`.
2. Client stores message locally.
3. Client calls `mark_messages_delivered(conversation_id, up_to_message_id)`.
4. Server updates receipt rows and participant delivery cursor.
5. Realtime emits delivery update back to sender.

## 9.7 Read acknowledgment flow

1. Recipient opens conversation.
2. Client determines highest fully visible message.
3. Client calls `mark_messages_read(conversation_id, up_to_message_id)`.
4. Server updates receipt rows and participant read cursor.
5. Conversation unread badge is cleared.
6. Realtime emits `receipt.read`.

---

## 10. Media Handling System

## 10.1 Storage model

Use private buckets, not public chat URLs.

Recommended buckets:

- `chat-originals`
- `chat-previews`
- `chat-thumbnails`

Storage path format:

`chat/{conversation_id}/{yyyy}/{mm}/{message_id}/{variant}`

Examples:

- `chat/conv-uuid/2026/04/msg-uuid/original.jpg`
- `chat/conv-uuid/2026/04/msg-uuid/preview.webp`
- `chat/conv-uuid/2026/04/msg-uuid/waveform.json`

## 10.2 Signed access

Media access should work like this:

1. Client requests message list.
2. Message payload includes storage paths, not permanent public links.
3. Client requests short-lived signed URLs only for visible or tapped media.
4. Signed URLs expire quickly, for example in `1` to `10` minutes depending on asset type.

This is safer than the current `publicUrl` pattern used in the existing web hook.

## 10.3 Compression rules

### Images

- compress on device before upload
- target chat preview width around `1280px`
- generate thumbnail around `320px`
- preserve original only when needed for download or zoom

### Voice notes

- use compressed audio format suitable for speech
- store duration and waveform summary
- cap duration if product policy requires it

### Files

- virus scan hook if compliance requirements grow
- validate extension and mime type
- set per-role and per-type size limits

## 10.4 Upload UX

- show inline progress inside pending bubble
- support cancel during upload
- on failure, keep pending bubble with `Retry`
- reuse existing uploaded object if retry is only for message insert failure

---

## 11. Voice Note System Design

This is a first-class feature, not an attachment afterthought.

## 11.1 Recording UX

On mobile:

- press and hold to start
- subtle haptic feedback on start
- show live timer immediately
- slide left to cancel
- release to send
- optional phase-two enhancement: slide up to lock recording for long notes

## 11.2 Visual states

- idle mic button
- recording state with red accent and timer
- cancelling state with destructive cue
- uploading state with progress ring
- sent state with waveform and duration

## 11.3 Technical implementation

Recommended mobile stack:

- `expo-av` for recording and playback
- `react-native-gesture-handler` for press/drag interactions
- `react-native-reanimated` for smooth waveform and lock/cancel animations

## 11.4 Waveform strategy

Do not transmit raw waveform-heavy payloads.

Instead:

- sample amplitude on device during recording
- downsample into 30 to 60 bars
- store compact waveform array in `message_attachments.waveform`

This gives the WhatsApp-like visual feel without bloating payload size.

## 11.5 Playback UX

Each audio message bubble should support:

- play/pause
- seek bar or tappable waveform
- duration label
- playback progress
- download/stream indicator on slow networks

## 11.6 Audio caching

- cache recent voice note files locally after first playback
- evict old cache entries by size and recency
- prefer streaming for long files, local cache for short voice notes

---

## 12. Mobile UX Breakdown

## 12.1 Chat list screen

Top:

- title `Messages`
- search field
- optional filter chips: `All`, `Unread`, `Clients`, `Team`, `Admins`

Each row:

- avatar
- name
- role badge or subtitle
- last message preview
- timestamp
- unread count badge
- online dot when relevant

Empty state:

- friendly guidance plus quick actions to start allowed chats

## 12.2 Chat screen

Header:

- avatar
- user name
- presence line: `Online`, `typing...`, or `Last seen`

Message area:

- inverted high-performance list
- date separators
- grouped bubbles
- sticky scroll-to-latest button when user is not at bottom

Composer:

- text input
- emoji button
- attach button
- mic button
- send button that appears when text is non-empty

## 12.3 Message bubble behavior

### Text

- compact bubble
- support emoji, links, and long-press actions

### Image

- rounded preview
- blur or skeleton while signed URL loads
- tap to full-screen viewer

### File

- icon by extension
- filename and size
- download button

### Audio

- play button
- waveform
- duration
- sent/delivered/read ticks

## 12.4 Search UX

### Search chats

- global conversation search by name, role, and recent content preview

### Search within chat

- message search input inside conversation details or top bar action
- jump to matching message with highlighted result

---

## 13. Notifications

## 13.1 Notification types

- push notification for new message when recipient app is backgrounded
- in-app banner when user is in another screen
- silent data refresh for unread count and chat list freshness

## 13.2 Push payload rules

Push payload should include:

- `conversation_id`
- `message_id`
- sender name
- safe preview text
- `message_type`

For privacy:

- configurable preview visibility per user or organization
- do not include signed media URLs in push payloads

## 13.3 Open behavior

When notification is tapped:

1. App authenticates session if needed.
2. App navigates directly to conversation.
3. Message list loads around most recent unread messages.
4. Read receipts are sent after screen visible state is stable.

---

## 14. Performance Strategy

## 14.1 Pagination

- load initial page of `30` to `50` messages
- paginate older messages by `created_at` or `id` cursor
- never load entire conversation at once on mobile

## 14.2 Rendering

Recommended:

- use `FlashList` for mobile message rendering once chat volume grows
- memoize message rows heavily
- keep message item props flat and stable
- avoid rerendering the whole list for typing or presence changes

## 14.3 Chat list performance

- drive list from `conversations` snapshot fields
- do not join every row to full message history
- unread count should be derived cheaply from read cursor

## 14.4 Realtime efficiency

- subscribe only to active conversation channels
- use a lighter global channel for conversation snapshot updates
- debounce typing broadcasts
- batch receipt writes

## 14.5 Mobile resilience

- local optimistic queue for unsent messages
- retry with exponential backoff
- avoid refetching full conversation after every send
- prefetch signed URLs only for media in viewport

## 14.6 Database scaling

- index `messages(conversation_id, created_at desc)`
- index search fields
- keep message payload rows lean and push large metadata to attachments
- archive old conversations if enterprise retention policy is added later

---

## 15. Security Design

## 15.1 Authentication

- all chat operations require authenticated session
- all write operations go through RPCs or tightly controlled inserts

## 15.2 Authorization

Enforce at server layer:

- only participants can fetch messages
- only allowed role pairs can create chats
- only allowed participants can request signed media URLs

## 15.3 Storage security

- private buckets only
- signed URLs with short TTL
- verify conversation membership before signing

## 15.4 Abuse resistance

- idempotent message send using `client_message_id`
- payload size limits
- mime type allowlists
- message rate limits if needed for spam prevention

## 15.5 Privacy

- optional masked push previews
- configurable last-seen visibility if product requires it later

---

## 16. Edge Cases

### Network loss during send

- keep pending message locally
- show spinner and `Retry`
- do not create duplicates because `client_message_id` is unique

### Duplicate delivery from reconnect

- de-duplicate by `message.id`
- also guard by `(sender_id, client_message_id)`

### Media upload failure

- preserve draft bubble
- allow retry without losing selected media

### Recipient opens on another device

- receipts should still converge because they are server-side

### Presence flicker

- smooth offline transition with grace period instead of instant flip

### Long offline periods

- sync latest conversation snapshots first
- then hydrate conversation pages on demand

### Unauthorized user pairing

- block before conversation creation
- return a friendly product error, not a generic database failure

### Deleted or expired signed URL

- refresh signed URL on demand without reloading the whole conversation

---

## 17. API / RPC Surface

Recommended backend entry points:

- `get_or_create_direct_conversation(target_profile_id uuid) -> uuid`
- `send_message(p_conversation_id uuid, p_client_message_id text, p_message_type text, p_text_content text, p_attachment_id uuid, p_reply_to_message_id uuid) -> message row`
- `mark_messages_delivered(p_conversation_id uuid, p_up_to_message_id uuid)`
- `mark_messages_read(p_conversation_id uuid, p_up_to_message_id uuid)`
- `search_conversations(p_query text)`
- `search_messages(p_conversation_id uuid, p_query text, p_cursor text)`
- `create_signed_media_url(p_attachment_id uuid, p_variant text) -> text`
- `register_push_token(...)`

Keep the current `send_message_v2` only as a bridge until the richer RPC is in place.

---

## 18. Concrete Implementation Mapping For This Repo

### Mobile UI

Refactor `mobile/app/(tabs)/messages.tsx` into:

- chat list screen
- conversation screen
- message composer
- attachment sheet
- voice note recorder interaction layer

### Web hook

Refactor `src/hooks/useMessages.ts` to:

- use conversation snapshot fields instead of querying last message row-by-row
- stop using permanent public media URLs
- split typing, message list, receipts, and presence concerns

### Database

Add new migrations for:

- conversation snapshot columns
- receipt table
- attachment table
- idempotent send RPC
- search indexes
- signed-media helper RPC

### Push

Extend existing notification flow in:

- `supabase/functions/send-push/index.ts`

to support:

- message-type aware payloads
- direct deep links into conversations
- muted conversation handling

---

## 19. Development Roadmap

### Phase 1: Foundation hardening

- normalize message schema
- add conversation snapshot fields
- add idempotent send RPC
- add receipt model

### Phase 2: Mobile core UX

- rebuild chat list
- rebuild conversation screen
- add optimistic text sending
- add delivery and read ticks

### Phase 3: Media messaging

- image upload and preview
- secure file sending
- private signed URLs
- upload retry logic

### Phase 4: Voice notes

- press-hold-slide recording UX
- waveform rendering
- playback and caching
- duration metadata

### Phase 5: Search, presence, and polish

- chat search
- in-chat search
- richer online/offline states
- better empty, error, and reconnect states

### Phase 6: Scale and operations

- better local cache
- background sync tuning
- monitoring dashboards
- rate limit and abuse controls

---

## 20. Final Recommendation

For `Primansh Agency OS`, the strongest production path is:

- keep `Supabase` as the secure messaging control plane
- extend the existing schema instead of replacing it
- use `Realtime` for persisted message fanout and ephemeral typing/presence
- move media to private storage with short-lived signed URLs
- add recipient-specific receipts for reliable WhatsApp-style ticks
- make voice notes a first-class mobile flow with gesture-driven UX

This gives:

- reliable one-to-one agency messaging
- clean role-bound communication
- fast mobile rendering
- secure media handling
- a schema that can later expand into group chat without a rewrite
