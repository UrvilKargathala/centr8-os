-- Add "draft" value to project_status enum
-- Hand-written (same reason as 0102–0113)
ALTER TYPE "project_status" ADD VALUE IF NOT EXISTS 'draft' BEFORE 'planning';
