-- Supabase RLS (Row-Level Security) 설정 스크립트
-- 이 스크립트를 Supabase 대시보드의 SQL Editor에 붙여넣고 실행(Run)하세요.

-- 1. Playlists 테이블
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own playlists" ON playlists;
CREATE POLICY "Users can insert their own playlists" ON playlists
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select their own playlists" ON playlists;
CREATE POLICY "Users can select their own playlists" ON playlists
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own playlists" ON playlists;
CREATE POLICY "Users can update their own playlists" ON playlists
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own playlists" ON playlists;
CREATE POLICY "Users can delete their own playlists" ON playlists
FOR DELETE USING (auth.uid() = user_id);


-- 2. Playlist Items 테이블 (playlist_id를 통해 playlists 테이블의 user_id 확인)
ALTER TABLE playlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own playlist items" ON playlist_items;
CREATE POLICY "Users can insert their own playlist items" ON playlist_items
FOR INSERT WITH CHECK (
  playlist_id IN (SELECT id FROM playlists WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can select their own playlist items" ON playlist_items;
CREATE POLICY "Users can select their own playlist items" ON playlist_items
FOR SELECT USING (
  playlist_id IN (SELECT id FROM playlists WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own playlist items" ON playlist_items;
CREATE POLICY "Users can update their own playlist items" ON playlist_items
FOR UPDATE USING (
  playlist_id IN (SELECT id FROM playlists WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their own playlist items" ON playlist_items;
CREATE POLICY "Users can delete their own playlist items" ON playlist_items
FOR DELETE USING (
  playlist_id IN (SELECT id FROM playlists WHERE user_id = auth.uid())
);


-- 3. Music Files 테이블
ALTER TABLE music_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own music files" ON music_files;
CREATE POLICY "Users can manage their own music files" ON music_files
FOR ALL USING (auth.uid() = user_id);


-- 4. Folders 테이블
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own folders" ON folders;
CREATE POLICY "Users can manage their own folders" ON folders
FOR ALL USING (auth.uid() = user_id);


-- 5. Bookmarks 테이블
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own bookmarks" ON bookmarks;
CREATE POLICY "Users can manage their own bookmarks" ON bookmarks
FOR ALL USING (auth.uid() = user_id);


-- 6. User Tokens 테이블
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own tokens" ON user_tokens;
CREATE POLICY "Users can manage their own tokens" ON user_tokens
FOR ALL USING (auth.uid() = user_id);
