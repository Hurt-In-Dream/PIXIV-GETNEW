-- Pixiv-Vercel-Sync Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main images table
CREATE TABLE IF NOT EXISTS pixiv_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pid INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  original_url TEXT NOT NULL,
  r2_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pixiv_images_pid ON pixiv_images(pid);
CREATE INDEX IF NOT EXISTS idx_pixiv_images_created_at ON pixiv_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pixiv_images_artist ON pixiv_images(artist);

-- Crawler settings table
CREATE TABLE IF NOT EXISTS crawler_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cron_expression TEXT DEFAULT '0 0 * * *',
  tags TEXT[] DEFAULT ARRAY['二次元', '风景', 'イラスト'],
  r18_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO crawler_settings (cron_expression, tags, r18_enabled)
SELECT '0 0 * * *', ARRAY['二次元', '風景', 'イラスト'], FALSE
WHERE NOT EXISTS (SELECT 1 FROM crawler_settings LIMIT 1);

-- Crawler logs table
CREATE TABLE IF NOT EXISTS crawler_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('info', 'success', 'warning', 'error')),
  message TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for logs
CREATE INDEX IF NOT EXISTS idx_crawler_logs_created_at ON crawler_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawler_logs_level ON crawler_logs(level);

-- Enable Row Level Security (optional, for production)
-- ALTER TABLE pixiv_images ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE crawler_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for anonymous read access (adjust based on your needs)
-- CREATE POLICY "Allow public read" ON pixiv_images FOR SELECT USING (true);

