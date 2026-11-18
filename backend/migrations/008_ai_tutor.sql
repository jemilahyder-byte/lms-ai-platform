BEGIN;

CREATE TABLE lecture_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id UUID NOT NULL
    REFERENCES lectures(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lecture_id, chunk_index)
);

COMMIT;