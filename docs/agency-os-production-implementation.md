# Primansh Agency OS Production Implementation Contract

This document is the build contract for turning the current web, mobile, and Supabase stack into a production-ready Agency OS without redesigning the product surface.

## Shared Runtime Contract

### Identity and roles

- Authentication source: `supabase.auth.getSession()`.
- Authorization source: `public.profiles`.
- Canonical role normalization on backend: `public.normalize_agency_role(role)`.
- Canonical role normalization on mobile/web helpers: `normalizeRole(...)`.
- Effective rules used everywhere:
  - `admin`: full read/write.
  - `team`, `seo`, `content`, `developer`: only assigned clients, assigned tasks, and conversations/calls allowed by shared client scope.
  - `client`: only rows linked to `profiles.associated_client_id`.
  - `pending`: no operational write access.

### API execution contract

Every action in every module follows the same order:

1. Request flow: UI issues Supabase table mutation, RPC, or Edge Function call.
2. Validation: role checks, ownership checks, schema validation, duplicate checks, status transition checks.
3. Processing: database write, storage write, trigger execution, notification fan-out, realtime publication.
4. Response: return row id or updated row; on conflict return canonical existing row when possible.
5. UI update: optimistic state first when safe, then replace with canonical server row, then invalidate/refetch scoped caches.

### Shared realtime contract

- Durable state: Supabase Postgres Changes on published tables.
- Ephemeral state: Realtime Broadcast for zero-latency events.
- Presence: Realtime Presence for typing and live meeting participant state.
- Conflict rule: server row is authoritative; client optimistic state is replaced by the first matching server row.

### Shared sync contract

- Web uses React Query invalidation plus realtime refetch.
- Mobile uses local state plus owner-scoped `AsyncStorage` caches for clients/tasks and refetch on reconnect/app foreground.
- Stale data rule: if payload is incomplete, refetch full row before rendering final UI.

---

## 1. Client System

### 1. Step-by-step execution flow

1. Web fetches client list with `supabase.from('clients').select(...)`; mobile fetches paged lists/detail snapshots from `useMobileClients`.
2. Admin creates a client with `supabase.from('clients').upsert(...)`.
3. If portal access is required, admin immediately invokes `supabase.functions.invoke('create-user')` with `role: 'client'` and the new `associated_client_id`.
4. Assignment changes update `clients.assigned_team_member_id`; mobile multi-assignment also upserts/deletes `team_assigned_clients`.
5. Client detail views pull related tasks, leads, keywords, invoices, analytics, conversations, and recent messages using the client id.
6. Deletes are hard deletes on `clients`; dependent access disappears through RLS.

### 2. API interaction logic

- Fetch list: `from('clients').select(...)`.
- Fetch detail: `from('clients').select(...).eq('id', clientId).single()`.
- Create/update: `from('clients').insert(...)` or `upsert(...)`.
- Delete: `from('clients').delete().eq('id', clientId)`.
- Create portal user: `functions.invoke('create-user')`.
- Primary assignment: `from('clients').update({ assigned_team_member_id })`.
- Secondary assignments: `from('team_assigned_clients').upsert(...)` and `delete()`.

### 3. Role validation logic

- Read access is enforced by `public.can_access_client(client_id)`.
- Write access is enforced by `public.can_manage_client_data(client_id)` and `public.enforce_client_write_permissions()`.
- Admin:
  - create, read, update, delete all clients.
  - create linked client users.
  - assign/unassign any staff.
- Team/staff:
  - read only clients where they are primary owner or appear in `team_assigned_clients`.
  - update only `status` and `notes`.
  - cannot create or delete clients.
- Client:
  - read only own client row through `associated_client_id`.
  - no direct client updates.

### 4. Real-time event triggers

- Web: `web-clients-sync:${profile.id}` on `clients`, `team_assigned_clients`, `tasks`, `profiles`.
- Mobile: `mobile-clients:${profile.id}` on `clients` and `team_assigned_clients`.
- Trigger behavior:
  - `clients` insert/update/delete: refetch client list/detail.
  - `team_assigned_clients` change: recalculate visible clients for staff and allowed recipients for chat/meetings.
  - `tasks` change: refresh client health/metrics summaries.

