BEGIN;

CREATE TABLE IF NOT EXISTS discussion_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL
    REFERENCES courses(id) ON DELETE CASCADE,
  author_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL
    CHECK (length(trim(title)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discussion_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL
    REFERENCES discussion_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL
    CHECK (length(trim(body)) BETWEEN 1 AND 10000),
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discussion_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL
    REFERENCES discussion_posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL
    CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dismissed', 'resolved')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS discussion_threads_course_idx
  ON discussion_threads(course_id, created_at);

CREATE INDEX IF NOT EXISTS discussion_posts_thread_idx
  ON discussion_posts(thread_id, created_at);

CREATE INDEX IF NOT EXISTS discussion_reports_status_idx
  ON discussion_reports(status, created_at);

COMMIT;