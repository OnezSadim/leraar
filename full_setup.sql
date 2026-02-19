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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
ALTER TABLE group_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES (DROP IF EXISTS + CREATE)
-- ------------------------------------------

-- Subjects
DROP POLICY IF EXISTS "Subjects are viewable by everyone" ON subjects;
CREATE POLICY "Subjects are viewable by everyone" ON subjects FOR SELECT USING (true);

-- Materials
DROP POLICY IF EXISTS "Materials are viewable by everyone" ON materials;
CREATE POLICY "Materials are viewable by everyone" ON materials FOR SELECT USING (true);

-- Material Groups
DROP POLICY IF EXISTS "Users can view their own groups" ON material_groups;
-- Updated to allow discovery
CREATE POLICY "Material groups are viewable by authenticated users" ON material_groups 
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can create their own groups" ON material_groups;
CREATE POLICY "Users can create their own groups" ON material_groups FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own groups" ON material_groups;
CREATE POLICY "Users can update their own groups" ON material_groups FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own groups" ON material_groups;
CREATE POLICY "Users can delete their own groups" ON material_groups FOR DELETE USING (auth.uid() = user_id);

-- Material Group Items
DROP POLICY IF EXISTS "Users can view their group items" ON material_group_items;
-- Updated to allow subscribers to view items
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

-- User Notes
DROP POLICY IF EXISTS "Users can view their own notes" ON user_notes;
CREATE POLICY "Users can view their own notes" ON user_notes FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own notes" ON user_notes;
CREATE POLICY "Users can insert their own notes" ON user_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own notes" ON user_notes;
CREATE POLICY "Users can update their own notes" ON user_notes FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own notes" ON user_notes;
CREATE POLICY "Users can delete their own notes" ON user_notes FOR DELETE USING (auth.uid() = user_id);

-- 4. SEED DATA
-- ------------------------------------------

-- Seed Subjects
INSERT INTO subjects (id, name, icon, color) VALUES
('math', 'Mathematics', 'GraduationCap', 'from-blue-500 to-indigo-600'),
('physics', 'Physics', 'Atom', 'from-purple-500 to-purple-600'),
('history', 'History', 'History', 'from-amber-500 to-orange-600'),
('biology', 'Biology', 'FlaskConical', 'from-emerald-500 to-teal-600'),
('cs', 'Computer Science', 'Code2', 'from-pink-500 to-rose-600')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon, color = EXCLUDED.color;

-- Seed Sample Materials
INSERT INTO materials (subject_id, title, overview, content, practice_questions) 
SELECT 'math', 'Calculus Basics: Limits', 'This material covers the concept of limits, approaching values from both sides, and basic limit laws.', 'A limit is the value that a function "approaches" as the input approaches some value. Limits are essential to calculus and are used to define continuity, derivatives, and integrals.', '[{"question": "What is the limit of f(x)=x^2 as x approaches 2?", "answer": "4"}]'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE title = 'Calculus Basics: Limits');

INSERT INTO materials (subject_id, title, overview, content, practice_questions) 
SELECT 'physics', 'Newtonian Mechanics', 'Introduction to Newton''s three laws of motion and their applications in classical mechanics.', 'First Law: An object remains at rest unless acted upon by a force. Second Law: Force equals mass times acceleration (F=ma).', '[{"question": "What formula represents Newton''s Second Law?", "answer": "F = ma"}]'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE title = 'Newtonian Mechanics');

INSERT INTO materials (subject_id, title, overview, content, practice_questions) 
SELECT 'cs', 'React Server Components', 'Deep dive into how RSCs allow rendering components on the server for better performance and SEO.', 'React Server Components (RSC) allow developers to write components that run exclusively on the server.', '[{"question": "Can Server Components use the useState hook?", "answer": "No"}]'
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE title = 'React Server Components');
