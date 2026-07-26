-- ============================================================================
-- SANCHIKA (संचिका) NOTES SYSTEM - TEMPLATES MIGRATION (OPTIONAL)
-- ============================================================================
-- Purpose: Create the note_templates table for reusable note templates
-- Database: virat_gyankosh
-- Created: 2025-11-19
-- Status: OPTIONAL - Future Enhancement
-- Dependencies: None (can be created independently)
-- 
-- DESCRIPTION:
-- This migration creates the note_templates table to provide reusable
-- note templates. Features include:
--   - Pre-formatted note structures
--   - Subject-specific templates
--   - User-created and system templates
--   - Public template sharing
--   - Usage tracking for popular templates
--
-- USE CASES:
--   - Lab report templates
--   - Essay outline templates
--   - Math problem-solving templates
--   - Study guide templates
--   - Cornell notes format
--
-- NOTE: This table is OPTIONAL. Implement when template features are needed.
--
-- HOW TO RUN THIS MIGRATION:
-- docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/create_note_templates_table.sql
--
-- ============================================================================

SET NAMES utf8mb4;
SET CHARACTER_SET_CLIENT = utf8mb4;
USE virat_gyankosh;

-- ============================================================================
-- DROP EXISTING TABLE (Idempotent)
-- ============================================================================
DROP TABLE IF EXISTS note_templates;

-- ============================================================================
-- CREATE note_templates TABLE
-- ============================================================================
CREATE TABLE note_templates (
  -- -------------------------------------------------------------------------
  -- PRIMARY KEY
  -- -------------------------------------------------------------------------
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID for the template',
  
  -- -------------------------------------------------------------------------
  -- OWNERSHIP
  -- -------------------------------------------------------------------------
  clerk_id VARCHAR(255) COMMENT 'Creator of the template (NULL for system templates)',
  
  -- -------------------------------------------------------------------------
  -- TEMPLATE CONTENT
  -- -------------------------------------------------------------------------
  name VARCHAR(200) NOT NULL COMMENT 'Template name (e.g., "Lab Report", "Essay Outline")',
  description TEXT COMMENT 'Description of what the template is for',
  content_template TEXT NOT NULL COMMENT 'Template content with placeholders (markdown format)',
  
  -- -------------------------------------------------------------------------
  -- CATEGORIZATION
  -- -------------------------------------------------------------------------
  subject VARCHAR(100) COMMENT 'Subject this template is designed for',
  category VARCHAR(50) COMMENT 'Template category (e.g., "lab_report", "essay", "study_guide")',
  tags JSON COMMENT 'Array of tags for categorization',
  
  -- -------------------------------------------------------------------------
  -- VISIBILITY & SHARING
  -- -------------------------------------------------------------------------
  is_public BOOLEAN DEFAULT FALSE COMMENT 'Whether template is available to all users',
  is_system BOOLEAN DEFAULT FALSE COMMENT 'System-provided template (cannot be deleted by users)',
  
  -- -------------------------------------------------------------------------
  -- USAGE TRACKING
  -- -------------------------------------------------------------------------
  usage_count INT DEFAULT 0 COMMENT 'Number of times this template was used',
  
  -- -------------------------------------------------------------------------
  -- PREVIEW
  -- -------------------------------------------------------------------------
  thumbnail_url VARCHAR(500) COMMENT 'URL to template preview image',
  
  -- -------------------------------------------------------------------------
  -- TIMESTAMPS
  -- -------------------------------------------------------------------------
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When the template was created',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification time',
  
  -- -------------------------------------------------------------------------
  -- INDEXES FOR PERFORMANCE
  -- -------------------------------------------------------------------------
  INDEX idx_clerk_id (clerk_id) COMMENT 'Find templates by creator',
  INDEX idx_subject (subject) COMMENT 'Filter by subject',
  INDEX idx_category (category) COMMENT 'Filter by category',
  INDEX idx_is_public (is_public) COMMENT 'Filter public templates',
  INDEX idx_is_system (is_system) COMMENT 'Filter system templates',
  INDEX idx_usage_count (usage_count) COMMENT 'Sort by popularity',
  INDEX idx_composite_public_subject (is_public, subject) COMMENT 'Common query pattern'
  
) ENGINE=InnoDB 
  DEFAULT CHARSET=utf8mb4 
  COLLATE=utf8mb4_unicode_ci 
  COMMENT='Reusable note templates for quick note creation';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