### 5. Edge cases and handling

- Duplicate client: blocked by `prevent_duplicate_client_records()` using normalized firm name and contact email.
- Assignment conflict: last confirmed server write wins; UI must refetch assignments after every `clients` or `team_assigned_clients` event.
- Unauthorized access: denied by `can_access_client` and client RLS; UI shows permission error and keeps cached read-only state.
- Client user creation fails after client row insert: keep client row, surface account provisioning error, allow retry from client detail/team page.

### 6. Mobile + web sync behavior

- Source of truth is `clients` plus `team_assigned_clients`.
- Mobile caches per authenticated user with owner-scoped keys.
- Web invalidates `['admin_clients']` and related query keys on realtime or mutation success.
- Mobile detail snapshots are rebuilt after any client assignment or client row change.

---

## 2. Task System

### 1. Step-by-step execution flow

1. UI fetches tasks from `tasks` ordered by `updated_at`.
2. Create uses `from('tasks').insert(...)` with `client_id`, `assigned_to_user_id`, `priority`, `status`, `due_date`, and `module`.
3. `sync_task_metadata()` normalizes `assigned_to`, `assigned_to_user_id`, `created_by`, and `updated_at`.
4. Comments are inserted into `task_comments`; attachments upload to storage bucket `task-attachments` then insert into `task_attachments`.
5. Status changes are applied with `from('tasks').update({ status })`.
6. Completion changes stamp `started_at` and `completed_at` through `enforce_task_transition_rules()`.

### 2. API interaction logic

- Fetch tasks: `from('tasks').select(...)`.
- Create task: `from('tasks').insert(...)`.
- Update task: `from('tasks').update(...).eq('id', taskId)`.
- Delete task: `from('tasks').delete().eq('id', taskId)`.
- Fetch comments: `from('task_comments').select(...).eq('task_id', taskId)`.
- Add comment: `from('task_comments').insert({ task_id, body, created_by })`.
- Upload attachment: `storage.from('task-attachments').upload(...)` then `from('task_attachments').insert(...)`.
- Download attachment: signed URL from `task-attachments`.

### 3. Role validation logic

- Read access: `public.can_access_task(task_id)`.
- Create access: `public.can_create_task_for_client(client_id)`.
- Comment access: `public.can_comment_on_task(task_id)`.
- Attachment access: `public.can_attach_to_task(task_id)`.
- Admin:
  - full CRUD on tasks, comments, attachments.
- Team/staff:
  - read assigned tasks only.
  - create task only for a client they own and only assigned to themselves.
  - update only `status`.
  - comment/attach only on accessible tasks.
- Client:
  - can create request tasks only for own client.
  - cannot self-assign.
  - cannot edit task fields after create.
  - can comment/attach only on accessible tasks if RLS permits through `can_access_task`.

### 4. Real-time event triggers

- Web: `web-task-sync` on `tasks`.
- Mobile: `mobile-tasks:${profile.id}` on `tasks`, `task_comments`, `task_attachments`.
- Table publication: `tasks`, `task_comments`, `task_attachments` added to `supabase_realtime`.
- UI behavior:
  - `tasks` insert/update/delete: merge canonical task row into board/list.
  - `task_comments` insert/update/delete: update comment drawer counts and detail thread.
  - `task_attachments` insert/delete: refresh attachment list and count.

### 5. Edge cases and handling

- Strict transitions:
  - `todo -> in_progress | done`
  - `in_progress -> todo | done`
  - `done -> in_progress | done`
- Assignment validation:
  - task must be assigned before `in_progress` or `done`.
  - team/staff cannot assign to another user.
- Concurrent updates: server trigger rejects illegal transition; client refetches task on conflict and reapplies only if still valid.
- Attachment upload fails after storage write: client must delete orphaned object and keep attachment drawer unchanged.

### 6. Mobile + web sync behavior

- Mobile task queue persists create/update/delete/comment/upload operations in `AsyncStorage`.
- Queue flush runs on reconnect, app foreground, and explicit retry.
- Owner-scoped cache prevents cross-account leakage on shared devices.
- Web invalidates `['admin_tasks']` and `['admin_clients']` on realtime events to keep health summaries in sync.

