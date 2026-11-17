BEGIN;

CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    course_title TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, course_id)
);

CREATE TABLE learning_activity_days (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    first_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, activity_date)
);

CREATE TABLE badges (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE user_badges (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_code TEXT NOT NULL REFERENCES badges(code),
    earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_code)
);

INSERT INTO badges (code, title, description) VALUES
    (
        'first_lesson',
        'First Lesson',
        'Complete your first lesson.'
    ),
    (
        'first_quiz_pass',
        'Quiz Achiever',
        'Pass your first quiz.'
    ),
    (
        'first_course',
        'Course Graduate',
        'Earn your first course certificate.'
    ),
    (
        'streak_3',
        'Three Day Learner',
        'Learn on three consecutive days.'
    ),
    (
        'streak_7',
        'Seven Day Learner',
        'Learn on seven consecutive days.'
    );

COMMIT;