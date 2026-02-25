-- ==========================================
-- FULL DATABASE SETUP FOR LERAAR AI
-- Run this script ONCE in the Supabase SQL Editor
-- This script is idempotent (can be run multiple times safely)
-- ==========================================

-- 1. TABLES
-- ------------------------------------------

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL
);

-- Create materials table
CREATE TABLE IF NOT EXISTS materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES subjects(id),
  chapter_id TEXT, -- Logical folder/chapter reference
  title TEXT NOT NULL,
  description TEXT, -- Formerly overview
  content_text TEXT NOT NULL, -- Core text content for full-text pg indexing
  content_hash TEXT, -- SHA-256 hash of the content text for deduplication
  media_urls JSONB DEFAULT '[]'::jsonb, -- Array of base64 strings or storage URLs
  video_source TEXT, -- Remote video URL if applicable
  file_type TEXT, -- e.g. "pdf", "word", "image", "video", "text"
  sort_order INTEGER DEFAULT 0,
  
  -- The segments column stores the extracted hierarchical structure.
  -- JSON Schema: [{ id: uuid, type: 'heading'|'content', title?: string, text?: string, children?: Segment[] }]
  segments JSONB DEFAULT '[]'::jsonb,
  
  subject_tags JSONB DEFAULT '[]'::jsonb,
  education_system_tags JSONB DEFAULT '[]'::jsonb,
  practice_questions JSONB DEFAULT '[]'::jsonb,
  original_material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  deltas JSONB DEFAULT '[]'::jsonb,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  helped_me_pass INTEGER DEFAULT 0,
  fork_count INTEGER DEFAULT 0,
  trust_score FLOAT GENERATED ALWAYS AS (
      (upvotes * 1.5) - (downvotes * 2.0) + (helped_me_pass * 3.0) + (fork_count * 2.0)
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create material_comments table
CREATE TABLE IF NOT EXISTS material_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  dislikes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create material_reactions table
CREATE TABLE IF NOT EXISTS material_reactions (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL, -- 'like' or 'dislike'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, material_id)
);

-- Create comment_reactions table
CREATE TABLE IF NOT EXISTS comment_reactions (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES material_comments(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL, -- 'like' or 'dislike'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);

-- Create material_groups table
CREATE TABLE IF NOT EXISTS material_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS material_group_items (
  group_id UUID REFERENCES material_groups(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, material_id)
);

-- Create material_sections table to store pre-split sections
CREATE TABLE IF NOT EXISTS material_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  estimated_time_seconds INTEGER DEFAULT 300, -- Default 5 mins
  concepts_covered JSONB DEFAULT '[]'::jsonb, -- Array of strings e.g. ["DNS", "IP"]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create section_questions table for predefined questions
CREATE TABLE IF NOT EXISTS section_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID REFERENCES material_sections(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL, -- 'mcq' or 'open'
  question_text TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb, -- Only for MCQ
  correct_answer TEXT, -- For MCQ it's the option text, for Open it's a grading rubric/key
  concepts_tested JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_progress table for tracking mastery
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  mastery_level TEXT DEFAULT 'learning', -- 'learning', 'mastered'
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, material_id, concept)
);

-- Create study_sessions table to store session state
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  current_section_id UUID REFERENCES material_sections(id),
  history JSONB DEFAULT '[]'::jsonb, -- Stores the conversation history/blocks
  predictions_history JSONB DEFAULT '[]'::jsonb, -- Stores [{timestamp, predicted_remaining_seconds}]
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, material_id)
);

-- --- ACCOUNTABILITY SYSTEM TABLES ---

-- Create study_queue table
CREATE TABLE IF NOT EXISTS study_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  test_info TEXT, -- Raw text explaining what's in the test
  status TEXT DEFAULT 'pending', -- 'pending', 'scheduled', 'completed', 'resolved'
  estimated_time_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_schedules table
CREATE TABLE IF NOT EXISTS user_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  queue_item_id UUID REFERENCES study_queue(id) ON DELETE CASCADE,
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_seconds INTEGER NOT NULL,
  status TEXT DEFAULT 'upcoming', -- 'upcoming', 'active', 'missed', 'completed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  study_times JSONB DEFAULT '{"avoid": ["morning"], "preferred": ["afternoon", "evening"], "busy_slots": []}'::jsonb,
  knowledge_assessment JSONB DEFAULT '{}'::jsonb, -- Stores user preferences or global knowledge state
  gemini_api_key TEXT, -- User-provided Google Gemini API Key
  magister_url TEXT,
  magister_username TEXT,
  magister_password TEXT,
  google_calendar_credentials JSONB DEFAULT '{}'::jsonb,
  language TEXT DEFAULT 'en',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agent_messages table for storing session suggestions and sync info
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL, -- 'calendar_sync', 'study_reminder', etc.
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create group_subscriptions table for sharing
CREATE TABLE IF NOT EXISTS group_subscriptions (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES material_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, group_id)
);

