-- Migration 013: Add Student Role
-- Extends user_role ENUM with 'student' for teacher-managed students

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'student';
