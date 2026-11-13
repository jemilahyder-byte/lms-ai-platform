BEGIN;

CREATE TABLE IF NOT EXISTS lesson_notes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, lecture_id),
  CHECK (char_length(content) <= 20000)
);

CREATE TABLE IF NOT EXISTS lesson_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lecture_id UUID NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  position_seconds INTEGER NOT NULL
    CHECK (position_seconds BETWEEN 0 AND 86400),
  label TEXT NOT NULL DEFAULT ''
    CHECK (char_length(label) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lecture_id, position_seconds)
);

COMMIT;