-- Create user_notes table for AI memory
CREATE TABLE IF NOT EXISTS user_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general', -- 'learning_context', 'reminder', 'general'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create whatsapp_connection table
CREATE TABLE IF NOT EXISTS whatsapp_connection (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  status TEXT DEFAULT 'disconnected', -- 'disconnected', 'connecting', 'connected'
  qr_code TEXT,
  session_data JSONB,
  phone_number TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create research_logs table
CREATE TABLE IF NOT EXISTS research_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hashed_student_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  plugin_name TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  quiz_results JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create plugins table (Plugin Marketplace)
CREATE TABLE IF NOT EXISTS plugins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  plugin_type TEXT NOT NULL DEFAULT 'custom', -- 'tutor', 'flashcards', 'narrator', 'custom'
  html_content TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  helped_me_pass INTEGER DEFAULT 0,
  trust_score FLOAT GENERATED ALWAYS AS (
      (upvotes * 1.5) - (downvotes * 2.0) + (helped_me_pass * 3.0)
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create plugin_comments table
CREATE TABLE IF NOT EXISTS plugin_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create plugin_reactions table
CREATE TABLE IF NOT EXISTS plugin_reactions (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id UUID REFERENCES plugins(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL, -- 'like' or 'dislike'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, plugin_id)
);

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id TEXT,
  summary TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_test BOOLEAN DEFAULT false,
  proactive_outreach_status TEXT DEFAULT 'none', -- 'none', 'pending', 'sent'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SECURITY (RLS)
-- ------------------------------------------

-- Enable Row Level Security
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_group_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES (DROP IF EXISTS + CREATE)
-- ------------------------------------------

-- Subjects
DROP POLICY IF EXISTS "Subjects are viewable by everyone" ON subjects;
CREATE POLICY "Subjects are viewable by everyone" ON subjects FOR SELECT USING (true);

-- Materials
DROP POLICY IF EXISTS "Materials are viewable by everyone" ON materials;
CREATE POLICY "Materials are viewable by everyone" ON materials FOR SELECT USING (true);

-- Material Comments
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON material_comments;
CREATE POLICY "Comments are viewable by everyone" ON material_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert comments" ON material_comments;
CREATE POLICY "Users can insert comments" ON material_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own comments" ON material_comments;
CREATE POLICY "Users can delete their own comments" ON material_comments FOR DELETE USING (auth.uid() = user_id);

-- Material Reactions
DROP POLICY IF EXISTS "Material reactions are viewable by everyone" ON material_reactions;
CREATE POLICY "Material reactions are viewable by everyone" ON material_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can upsert their own material reactions" ON material_reactions;
CREATE POLICY "Users can upsert their own material reactions" ON material_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own material reactions" ON material_reactions;
CREATE POLICY "Users can update their own material reactions" ON material_reactions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own material reactions" ON material_reactions;
CREATE POLICY "Users can delete their own material reactions" ON material_reactions FOR DELETE USING (auth.uid() = user_id);

-- Comment Reactions
DROP POLICY IF EXISTS "Comment reactions are viewable by everyone" ON comment_reactions;
CREATE POLICY "Comment reactions are viewable by everyone" ON comment_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can upsert their own comment reactions" ON comment_reactions;
CREATE POLICY "Users can upsert their own comment reactions" ON comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own comment reactions" ON comment_reactions;
CREATE POLICY "Users can update their own comment reactions" ON comment_reactions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own comment reactions" ON comment_reactions;
CREATE POLICY "Users can delete their own comment reactions" ON comment_reactions FOR DELETE USING (auth.uid() = user_id);

-- Material Groups
DROP POLICY IF EXISTS "Material groups are viewable by authenticated users" ON material_groups;
CREATE POLICY "Material groups are viewable by authenticated users" ON material_groups 
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can create their own groups" ON material_groups;
CREATE POLICY "Users can create their own groups" ON material_groups FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own groups" ON material_groups;
CREATE POLICY "Users can update their own groups" ON material_groups FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own groups" ON material_groups;
CREATE POLICY "Users can delete their own groups" ON material_groups FOR DELETE USING (auth.uid() = user_id);

-- Material Group Items
DROP POLICY IF EXISTS "Users can view group items they own or subscribe to" ON material_group_items;
CREATE POLICY "Users can view group items they own or subscribe to" ON material_group_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM material_groups WHERE id = group_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM group_subscriptions WHERE group_id = group_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert group items" ON material_group_items;
CREATE POLICY "Users can insert group items" ON material_group_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM material_groups WHERE id = group_id AND user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can delete group items" ON material_group_items;
CREATE POLICY "Users can delete group items" ON material_group_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM material_groups WHERE id = group_id AND user_id = auth.uid())
);

