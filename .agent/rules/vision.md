---
trigger: always_on
---

# Project Vision: Free Public Learning Service

This document outlines the core vision and architectural requirements for transitioning the **School Learning Buddy** into a free, public service. 

**ATTENTION FUTURE AGENTS:** This file is part of your working context. It dictates the long-term goals of the project. If the user's focus or requirements change, **you are authorized and expected to edit this file** to reflect the latest strategic plans.

## 1. Universal Content Uploading & Ingestion
The platform must support diverse, easily accessible learning materials while ensuring clean, standardized data.
- **Supported Formats:** Support for plain text, HTML, images, and videos.
- **Frictionless Experience:** Creating and uploading content should be incredibly simple. Users should be able to easily copy/paste or submit content without friction.
- **Robust Ingestion Pipeline:** A bulletproof backend parser that cleans messy data (URLs, raw text dumps) into a standardized format (e.g., markdown or JSON) is foundational before any UI work.

## 2. Global Sharing, Remixing & Deduplication
To build a scalable and helpful ecosystem, content needs to be shared globally without redundancy, while respecting user customization.
- **Global Search:** Materials should be easily searchable and accessible to anyone.
- **Smart Deduplication & Remixing (Forking):** If someone has already uploaded a specific course or material, the system should recognize it using AI embeddings and vector comparisons. Instead of strict deduplication, allow users to "Fork" or "Remix" the content. If they modify it, only store the differences (deltas) to save database storage space.
- **Quality Control & Moderation:** Implement a "Community Trust" metric or an upvote/downvote system. Global search should heavily weight content by how positively the community has interacted with it.

## 3. Accessible Setup & Onboarding
Because the app may rely on requiring users to bring their own API keys (e.g., Google Gemini), we must dramatically lower the barrier to entry.
- **Clear Instructions:** Setup needs to be easy and accompanied by extremely clear instructions.
- **Visual Guides:** Integrating a YouTube video tutorial or visual step-by-step guides is required to help users navigate hurdles like getting an API key.

## 4. "Plastic" (Modular) Service Architecture
The platform isn't just a static tool; it is a highly customizable engine, but it must be secure.
- **Interchangeable Learning Systems:** The core learning methodology should be modular so that different learning preferences can be accommodated. Users can interchange learning systems and share them.
- **Plug-and-Play Apps:** Features like the "Accountability Assistant" should function as interchangeable apps or modules that users can add, remove, develop, and share.
- **Sandboxed Security:** Interchangeable systems and user-provided logic must be strictly defined (e.g., via JSON schema templates) or run in sandboxed environments to prevent security risks with personal API keys. The platform reads user *rulesets*, not arbitrary code.
- **Universal Database Schema:** Design tables so that a "Learning Module" is agnostic to the app reading it, allowing seamless integration across different modular tools.

## 5. Free Ecosystem with Cost Efficiency
The foundational rule: **Learning must remain free.**
- The service (apart from 3rd party APIs) is 100% free. 
- There should be no price on learning.
- **Client-Side Heavy Architecture:** To keep it free and sustainable, ensure **as much compute as possible happens on the user's device**. Use WebAssembly models for text extraction or embeddings directly in the user's browser whenever possible to avoid expensive cloud processing and wasteful API calls.

---

*Note: Future agents in Antigravity, review these core pillars before adding features. Do not build paid walls for learning content and prioritize user experience when handling API connections and file uploads.*