---

## 3. Messaging System

### 1. Step-by-step execution flow

1. Sender opens or creates a conversation via `upsert_conversation_v1`.
2. UI appends optimistic message with `status: 'sending'` and a generated `client_message_id`.
3. For media, UI uploads file to `chat-media` first, then calls `send_message_v2`.
4. `send_message_v2` verifies the sender belongs to the conversation or is admin, deduplicates by `(sender_id, client_message_id)`, inserts the message, and updates `conversations.updated_at`.
5. Receiver gets the row via realtime on `messages`.
6. Receiver marks message `delivered` when visible in inbox and `read` when active conversation is open.

### 2. API interaction logic

- Create/find conversation: `rpc('upsert_conversation_v1', ...)`.
- Add participant: `rpc('add_conversation_participant_v1', ...)`.
- Fetch conversations: `from('conversations').select(...)` + `conversation_participants`.
- Fetch messages: `from('messages').select(...)`.
- Send text/media: `rpc('send_message_v2', { p_conversation_id, p_content, p_message_type, p_file_url, p_file_name, p_file_size, p_mime_type, p_meeting_id, p_client_message_id })`.
- Delete one/all: `rpc('delete_message_v1')`, `rpc('delete_messages_v1')`, `rpc('delete_conversation_v1')`.

### 3. Role validation logic

- Participant creation and invites are validated inside `upsert_conversation_v1` and `add_conversation_participant_v1`.
- Cross-user permission is validated by `public.can_message_profile(sender, receiver)`.
- Admin:
  - can message any user and manage any conversation.
- Team/staff:
  - can message only assigned clients and admins involved in those relationships.
- Client:
  - can message only staff/admin related to their own client.
- Unauthorized sender is rejected inside `send_message_v2`.

### 4. Real-time event triggers

- Global durable channel:
  - Web: `user-sync:${profile.id}`
  - Mobile: `mobile-messages:${profile.id}`
- Conversation-local ephemeral channel:
  - `typing:${conversationId}` presence with `track({ name, typing: true })`.
  - `chat:${conversationId}` broadcast event `new_meeting`.
- Message row events:
  - `INSERT messages`: add/replace optimistic row, reorder conversation list, fire notifications.
  - `UPDATE messages`: move `status` through `sent -> delivered -> read`.

### 5. Edge cases and handling

- Duplicate send: prevented by `messages.client_message_id` unique index per sender.
- Retry after timeout: resend the same pending payload with the same `client_message_id`; RPC returns existing message id.
- Media orphaning: if storage upload succeeds but RPC insert fails, client deletes uploaded file.
- Unauthorized participant injection: blocked by `upsert_conversation_v1` and `add_conversation_participant_v1`.
- Multiple updates to same optimistic row: replace by `id` first, then by `client_message_id`, then by safe content/time fallback.

### 6. Mobile + web sync behavior

- Both clients replace optimistic rows with the canonical fetched row after `send_message_v2`.
- Both clients subscribe to `messages` and `conversation_participants`.
- Web/mobile conversation lists are sorted by `updated_at` and refreshed after every send/receive.
- Stale conversation state is resolved by refetching `conversation_participants` and `conversations` when a new membership row appears.

---

## 4. Voice Call System

### 1. Step-by-step execution flow

1. Caller resolves the target conversation and invokes `start_rtc_session_v1`.
2. Server validates conversation access, checks for an already-open compatible session, and either returns it or creates a new `rtc_sessions` row.
3. Server inserts `rtc_participants` rows and `rtc_events` rows such as `call_initiated` and `call_ringing`.
4. Callee accepts with `accept_rtc_session_v1` or rejects with `reject_rtc_session_v1`.
5. Joined participants call `join_rtc_session_v1` when media transport is ready.
6. Leave/end uses `leave_rtc_session_v1` or `end_rtc_session_v1`.

### 2. API interaction logic