-- Group Subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON group_subscriptions;
CREATE POLICY "Users can view their own subscriptions" ON group_subscriptions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can subscribe to groups" ON group_subscriptions;
CREATE POLICY "Users can subscribe to groups" ON group_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can unsubscribe" ON group_subscriptions;
CREATE POLICY "Users can unsubscribe" ON group_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- Material Sections
DROP POLICY IF EXISTS "Sections are viewable by everyone" ON material_sections;
CREATE POLICY "Sections are viewable by everyone" ON material_sections FOR SELECT USING (true);

-- Section Questions
DROP POLICY IF EXISTS "Questions are viewable by everyone" ON section_questions;
CREATE POLICY "Questions are viewable by everyone" ON section_questions FOR SELECT USING (true);

-- User Progress
DROP POLICY IF EXISTS "Users can view their own progress" ON user_progress;
CREATE POLICY "Users can view their own progress" ON user_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can upsert their own progress" ON user_progress;
CREATE POLICY "Users can upsert their own progress" ON user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own progress" ON user_progress;
CREATE POLICY "Users can update their own progress" ON user_progress FOR UPDATE USING (auth.uid() = user_id);

-- Study Sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON study_sessions;
CREATE POLICY "Users can view their own sessions" ON study_sessions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can upsert their own sessions" ON study_sessions;
CREATE POLICY "Users can upsert their own sessions" ON study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own sessions" ON study_sessions;
CREATE POLICY "Users can update their own sessions" ON study_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Study Queue
DROP POLICY IF EXISTS "Users can view their own queue" ON study_queue;
CREATE POLICY "Users can view their own queue" ON study_queue FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert into their own queue" ON study_queue;
CREATE POLICY "Users can insert into their own queue" ON study_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own queue" ON study_queue;
CREATE POLICY "Users can update their own queue" ON study_queue FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete from their own queue" ON study_queue;
CREATE POLICY "Users can delete from their own queue" ON study_queue FOR DELETE USING (auth.uid() = user_id);

-- User Schedules
DROP POLICY IF EXISTS "Users can view their own schedules" ON user_schedules;
CREATE POLICY "Users can view their own schedules" ON user_schedules FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert into their own schedules" ON user_schedules;
CREATE POLICY "Users can insert into their own schedules" ON user_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own schedules" ON user_schedules;
CREATE POLICY "Users can update their own schedules" ON user_schedules FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete from their own schedules" ON user_schedules;
CREATE POLICY "Users can delete from their own schedules" ON user_schedules FOR DELETE USING (auth.uid() = user_id);

-- User Preferences
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
CREATE POLICY "Users can view their own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
CREATE POLICY "Users can insert their own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
CREATE POLICY "Users can update their own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Agent Messages
DROP POLICY IF EXISTS "Users can view their own messages" ON agent_messages;
CREATE POLICY "Users can view their own messages" ON agent_messages FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own messages" ON agent_messages;
CREATE POLICY "Users can delete their own messages" ON agent_messages FOR DELETE USING (auth.uid() = user_id);

-- User Notes
DROP POLICY IF EXISTS "Users can view their own notes" ON user_notes;
CREATE POLICY "Users can view their own notes" ON user_notes FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own notes" ON user_notes;
CREATE POLICY "Users can insert their own notes" ON user_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own notes" ON user_notes;
CREATE POLICY "Users can update their own notes" ON user_notes FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own notes" ON user_notes;
CREATE POLICY "Users can delete their own notes" ON user_notes FOR DELETE USING (auth.uid() = user_id);

