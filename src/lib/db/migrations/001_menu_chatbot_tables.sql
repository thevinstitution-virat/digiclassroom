-- Menu-Based Chatbot Database Schema
-- Migration: 001_menu_chatbot_tables
-- Created: 2025-01-27

-- Conversations table to track user chat sessions
CREATE TABLE IF NOT EXISTS conversations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    clerk_user_id VARCHAR(255) NOT NULL,
    role ENUM('student', 'teacher', 'parent', 'admin') NOT NULL,
    intent VARCHAR(100) NOT NULL,
    topic VARCHAR(255),
    subject VARCHAR(100),
    class_level VARCHAR(20),
    session_id VARCHAR(255) NOT NULL,
    status ENUM('active', 'completed', 'abandoned') DEFAULT 'active',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_clerk_user_id (clerk_user_id),
    INDEX idx_role (role),
    INDEX idx_intent (intent),
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at),
    INDEX idx_status (status)
);

-- Menu selections table to track user menu interactions
CREATE TABLE IF NOT EXISTS menu_selections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT,
    user_id VARCHAR(255) NOT NULL,
    menu_item_id VARCHAR(100) NOT NULL,
    menu_item_label VARCHAR(255) NOT NULL,
    role ENUM('student', 'teacher', 'parent', 'admin') NOT NULL,
    selection_order INT DEFAULT 1,
    context_data JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_user_id (user_id),
    INDEX idx_menu_item_id (menu_item_id),
    INDEX idx_role (role),
    INDEX idx_timestamp (timestamp)
);



-- Chat messages table for storing conversation history
CREATE TABLE IF NOT EXISTS chat_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    message_type ENUM('user', 'assistant', 'system') NOT NULL,
    content TEXT NOT NULL,
    metadata JSON,
    tokens_used INT,
    response_time_ms INT,
    rag_sources JSON, -- Store RAG citation sources
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_message_type (message_type),
    INDEX idx_timestamp (timestamp)
);

-- User preferences table for personalization
CREATE TABLE IF NOT EXISTS user_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    clerk_user_id VARCHAR(255) NOT NULL UNIQUE,
    preferred_language VARCHAR(10) DEFAULT 'en',
    learning_style ENUM('visual', 'auditory', 'kinesthetic', 'reading') DEFAULT 'visual',
    difficulty_preference ENUM('easy', 'medium', 'hard', 'adaptive') DEFAULT 'adaptive',
    notification_settings JSON,
    ui_preferences JSON,
    accessibility_settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_clerk_user_id (clerk_user_id)
);

-- Analytics events table for tracking user behavior
CREATE TABLE IF NOT EXISTS analytics_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(100) NOT NULL,
    event_action VARCHAR(100) NOT NULL,
    event_label VARCHAR(255),
    event_value DECIMAL(10,2),
    session_id VARCHAR(255),
    page_url VARCHAR(500),
    user_agent TEXT,
    ip_address VARCHAR(45),
    metadata JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_event_category (event_category),
    INDEX idx_session_id (session_id),
    INDEX idx_timestamp (timestamp)
);

-- Performance metrics table for system monitoring
CREATE TABLE IF NOT EXISTS performance_metrics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    metric_type VARCHAR(100) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    unit VARCHAR(20),
    tags JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_metric_type (metric_type),
    INDEX idx_metric_name (metric_name),
    INDEX idx_timestamp (timestamp)
);

-- Create views for common queries
CREATE OR REPLACE VIEW user_conversation_summary AS
SELECT 
    c.user_id,
    c.role,
    COUNT(*) as total_conversations,
    COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_conversations,
    COUNT(CASE WHEN c.status = 'abandoned' THEN 1 END) as abandoned_conversations,
    AVG(TIMESTAMPDIFF(MINUTE, c.created_at, c.completed_at)) as avg_duration_minutes,
    MAX(c.created_at) as last_conversation_date
FROM conversations c
GROUP BY c.user_id, c.role;

CREATE OR REPLACE VIEW daily_menu_usage AS
SELECT 
    DATE(ms.timestamp) as date,
    ms.role,
    ms.menu_item_id,
    ms.menu_item_label,
    COUNT(*) as selection_count,
    COUNT(DISTINCT ms.user_id) as unique_users
FROM menu_selections ms
GROUP BY DATE(ms.timestamp), ms.role, ms.menu_item_id, ms.menu_item_label;

CREATE OR REPLACE VIEW student_progress_summary AS
SELECT 
    pl.user_id,
    pl.subject,
    pl.class_level,
    COUNT(*) as total_interactions,
    AVG(pl.score) as avg_score,
    MAX(pl.score) as best_score,
    SUM(pl.time_spent) as total_time_spent,
    COUNT(DISTINCT pl.topic) as topics_covered,
    MAX(pl.date) as last_activity_date
FROM progress_logs pl
WHERE pl.score IS NOT NULL
GROUP BY pl.user_id, pl.subject, pl.class_level;
