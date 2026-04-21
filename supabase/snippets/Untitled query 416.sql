DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'chat_rooms'
          AND column_name = 'room_context'
    ) THEN
        ALTER TABLE public.chat_rooms RENAME COLUMN room_context TO context;
    ELSIF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'chat_rooms'
          AND column_name = 'context'
    ) THEN
        ALTER TABLE public.chat_rooms ADD COLUMN context jsonb;
    END IF;
END
$$;