-- WhatsApp Connection
DROP POLICY IF EXISTS "Users can view their own connection" ON whatsapp_connection;
CREATE POLICY "Users can view their own connection" ON whatsapp_connection FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can upsert their own connection" ON whatsapp_connection;
CREATE POLICY "Users can upsert their own connection" ON whatsapp_connection FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own connection" ON whatsapp_connection;
CREATE POLICY "Users can update their own connection" ON whatsapp_connection FOR UPDATE USING (auth.uid() = user_id);

-- Research Logs
DROP POLICY IF EXISTS "Users can insert research logs" ON research_logs;
CREATE POLICY "Users can insert research logs" ON research_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Plugins
DROP POLICY IF EXISTS "Plugins are viewable by everyone" ON plugins;
CREATE POLICY "Plugins are viewable by everyone" ON plugins FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can publish plugins" ON plugins;
CREATE POLICY "Authenticated users can publish plugins" ON plugins FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Authors can update their plugins" ON plugins;
CREATE POLICY "Authors can update their plugins" ON plugins FOR UPDATE USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "Authors can delete their plugins" ON plugins;
CREATE POLICY "Authors can delete their plugins" ON plugins FOR DELETE USING (auth.uid() = author_id);

-- Plugin Comments
DROP POLICY IF EXISTS "Plugin comments are viewable by everyone" ON plugin_comments;
CREATE POLICY "Plugin comments are viewable by everyone" ON plugin_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert plugin comments" ON plugin_comments;
CREATE POLICY "Users can insert plugin comments" ON plugin_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own plugin comments" ON plugin_comments;
CREATE POLICY "Users can delete own plugin comments" ON plugin_comments FOR DELETE USING (auth.uid() = user_id);

-- Plugin Reactions
DROP POLICY IF EXISTS "Plugin reactions are viewable by everyone" ON plugin_reactions;
CREATE POLICY "Plugin reactions are viewable by everyone" ON plugin_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert plugin reactions" ON plugin_reactions;
CREATE POLICY "Users can insert plugin reactions" ON plugin_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update plugin reactions" ON plugin_reactions;
CREATE POLICY "Users can update plugin reactions" ON plugin_reactions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete plugin reactions" ON plugin_reactions;
CREATE POLICY "Users can delete plugin reactions" ON plugin_reactions FOR DELETE USING (auth.uid() = user_id);

-- Calendar Events
DROP POLICY IF EXISTS "Users can view their own calendar events" ON calendar_events;
CREATE POLICY "Users can view their own calendar events" ON calendar_events FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own calendar events" ON calendar_events;
CREATE POLICY "Users can insert their own calendar events" ON calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own calendar events" ON calendar_events;
CREATE POLICY "Users can update their own calendar events" ON calendar_events FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own calendar events" ON calendar_events;
CREATE POLICY "Users can delete their own calendar events" ON calendar_events FOR DELETE USING (auth.uid() = user_id);

-- 4. SEED DATA
-- ------------------------------------------

-- Seed Subjects (Dutch VWO Curriculum)
INSERT INTO subjects (id, name, icon, color) VALUES
('nederlands', 'Nederlands', 'Book', 'from-orange-400 to-red-500'),
('engels', 'Engels', 'Languages', 'from-blue-400 to-indigo-600'),
('frans', 'Frans', 'Languages', 'from-blue-600 to-red-600'),
('duits', 'Duits', 'Languages', 'from-yellow-400 to-red-600'),
('spaans', 'Spaans', 'Languages', 'from-yellow-500 to-orange-500'),
('latijn', 'Latijn', 'Scroll', 'from-stone-400 to-stone-600'),
('grieks', 'Grieks', 'Landmark', 'from-blue-300 to-blue-500'),
('wiskunde_a', 'Wiskunde A', 'Calculator', 'from-emerald-500 to-teal-700'),
('wiskunde_b', 'Wiskunde B', 'Variable', 'from-emerald-600 to-teal-800'),
('wiskunde_c', 'Wiskunde C', 'Divide', 'from-emerald-400 to-teal-600'),
('wiskunde_d', 'Wiskunde D', 'Pi', 'from-emerald-700 to-teal-900'),
('natuurkunde', 'Natuurkunde', 'Atom', 'from-purple-500 to-indigo-600'),
('scheikunde', 'Scheikunde', 'FlaskConical', 'from-cyan-400 to-blue-500'),
('biologie', 'Biologie', 'Leaf', 'from-green-400 to-emerald-600'),
('economie', 'Economie', 'TrendingUp', 'from-rose-500 to-pink-600'),
('bedrijfseconomie', 'Bedrijfseconomie', 'Briefcase', 'from-rose-600 to-pink-700'),
('aardrijkskunde', 'Aardrijkskunde', 'Globe2', 'from-amber-600 to-orange-700'),
('geschiedenis', 'Geschiedenis', 'History', 'from-stone-600 to-stone-800'),
('maatschappijwetenschappen', 'Maatschappijwetenschappen', 'Users', 'from-indigo-400 to-purple-500'),
('filosofie', 'Filosofie', 'Brain', 'from-violet-400 to-fuchsia-500'),
('informatica', 'Informatica', 'Code2', 'from-slate-700 to-slate-900'),
('kunst', 'Kunst', 'Palette', 'from-fuchsia-500 to-pink-500'),
('muziek', 'Muziekwetenschappen', 'Music', 'from-purple-400 to-indigo-500'),
('nlt', 'NLT', 'Microscope', 'from-teal-400 to-emerald-500')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, color = EXCLUDED.color;