- Start: `rpc('start_rtc_session_v1', ...)`.
- Accept: `rpc('accept_rtc_session_v1', { p_session_id })`.
- Reject: `rpc('reject_rtc_session_v1', { p_session_id })`.
- Join: `rpc('join_rtc_session_v1', { p_session_id, p_metadata })`.
- Leave: `rpc('leave_rtc_session_v1', { p_session_id, p_reason })`.
- End: `rpc('end_rtc_session_v1', { p_session_id, p_for_all })`.
- Realtime subscriptions:
  - `rtc-user:${profileId}` for targeted incoming events.
  - `rtc-session:${sessionId}` for session row, participant row, and event stream.

### 3. Role validation logic

- Conversation access: `public.can_access_conversation_v1`.
- Session access: `public.can_access_rtc_session_v1`.
- Only conversation members or admin can start, join, accept, reject, or end.
- End-for-all is restricted to host/moderator, initiator, or admin.

### 4. Real-time event triggers

- `rtc-user:${profileId}` receives targeted events:
  - `call_ringing`
  - `call_accepted`
  - `call_rejected`
  - `call_ended`
- `rtc-session:${sessionId}` receives:
  - `postgres_changes` on `rtc_sessions`
  - `postgres_changes` on `rtc_participants`
  - `INSERT` on `rtc_events`

### 5. Edge cases and handling

- Multiple call prevention: `start_rtc_session_v1` returns an already-open matching session instead of creating a second one.
- Call drop: participant calls `join_rtc_session_v1` again; server moves session to `connecting` or `active` based on joined count.
- Ring timeout: expired ringing sessions are handled by `expire_rtc_ringing_sessions_v1()`.
- Callee rejects and no remote participants remain: session transitions to `rejected`.
- Last joined participant leaves: session transitions to `ended`.

### 6. Mobile + web sync behavior

- Incoming call UI should be driven entirely from `rtc_events`.
- Session banners, ringing screens, and call controls should react to `rtc_sessions.status`.
- If web or mobile reconnects mid-call, subscribe to `rtc-session:${sessionId}` and reconcile against current `rtc_participants` state before re-enabling controls.

---

## 5. Meeting System

### 1. Step-by-step execution flow

1. Host creates/fetches a chat conversation via `upsert_conversation_v1`.
2. Instant meeting creation uses `start_or_get_active_meeting`; scheduled or room-based communication uses `start_rtc_session_v1` with `session_class = 'meeting'`.
3. A meeting invitation message is sent into the conversation or personal invite chats using `send_message_v2`.
4. Meeting room presence is established on `meeting:${meetingId}`.
5. Live chat uses `meeting_messages` plus broadcast `chat_msg`.
6. End meeting with `finalize_meeting_summary` and status update to `ended`.

### 2. API interaction logic

- Instant meeting: `rpc('start_or_get_active_meeting', ...)`.
- Invite extra participant: `rpc('add_conversation_participant_v1', ...)`.
- Meeting chat fetch: `from('meeting_messages').select(...).eq('meeting_id', meetingId)`.
- Meeting chat send: `from('meeting_messages').insert(...)`.
- Finalize summary: `rpc('finalize_meeting_summary', { p_meeting_id })`.
- Meeting row update: `from('meetings').update({ status: 'ended', end_time })`.

### 3. Role validation logic

- Conversation membership is the first gate for meeting visibility.
- Allowed invitees are filtered by the same staff/client relationship rules used in messaging (`listAllowedMeetingProfiles`, `can_message_profile`).
- Admin can create/join/invite across all conversations.
- Client can only join meetings attached to their own conversation scope.

### 4. Real-time event triggers

- Meetings list: `meetings-sync` on `meetings`.
- Meeting room:
  - `meeting:${meetingId}` presence for participant roster.
  - `meeting:${meetingId}` broadcast event `signal` for WebRTC signaling and room controls.
  - `meeting_chat:${meetingId}` broadcast event `chat_msg` for zero-latency in-meeting chat.
- Message conversation:
  - `chat:${conversationId}` broadcast `new_meeting` to surface invite cards instantly.

### 5. Edge cases and handling

