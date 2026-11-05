BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(180) NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique
    ON users (lower(email));

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE
        CHECK (name IN ('student', 'instructor', 'admin'))
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id)
        ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES roles(id)
        ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX user_roles_role_id_idx
    ON user_roles (role_id);

INSERT INTO roles (name)
VALUES ('student'), ('instructor'), ('admin');

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(80),
    difficulty VARCHAR(20) NOT NULL DEFAULT 'beginner'
        CHECK (difficulty IN (
            'beginner', 'intermediate', 'advanced'
        )),
    thumbnail_url TEXT,
    price NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending', 'approved', 'rejected', 'archived'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id)
        ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    order_index INT NOT NULL CHECK (order_index >= 0),
    UNIQUE (course_id, order_index)
);

CREATE TABLE lectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES modules(id)
        ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    video_url TEXT,
    transcript TEXT,
    duration_seconds INT CHECK (duration_seconds >= 0),
    order_index INT NOT NULL CHECK (order_index >= 0),
    resource_urls TEXT[] NOT NULL DEFAULT '{}',
    UNIQUE (module_id, order_index)
);

CREATE INDEX courses_instructor_id_idx
    ON courses (instructor_id);

CREATE INDEX courses_pending_idx
    ON courses (created_at)
    WHERE status = 'pending';

COMMIT;