-- ------------------------------------------
-- MIGRATION: Update existing materials table
-- ------------------------------------------

DO $$
BEGIN
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='user_id') THEN
        ALTER TABLE materials ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='chapter_id') THEN
        ALTER TABLE materials ADD COLUMN chapter_id TEXT;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='description') THEN
        ALTER TABLE materials ADD COLUMN description TEXT;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='content_text') THEN
        ALTER TABLE materials ADD COLUMN content_text TEXT;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='media_urls') THEN
        ALTER TABLE materials ADD COLUMN media_urls JSONB DEFAULT '[]'::jsonb;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='video_source') THEN
        ALTER TABLE materials ADD COLUMN video_source TEXT;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='file_type') THEN
        ALTER TABLE materials ADD COLUMN file_type TEXT;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='sort_order') THEN
        ALTER TABLE materials ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='subject_tags') THEN
        ALTER TABLE materials ADD COLUMN subject_tags JSONB DEFAULT '[]'::jsonb;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='education_system_tags') THEN
        ALTER TABLE materials ADD COLUMN education_system_tags JSONB DEFAULT '[]'::jsonb;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='original_material_id') THEN
        ALTER TABLE materials ADD COLUMN original_material_id UUID REFERENCES materials(id) ON DELETE SET NULL;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='deltas') THEN
        ALTER TABLE materials ADD COLUMN deltas JSONB DEFAULT '[]'::jsonb;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='upvotes') THEN
        ALTER TABLE materials ADD COLUMN upvotes INTEGER DEFAULT 0;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='downvotes') THEN
        ALTER TABLE materials ADD COLUMN downvotes INTEGER DEFAULT 0;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='helped_me_pass') THEN
        ALTER TABLE materials ADD COLUMN helped_me_pass INTEGER DEFAULT 0;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='fork_count') THEN
        ALTER TABLE materials ADD COLUMN fork_count INTEGER DEFAULT 0;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='trust_score') THEN
        ALTER TABLE materials ADD COLUMN trust_score FLOAT GENERATED ALWAYS AS (
            (upvotes * 1.5) - (downvotes * 2.0) + (helped_me_pass * 3.0) + (fork_count * 2.0)
        ) STORED;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='content_hash') THEN
        ALTER TABLE materials ADD COLUMN content_hash TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='sync_original_updates') THEN
        ALTER TABLE materials ADD COLUMN sync_original_updates BOOLEAN DEFAULT true;
    END IF;
END $$;

-- ------------------------------------------
-- MIGRATION: Update existing plugins table
-- ------------------------------------------

DO $$
BEGIN
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plugins' AND column_name='upvotes') THEN
        ALTER TABLE plugins ADD COLUMN upvotes INTEGER DEFAULT 0;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plugins' AND column_name='downvotes') THEN
        ALTER TABLE plugins ADD COLUMN downvotes INTEGER DEFAULT 0;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plugins' AND column_name='helped_me_pass') THEN
        ALTER TABLE plugins ADD COLUMN helped_me_pass INTEGER DEFAULT 0;
    END IF;
    If NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plugins' AND column_name='trust_score') THEN
        ALTER TABLE plugins ADD COLUMN trust_score FLOAT GENERATED ALWAYS AS (
            (upvotes * 1.5) - (downvotes * 2.0) + (helped_me_pass * 3.0)
        ) STORED;
    END IF;
END $$;
