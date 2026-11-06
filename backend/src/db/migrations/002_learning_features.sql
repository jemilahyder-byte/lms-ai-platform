BEGIN;

CREATE TABLE enrollments (
    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL
        REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, course_id)
);

CREATE INDEX enrollments_course_id_idx
    ON enrollments (course_id);

CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL
        REFERENCES modules(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    passing_percentage INT NOT NULL DEFAULT 50
        CHECK (passing_percentage BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX quizzes_module_id_idx ON quizzes (module_id);

CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL
        REFERENCES quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL
        CHECK (
            jsonb_typeof(options) = 'array'
            AND jsonb_array_length(options) >= 2
        ),
    correct_option_index INT NOT NULL,
    points INT NOT NULL DEFAULT 1 CHECK (points > 0),
    order_index INT NOT NULL CHECK (order_index >= 0),
    CHECK (
        correct_option_index >= 0
        AND correct_option_index < jsonb_array_length(options)
    ),
    UNIQUE (quiz_id, order_index),
    UNIQUE (quiz_id, id)
);

CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL
        REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    score INT,
    max_score INT,
    CHECK (
        (submitted_at IS NULL AND score IS NULL AND max_score IS NULL)
        OR
        (
            submitted_at IS NOT NULL
            AND score IS NOT NULL
            AND max_score IS NOT NULL
            AND submitted_at >= started_at
            AND max_score > 0
            AND score BETWEEN 0 AND max_score
        )
    ),
    UNIQUE (id, quiz_id)
);

CREATE INDEX quiz_attempts_quiz_user_idx
    ON quiz_attempts (quiz_id, user_id);

CREATE INDEX quiz_attempts_user_id_idx
    ON quiz_attempts (user_id);

CREATE TABLE quiz_answers (
    attempt_id UUID NOT NULL,
    quiz_id UUID NOT NULL,
    question_id UUID NOT NULL,
    selected_option_index INT NOT NULL
        CHECK (selected_option_index >= 0),
    PRIMARY KEY (attempt_id, question_id),
    FOREIGN KEY (attempt_id, quiz_id)
        REFERENCES quiz_attempts(id, quiz_id) ON DELETE CASCADE,
    FOREIGN KEY (quiz_id, question_id)
        REFERENCES quiz_questions(quiz_id, id) ON DELETE CASCADE
);

CREATE INDEX quiz_answers_question_idx
    ON quiz_answers (quiz_id, question_id);

CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL
        REFERENCES modules(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    instructions TEXT NOT NULL,
    max_score INT NOT NULL DEFAULT 100 CHECK (max_score > 0),
    due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, max_score)
);

CREATE INDEX assignments_module_id_idx
    ON assignments (module_id);

CREATE TABLE assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL,
    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    submission_text TEXT,
    file_url TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    max_score INT NOT NULL,
    score INT,
    feedback TEXT,
    graded_by UUID REFERENCES users(id),
    graded_at TIMESTAMPTZ,
    FOREIGN KEY (assignment_id, max_score)
        REFERENCES assignments(id, max_score)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CHECK (
        NULLIF(btrim(submission_text), '') IS NOT NULL
        OR NULLIF(btrim(file_url), '') IS NOT NULL
    ),
    CHECK (score IS NULL OR score BETWEEN 0 AND max_score),
    CHECK (
        (score IS NULL AND graded_by IS NULL AND graded_at IS NULL)
        OR
        (
            score IS NOT NULL
            AND graded_by IS NOT NULL
            AND graded_at IS NOT NULL
            AND graded_at >= submitted_at
        )
    ),
    UNIQUE (assignment_id, user_id)
);

CREATE INDEX assignment_submissions_user_id_idx
    ON assignment_submissions (user_id);

CREATE INDEX assignment_submissions_graded_by_idx
    ON assignment_submissions (graded_by);

CREATE TABLE lecture_progress (
    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    lecture_id UUID NOT NULL
        REFERENCES lectures(id) ON DELETE CASCADE,
    last_position_seconds INT NOT NULL DEFAULT 0
        CHECK (last_position_seconds >= 0),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lecture_id),
    CHECK (
        (is_completed AND completed_at IS NOT NULL)
        OR (NOT is_completed AND completed_at IS NULL)
    )
);

CREATE INDEX lecture_progress_lecture_id_idx
    ON lecture_progress (lecture_id);

COMMIT;