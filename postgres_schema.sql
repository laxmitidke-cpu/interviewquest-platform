-- PostgreSQL Database Schema for InterviewQuest Platform
-- Establishes role-based indices, question definitions, secure result signing, and automated logs.

-- Enable UUID generation support if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'candidate')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index on email to speed up authentication and authorization
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Assessments Table
CREATE TABLE IF NOT EXISTS assessments (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    creator_id VARCHAR(255) NOT NULL,
    skills TEXT[] NOT NULL, -- Array of skills assessed
    num_questions INTEGER NOT NULL,
    time_limit INTEGER NOT NULL, -- in minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Questions Table
CREATE TABLE IF NOT EXISTS questions (
    id VARCHAR(255) PRIMARY KEY,
    assessment_id VARCHAR(255) REFERENCES assessments(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('mcq', 'short_answer')),
    text TEXT NOT NULL,
    skills TEXT[] NOT NULL,
    points INTEGER DEFAULT 10,
    choices TEXT[] DEFAULT NULL, -- Array of strings for MCQ
    correct_answer_index INTEGER DEFAULT NULL,
    correct_answer_rubric TEXT DEFAULT NULL
);

-- Index on assessment reference
CREATE INDEX IF NOT EXISTS idx_questions_assessment_id ON questions(assessment_id);

-- 4. Assessment Sessions (Results) Table
CREATE TABLE IF NOT EXISTS assessment_sessions (
    id VARCHAR(255) PRIMARY KEY,
    assessment_id VARCHAR(255) REFERENCES assessments(id) ON DELETE CASCADE,
    candidate_email VARCHAR(255) NOT NULL,
    candidate_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'in_progress', 'submitted', 'expired')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    answers JSONB NOT NULL DEFAULT '[]'::jsonb, -- Store list of provided answers
    results JSONB DEFAULT NULL, -- Score card, evaluation details, points earned, questionResult array
    secure_hash VARCHAR(64) NOT NULL, -- Cryptographic HMAC-SHA256 of candidate results to guarantee immutability
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_candidate_email ON assessment_sessions(candidate_email);
CREATE INDEX IF NOT EXISTS idx_sessions_assessment_id ON assessment_sessions(assessment_id);

-- 5. Email Invitations Table
CREATE TABLE IF NOT EXISTS email_invitations (
    id VARCHAR(255) PRIMARY KEY,
    assessment_id VARCHAR(255) REFERENCES assessments(id) ON DELETE CASCADE,
    candidate_email VARCHAR(255) NOT NULL,
    candidate_name VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'opened', 'completed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON email_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON email_invitations(candidate_email);

-- 6. Audit Trail and Dynamic Logs
CREATE TABLE IF NOT EXISTS secure_audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(255) NOT NULL,
    entity_id VARCHAR(255),
    entity_type VARCHAR(100),
    performed_by VARCHAR(255) NOT NULL,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