- Duplicate meeting start: `start_or_get_active_meeting` returns the current active meeting created in the last 15 minutes.
- Missed meeting: if invite exists but participant never joins and meeting ends, the meeting stays `ended` and the invite message remains as the audit trail.
- Late join: meeting room refetches meeting row and presence state on entry.
- Summary finalization failure: keep meeting ended and retry `finalize_meeting_summary` asynchronously.

### 6. Mobile + web sync behavior

- Both clients list active and ended meetings from the same `meetings` table.
- Presence drives live participant roster; durable `meetings.status` drives list membership.
- Chat history is durable through `meeting_messages`; broadcast only optimizes latency.

---

## 6. Notification System

### 1. Step-by-step execution flow

1. Durable notification rows are inserted into `notifications`.
2. Database triggers create notification rows for task assignment and lead creation.
3. `notify_recipients(...)` asynchronously calls the `send-push` Edge Function for push delivery.
4. Web subscribes to notification inserts in `useNotifications`.
5. User marks one or all notifications as read through `notifications.read = true`.

### 2. API interaction logic

- Fetch: `from('notifications').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(20)`.
- Mark one read: `from('notifications').update({ read: true }).eq('id', id)`.
- Mark all read: `from('notifications').update({ read: true }).eq('profile_id', profile.id).eq('read', false)`.
- Push dispatch: Edge Function `send-push`.
- Web push subscriptions: `push_subscriptions`.
- Mobile push tokens: `expo_push_tokens`.

### 3. Role validation logic

- Notification rows are readable and updatable only by `profile_id = auth.uid()`.
- Push token rows are manageable only by `profile_id = auth.uid()`.
- Service-role code in `send-push` reads token tables and prunes invalid Expo tokens.

### 4. Real-time event triggers

- In-app durable channel: `public:notifications:profile_id=eq.${profile.id}` on `notifications`.
- Trigger producers:
  - `tr_notify_task_insert`
  - `tr_notify_lead_insert`
  - `tr_on_new_message_notify`
  - `tr_on_task_assigned_notify`
- UI behavior:
  - prepend new row to tray/list
  - increment unread count
  - deep-link using `metadata.url`, `task_id`, `conversation_id`, or other identifiers

### 5. Edge cases and handling

- Duplicate tokens: deduped in `send-push`.
- Invalid Expo tokens: removed when Expo returns `DeviceNotRegistered`.
- Notification insert succeeds but push fails: keep in-app row; push is best-effort.
- Read race from multiple devices: last write wins, unread count is recomputed from fetched rows on next refresh.

### 6. Mobile + web sync behavior

- In-app state is driven by `notifications`.
- Web push uses `push_subscriptions`; mobile native push uses `expo_push_tokens`.
- The durable notification row must always be written first so both devices converge even if push delivery is delayed.

---

## 7. Document System

### 1. Step-by-step execution flow

1. User selects file.
2. Client validates file size and MIME type before upload.
3. File uploads to private bucket `client-documents` under path `${client_id}/${timestamp}_${sanitizedName}`.
4. Metadata row is inserted into `client_documents`.
5. Download uses signed URL from `client-documents`.
6. Delete removes the storage object first, then deletes the metadata row.

### 2. API interaction logic

- Fetch docs: `from('client_documents').select(...)`.
- Upload file: `storage.from('client-documents').upload(...)`.
- Insert metadata: `from('client_documents').insert(...)`.
- Download: `storage.from('client-documents').createSignedUrl(file_path, ttl)`.
- Delete metadata: `from('client_documents').delete().eq('id', docId)`.
- Delete file: `storage.from('client-documents').remove([file_path])`.

### 3. Role validation logic

- Read access: `public.can_access_client(client_id)`.
- Write/delete access: `public.can_manage_client_documents(client_id)`.
- Admin: full access.
- Team/staff: can upload/delete only for accessible clients.
- Client: read only own documents; no upload/delete.
- Storage object access is enforced by storage policies using the first folder segment as `client_id`.

### 4. Real-time event triggers

- Web: `documents-sync:${profile.id}` on `client_documents`.
- Mobile: `mobile-documents:${profile.id}` on `client_documents`.
- Table publication: `client_documents` in `supabase_realtime`.
- UI behavior: refetch document list, stats, and filtered client options after any insert/update/delete.

