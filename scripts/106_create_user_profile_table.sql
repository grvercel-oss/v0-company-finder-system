-- Create user_profile table for storing user information
CREATE TABLE IF NOT EXISTS user_profile (
  id SERIAL PRIMARY KEY,
  
  -- Personal Information
  full_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  website VARCHAR(255),
  
  -- Additional Contact Info
  linkedin_url VARCHAR(255),
  twitter_url VARCHAR(255),
  
  -- Email Signature
  signature TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profile_email ON user_profile(email);