SELECT 
  TABLE_NAME,
  ENGINE,
  TABLE_ROWS,
  CREATE_TIME,
  TABLE_COLLATION,
  TABLE_COMMENT
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'virat_gyankosh' 
  AND TABLE_NAME = 'note_templates';

DESCRIBE note_templates;
SHOW INDEX FROM note_templates;

-- ============================================================================
-- SAMPLE SYSTEM TEMPLATES (COMMENTED OUT)
-- ============================================================================
/*
-- Cornell Notes Template
INSERT INTO note_templates (
  id,
  clerk_id,
  name,
  description,
  content_template,
  subject,
  category,
  tags,
  is_public,
  is_system
) VALUES (
  UUID(),
  NULL,
  'Cornell Notes',
  'Classic Cornell note-taking system with cues, notes, and summary sections',
  '# {{TOPIC_NAME}}

## Cues / Questions
- 

## Notes
- 

## Summary
',
  NULL,
  'study_guide',
  JSON_ARRAY('cornell', 'study', 'notes'),
  TRUE,
  TRUE
);

-- Lab Report Template
INSERT INTO note_templates (
  id,
  clerk_id,
  name,
  description,
  content_template,
  subject,
  category,
  tags,
  is_public,
  is_system
) VALUES (
  UUID(),
  NULL,
  'Science Lab Report',
  'Standard lab report format for science experiments',
  '# Lab Report: {{EXPERIMENT_NAME}}

## Objective
{{OBJECTIVE}}

## Hypothesis
{{HYPOTHESIS}}

## Materials
- 

## Procedure
1. 

## Observations
| Trial | Observation | Measurement |
|-------|-------------|-------------|
| 1     |             |             |

## Results
{{RESULTS}}

## Conclusion
{{CONCLUSION}}

## Discussion
{{DISCUSSION}}
',
  'Science',
  'lab_report',
  JSON_ARRAY('lab', 'experiment', 'science'),
  TRUE,
  TRUE
);

-- Essay Outline Template
INSERT INTO note_templates (
  id,
  clerk_id,
  name,
  description,
  content_template,
  subject,
  category,
  tags,
  is_public,
  is_system
) VALUES (
  UUID(),
  NULL,
  'Essay Outline',
  '5-paragraph essay structure with introduction, body, and conclusion',
  '# Essay: {{ESSAY_TITLE}}

## I. Introduction
- Hook: {{HOOK}}
- Background: {{BACKGROUND}}
- Thesis Statement: {{THESIS}}

## II. Body Paragraph 1
- Topic Sentence: {{TOPIC_1}}
- Supporting Evidence:
  - 
- Analysis:
  - 

## III. Body Paragraph 2
- Topic Sentence: {{TOPIC_2}}
- Supporting Evidence:
  - 
- Analysis:
  - 

## IV. Body Paragraph 3
- Topic Sentence: {{TOPIC_3}}
- Supporting Evidence:
  - 
- Analysis:
  - 

## V. Conclusion
- Restate Thesis: {{RESTATE_THESIS}}
- Summary of Main Points:
  - 
- Closing Thought: {{CLOSING}}
',
  'English',
  'essay',
  JSON_ARRAY('essay', 'writing', 'outline'),
  TRUE,
  TRUE
);

-- Math Problem Solving Template
INSERT INTO note_templates (
  id,
  clerk_id,
  name,
  description,
  content_template,
  subject,
  category,
  tags,
  is_public,
  is_system
) VALUES (
  UUID(),
  NULL,
  'Math Problem Solving',
  'Structured approach to solving math problems',
  '# Problem: {{PROBLEM_TITLE}}

## Given Information
- 

## What to Find
- 

## Formula/Concept
{{FORMULA}}

## Solution Steps
1. 

## Answer
{{ANSWER}}

## Verification
{{VERIFICATION}}
',
  'Mathematics',
  'problem_solving',
  JSON_ARRAY('math', 'problem', 'solution'),
  TRUE,
  TRUE
);
*/

-- ============================================================================
-- USEFUL QUERIES (COMMENTED OUT)
-- ============================================================================
/*
-- Find all public templates for a subject
SELECT *
FROM note_templates
WHERE is_public = TRUE
  AND subject = 'Science'
ORDER BY usage_count DESC;

-- Find most popular templates
SELECT 
  name,
  subject,
  category,
  usage_count
FROM note_templates
WHERE is_public = TRUE
ORDER BY usage_count DESC
LIMIT 10;

-- Increment usage count when template is used
UPDATE note_templates
SET usage_count = usage_count + 1
WHERE id = 'template-uuid-123';
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
SELECT '✅ Migration completed successfully! note_templates table created.' AS status;

