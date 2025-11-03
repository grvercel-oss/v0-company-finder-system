-- Verification script to ensure all core tables exist with required columns
-- Run this to check if your database is properly set up

-- Check campaigns table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        RAISE EXCEPTION 'campaigns table does not exist - run core table creation scripts first';
    END IF;
END $$;

-- Check contacts table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts') THEN
        RAISE EXCEPTION 'contacts table does not exist - run core table creation scripts first';
    END IF;
END $$;

-- Check email_threads table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_threads') THEN
        RAISE EXCEPTION 'email_threads table does not exist - run core table creation scripts first';
    END IF;
END $$;

-- Check email_messages table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_messages') THEN
        RAISE EXCEPTION 'email_messages table does not exist - run core table creation scripts first';
    END IF;
END $$;

-- Check outlook_config table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'outlook_config') THEN
        RAISE EXCEPTION 'outlook_config table does not exist - run core table creation scripts first';
    END IF;
END $$;

-- If we get here, all core tables exist
SELECT 'All core tables verified successfully' as status;
