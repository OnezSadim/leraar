# Project Rules & Context: School Learning Buddy

This file defines the global standards and project context for all AI agents working on the "School Learning Buddy" application.

## 🚀 Project Overview
An AI-powered school learning companion built to help students study smarter.

### 🛠 Technology Stack
- **Framework**: Next.js 15+ (App Router)
- **Styling**: Tailwind CSS v4 (Standard: `@import "tailwindcss"`)
- **Database & Auth**: Supabase (@supabase/ssr)
- **Icons**: Lucide React
- **Design System**: Modern "Glassmorphism" aesthetics (translucent cards, gradients, vibrant colors).

## 📂 Architecture & Routing
- `/login`: Indigo-themed login page.
- `/signup`: Emerald/Teal-themed signup page (separated to avoid form validation conflicts).
- `/`: Protected home dashboard (requires authentication).
- `src/lib/supabase`: Contains browser and server clients, and session middleware.
- `src/app/login/actions.ts`: Contains shared auth logic for sign-in and sign-up.

## 📏 Core Rules
1. **Functionality First**: Prioritize building working, bug-free features before focusing on aesthetics. The logic must be solid and verified before the "wow" factor is applied.
2. **Design Follows**: Once a feature is functional, apply high-end, premium visuals (glassmorphism, gradients, `backdrop-blur`). Aesthetics are important but should never compromise performance or correctness.
3. **Context Separation**: Keep Login and Signup logic visually and logically distinct.
3. **Supabase Auth**: Use Server Actions for auth. Ensure `getUser()` is used in middleware for session refreshing.
4. **Environment Variables**: Local keys are stored in `.env.local`. Never leak these into public files.
5. **Typescript**: All new components and logic must be strictly typed.
6. **AI Reliability**: All Gemini API calls must be wrapped in the `withRetry` exponential backoff helper (defined in `src/lib/ai.ts`) to handle rate limits (429) and server overloads (503).

## 📖 How to Use This File
1. **Read-Only Context**: Agents automatically consume this file. If you need to change a core project rule, edit this file directly.
2. **Logging Project Evolution**: Use the "Project Logs" section below to record significant architectural changes or "gotchas" that future agents should know.
3. **Consistency**: Ensure all new features align with the "Premium UI" and "Next.js 15" patterns defined here.

## 📝 Project Logs
- **2026-02-19**: Initialized project with Next.js, Tailwind, and Supabase.
- **2026-02-19**: Implemented Login/Signup split. Signup is Emerald/Teal; Login is Indigo.
- **2026-02-19**: Configured Supabase SSR middleware with `/signup` allowlist.
- **2026-02-19**: Implemented exponential backoff for AI calls in `src/lib/ai.ts` to solve `429 Too Many Requests` issues.
