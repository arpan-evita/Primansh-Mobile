-- Migration: Enable Postgres Realtime for Messaging Tables
-- Allows Supabase to broadcast INSERT/UPDATE/DELETE events over WebSockets

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