### 5. Edge cases and handling

- Unsupported file type: block before upload.
- File over 50 MB: block before upload.
- Metadata insert fails after upload: delete the uploaded object immediately.
- Unauthorized signed URL request: denied by storage RLS because row and bucket policies both require client scope.

### 6. Mobile + web sync behavior

- Both clients read the same `client_documents` rows and same storage bucket.
- Signed URLs are short-lived and regenerated per open/download.
- Search should match document name and client firm name on both platforms.

---

## 8. Billing System

### 1. Step-by-step execution flow

1. Admin/staff fetch invoices from `invoices` joined to `clients`.
2. Create/update invoice with line items, subtotal, tax, notes, due date.
3. On send, optionally invoke `send-invoice-email`.
4. On payment confirmation, update `status` and `paid_date`.
5. Client portal reads the same invoice row via client-scoped RLS.

### 2. API interaction logic

- Fetch: `from('invoices').select('*, clients(...)').order('issued_date', { ascending: false })`.
- Create: `from('invoices').insert(...)`.
- Update: `from('invoices').update(...).eq('id', invoiceId)`.
- Delete: `from('invoices').delete().eq('id', invoiceId)`.
- Email send: `functions.invoke('send-invoice-email')`.
- PDF export: `generateInvoicePDF(...)` on web.

### 3. Role validation logic

- Read access is enforced by `public.can_access_client(client_id)`.
- Insert/update/delete is enforced by `public.can_manage_client_data(client_id)`.
- Admin: full billing access.
- Team/staff: manage only invoices for accessible clients.
- Client: read only their own invoices; no updates.

### 4. Real-time event triggers

- Web: `web-billing-sync` on `invoices` and `clients`.
- Mobile: `mobile-billing:${profile.id}` on `invoices`.
- UI behavior:
  - refetch invoice list
  - recompute paid/pending/overdue totals
  - invalidate portal invoice detail queries

### 5. Edge cases and handling

- Mark paid twice: toggle must be idempotent; when moving to `paid`, set `paid_date`; when moving away from `paid`, clear `paid_date`.
- Client email send fails: keep invoice row unchanged, show retry action.
- Unauthorized portal access: blocked by RLS and explicit portal guard against mismatched `associated_client_id`.

### 6. Mobile + web sync behavior

- Admin web and client portal/mobile read the same `invoices` table.
- Payment status change invalidates both admin and portal caches.
- Totals are derived on the client from fetched invoice rows, not stored separately.

---

## 9. Team Management

### 1. Step-by-step execution flow

1. Admin loads team roster from `profiles`.
2. Admin creates a user through `functions.invoke('create-user')`.
3. Admin edits member role/name/avatar in `profiles`.
4. Admin links client users using `associated_client_id`.
5. Admin assigns/unassigns client ownership through `clients.assigned_team_member_id` and optional `team_assigned_clients`.
6. Admin deletes members from `profiles`.

### 2. API interaction logic

- Fetch team: `from('profiles').select('*').order('role')`.
- Create user: `functions.invoke('create-user')`.
- Update member: `from('profiles').update({ full_name, role, associated_client_id, avatar_url }).eq('id', userId)`.
- Delete member: `from('profiles').delete().eq('id', userId)`.
- Assign client: `from('clients').update({ assigned_team_member_id }).eq('id', clientId)`.
- Multi-assign mobile: `from('team_assigned_clients').upsert(...)` / `delete()`.

### 3. Role validation logic

- Edge Function `create-user` requires the caller to be an authenticated admin.
- Non-admin self role/client/email changes are blocked by `enforce_profile_self_update()`.
- Admin can update roles, linked client ids, and avatar/full_name for any user.
- Only `role = 'client'` profiles can be created or updated with `associated_client_id`.
- Privilege escalation prevention:
  - self-update trigger blocks promoting yourself or relinking yourself to another client.
  - `create-user` rejects invalid roles and invalid `associated_client_id`.

### 4. Real-time event triggers

