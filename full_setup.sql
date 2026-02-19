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
  subject_id TEXT REFERENCES subjects(id),
  title TEXT NOT NULL,
  overview TEXT NOT NULL,
  content TEXT NOT NULL,
  practice_questions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- 2. SECURITY (RLS)
-- ------------------------------------------

-- Enable Row Level Security
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
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

-- 3. POLICIES (DROP IF EXISTS + CREATE)
-- ------------------------------------------

-- Subjects
DROP POLICY IF EXISTS "Subjects are viewable by everyone" ON subjects;
CREATE POLICY "Subjects are viewable by everyone" ON subjects FOR SELECT USING (true);

-- Materials
DROP POLICY IF EXISTS "Materials are viewable by everyone" ON materials;
CREATE POLICY "Materials are viewable by everyone" ON materials FOR SELECT USING (true);

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
