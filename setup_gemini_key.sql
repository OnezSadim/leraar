-- Add gemini_api_key to user_preferences table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='user_preferences' AND column_name='gemini_api_key') THEN
        ALTER TABLE user_preferences ADD COLUMN gemini_api_key TEXT;
    END IF;
END $$;