- Web: `team-admin-sync:${profile.id}` on `profiles`, `clients`, `team_assigned_clients`.
- UI behavior:
  - roster refresh on any profile change
  - assignment counts refresh on client or assignment change

### 5. Edge cases and handling

- Role update on unsupported value: reject in UI and backend.
- Client link on non-client role: reject in `create-user` and admin update path.
- Deleting assigned member: admin must reassign or intentionally leave clients unowned; UI should refresh client counts immediately.
- Concurrent admin edits: server row is authoritative; refetch roster after every profile event.

### 6. Mobile + web sync behavior

- Team roster is read from `profiles` everywhere.
- Client/user linkage is always resolved from `profiles.associated_client_id`.
- Assignment screens must refetch both `profiles` and `clients` after any change to keep recipient filters accurate in messages and meetings.

---

## Global Real-Time Event Map

- `web-clients-sync:${profile.id}`: `clients`, `team_assigned_clients`, `tasks`, `profiles`
- `mobile-clients:${profile.id}`: `clients`, `team_assigned_clients`
- `web-task-sync`: `tasks`
- `mobile-tasks:${profile.id}`: `tasks`, `task_comments`, `task_attachments`
- `user-sync:${profile.id}`: `conversation_participants`, `messages`
- `mobile-messages:${profile.id}`: `conversation_participants`, `messages`
- `typing:${conversationId}`: presence typing indicator
- `chat:${conversationId}`: broadcast `new_meeting`
- `rtc-user:${profileId}`: targeted incoming call events
- `rtc-session:${sessionId}`: `rtc_sessions`, `rtc_participants`, `rtc_events`
- `meetings-sync`: `meetings`
- `meeting:${meetingId}`: presence + broadcast `signal`
- `meeting_chat:${meetingId}`: broadcast `chat_msg` + `meeting_messages` inserts
- `public:notifications:profile_id=eq.${profile.id}`: `notifications`
- `documents-sync:${profile.id}` / `mobile-documents:${profile.id}`: `client_documents`
- `web-billing-sync` / `mobile-billing:${profile.id}`: `invoices`
- `team-admin-sync:${profile.id}`: `profiles`, `clients`, `team_assigned_clients`

---

## Offline Handling

- Implemented queues:
  - Mobile clients: create/update/delete queue in `useMobileClients`.
  - Mobile tasks: create/update/delete/comment/upload queue in `useMobileTasks`.
- Queue behavior:
  - write optimistic row with `syncState = 'pending'`
  - persist queue item in owner-scoped `AsyncStorage`
  - flush on reconnect, app foreground, manual retry
  - replace optimistic row with canonical server row on success
- Non-queued actions:
  - calls
  - live meeting join/leave
  - message send after storage upload unless the same pending payload is explicitly retried with the same `client_message_id`
  - document upload
- Conflict resolution:
  - clients: last valid server write wins
  - tasks: server trigger blocks invalid transitions
  - messages: dedupe by `client_message_id`
  - meetings/calls: current server session state wins

---

## Error Handling

- Table mutation failure:
  - keep current server state
  - revert optimistic row if action is not queueable
  - show actionable toast/alert
- Storage failure:
  - do not insert metadata row
  - clear optimistic upload state
- Partial success after storage upload:
  - delete orphaned storage object immediately
- Unauthorized error:
  - do not retry automatically
  - refetch current profile and permission-scoped data
- Retriable network error:
  - queue if the module supports offline queue
  - otherwise expose explicit retry action

---

## Performance Contract

- Clients: page size `18` on mobile (`CLIENT_PAGE_SIZE`).
- Tasks: page size `40` on mobile (`TASK_PAGE_SIZE`).
- Messages: fetch latest `150` messages per conversation, then paginate older messages on scroll.
- Meetings: fetch latest `30`.
- Notifications: latest `20`.
- Documents: latest `150`.
- Billing: keep invoice list ordered by `issued_date`; add cursor/range pagination before scaling above 500 rows per client/admin view.
- Cache rules:
  - React Query keys remain scoped by module and current user/profile when applicable.
  - Mobile caches are keyed by authenticated owner id.
  - Realtime handlers should invalidate only affected query keys, not full app state.
