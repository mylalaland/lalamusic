# Slowi Music Architecture

## Overview
**Slowi Music** is a serverless, hybrid web application (Next.js App Router) functioning as a personal music player. It leverages Google Drive as the primary media storage and streams audio client-side.

## Core Tech Stack
- **Framework:** Next.js (App Router, Server Actions)
- **Styling:** Tailwind CSS (with shadcn/ui inspired components)
- **State Management:** Zustand (Local Storage Persisted)
- **Authentication:** Supabase (OAuth via Google)
- **Storage Strategy:**
  - **Google Drive:** Source of truth for raw audio files (.mp3, .flac).
  - **IndexedDB (Local DB):** Caches large metadata (cover arts, lyrics) locally directly on the user's device for fast retrieval and zero cloud-db costs.
  - **Supabase DB:** Stores only minimal metadata like login sessions and user preferences (to be optimized).
- **AI Integration:** User-provided API Keys (Gemini, Claude, OpenAI) for semantic music search and smart recommendations without central server costs.

## Directory Structure
- `src/app/`: Next.js App Router routes
  - `desktop/`: Desktop-optimized views (Spotify-like layout)
  - `mobile/`: Mobile-optimized views (Bottom tab layout)
  - `actions/`: Next.js Server Actions (Supabase interactions, AI logic, Google Drive API)
  - `api/`: Route handlers (e.g., audio streaming)
  - `auth/`: Supabase Authentication Callbacks
- `src/components/`: Reusable React components
  - `shared/`: Components used by both Desktop and Mobile variants.
  - `layout/`: Navigations, Sidebars, Bottom tabs.
  - `player/`: The Global persistent audio player component.
- `src/lib/`: Utilities
  - `db/offline.ts`: IndexedDB wrapper for large metadata & offline files.
  - `store/`: Zustand state hooks (`usePlayerStore`, `useLibraryStore`).
  - `supabase/`: Supabase Server & Client configs.

## Key Workflows
1. **Login:** Users log in via Supabase -> authenticates with Google -> grants `drive.readonly` scope.
2. **Library Sync:** Application reads `.mp3` files from Google Drive -> Parses ID3 tags locally/server-actions -> Saves heavy metadata to IndexDB.
3. **Playback:** `src/components/player/GlobalPlayer.tsx` interacts with Zustand `usePlayerStore` to stream audio chunks without full download.
4. **AI Search:** User enters a semantic prompt -> Frontend gets User API Key -> Server Action uses API Key to find matching tracks -> Returns selection.
