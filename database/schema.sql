-- ============================================================================
-- SkillSwap database schema (PostgreSQL)
-- Exported from the existing development database (pg_dump --schema-only)
-- and rewritten in readable form. Structure is unchanged.
-- Safe to run on an empty database; it does not modify existing tables.
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    user_id          SERIAL PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    email            VARCHAR(150) NOT NULL UNIQUE,
    password         VARCHAR(255) NOT NULL,          -- PBKDF2 hash: iterations:salt:hash
    profile_picture  TEXT,                           -- data URL or image URL
    bio              TEXT,
    whatsapp         VARCHAR(20),
    telegram         VARCHAR(50),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skills (
    skill_id    SERIAL PRIMARY KEY,
    skill_name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_skills (
    user_skill_id  SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    skill_id       INTEGER NOT NULL REFERENCES skills(skill_id),
    skill_type     VARCHAR(10) NOT NULL CHECK (skill_type IN ('TEACH', 'WANT')),
    UNIQUE (user_id, skill_id, skill_type)
);

CREATE TABLE IF NOT EXISTS swap_requests (
    request_id          SERIAL PRIMARY KEY,
    sender_id           INTEGER NOT NULL REFERENCES users(user_id),
    receiver_id         INTEGER NOT NULL REFERENCES users(user_id),
    offered_skill_id    INTEGER REFERENCES skills(skill_id),          -- NULL = one-way request
    requested_skill_id  INTEGER NOT NULL REFERENCES skills(skill_id),
    status              VARCHAR(20) DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED')),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sender_completed    BOOLEAN DEFAULT FALSE,
    receiver_completed  BOOLEAN DEFAULT FALSE,
    CHECK (sender_id <> receiver_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id  SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    request_id       INTEGER REFERENCES swap_requests(request_id) ON DELETE CASCADE,
    message          TEXT NOT NULL,
    is_read          BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
