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
  crawl_limit INTEGER DEFAULT 10,
  r18_crawl_limit INTEGER DEFAULT 10,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO crawler_settings (cron_expression, tags, r18_enabled, crawl_limit, r18_crawl_limit)
SELECT '0 0 * * *', ARRAY['二次元', '風景', 'イラスト'], FALSE, 10, 10
WHERE NOT EXISTS (SELECT 1 FROM crawler_settings LIMIT 1);

-- Add columns if table already exists (for migration)
ALTER TABLE crawler_settings ADD COLUMN IF NOT EXISTS crawl_limit INTEGER DEFAULT 10;
ALTER TABLE crawler_settings ADD COLUMN IF NOT EXISTS r18_crawl_limit INTEGER DEFAULT 10;
ALTER TABLE crawler_settings ADD COLUMN IF NOT EXISTS tag_search_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE crawler_settings ADD COLUMN IF NOT EXISTS tag_search_limit INTEGER DEFAULT 10;

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

-- Skip tags table (for filtering unsuitable images)
CREATE TABLE IF NOT EXISTS skip_tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tag TEXT NOT NULL UNIQUE,
  translation TEXT,
  category TEXT DEFAULT 'other',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default skip tags
INSERT INTO skip_tags (tag, translation, category) VALUES
  ('透過png', '透明PNG', 'background'),
  ('透明背景', '透明背景', 'background'),
  ('白背景', '白色背景', 'background'),
  ('単色背景', '单色背景', 'background'),
  ('ちびキャラ', 'Q版角色', 'style'),
  ('chibi', 'Q版', 'style'),
  ('SD', 'SD角色', 'style'),
  ('漫画', '漫画', 'type'),
  ('manga', '漫画', 'type'),
  ('comic', '漫画', 'type'),
  ('4コマ', '四格漫画', 'type'),
  ('AI生成', 'AI生成', 'ai'),
  ('novelai', 'NovelAI', 'ai'),
  ('モノクロ', '黑白/单色', 'color'),
  ('白黒', '黑白', 'color'),
  ('まとめ', '合集/汇总', 'text'),
  ('ログ', 'Log/日志', 'text'),
  ('log', 'Log/日志', 'text'),
  ('色紙', '色纸', 'format'),
  ('VTuber', '虚拟主播', 'vtuber'),
  ('にじさんじ', '彩虹社', 'vtuber'),
  ('ホロライブ', 'Hololive', 'vtuber'),
  ('users入り', '收藏数标记', 'meta'),
  ('落書き', '涂鸦/草稿', 'draft'),
  ('sketch', '草稿', 'draft'),
  ('ドット絵', '像素画', 'style')
ON CONFLICT (tag) DO NOTHING;

-- Enable Row Level Security (optional, for production)
-- ALTER TABLE pixiv_images ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE crawler_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for anonymous read access (adjust based on your needs)
-- CREATE POLICY "Allow public read" ON pixiv_images FOR SELECT USING (true);

