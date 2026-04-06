-- 1. Create meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'scheduled')),
    room_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    start_time TIMESTAMPTZ DEFAULT now(),
    end_time TIMESTAMPTZ
);

-- 2. Ensure meeting_id column exists in messages and has exact foreign key
-- We drop and recreate the FK to be absolutely sure PostgREST sees the relationship
DO $$
BEGIN
    -- Ensure column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'meeting_id') THEN
        ALTER TABLE public.messages ADD COLUMN meeting_id UUID;
    END IF;

    -- Drop existing FK if it's broken or not discovered
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_meeting_id_fkey') THEN
        ALTER TABLE public.messages DROP CONSTRAINT messages_meeting_id_fkey;
    END IF;

    -- Add the definitive FK
    ALTER TABLE public.messages 
    ADD CONSTRAINT messages_meeting_id_fkey 
    FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;
END $$;

-- 3. Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- DROP existing if they exist to avoid conflict
DROP POLICY IF EXISTS "Users can see meetings in their conversations" ON public.meetings;
DROP POLICY IF EXISTS "Users can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Creators and admins can update meetings" ON public.meetings;

CREATE POLICY "Users can see meetings in their conversations" ON public.meetings
    FOR SELECT USING (
        conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE profile_id = auth.uid()) OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

CREATE POLICY "Users can create meetings" ON public.meetings
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators and admins can update meetings" ON public.meetings
    FOR UPDATE USING (
        creator_id = auth.uid() OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );
