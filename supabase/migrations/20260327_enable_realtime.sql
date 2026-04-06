-- Migration: Enable Realtime for Messages and Meetings
DO $$
BEGIN
    -- Check if publication exists, if not create it
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    -- Ensure tables are in the publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
    EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication
    END;
END $$;
