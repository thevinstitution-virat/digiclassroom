-- Dictionary Feature Database Schema
-- Migration: 002_dictionary_tables
-- Created: 2025-01-27
-- Description: English-Hindi Dictionary with Amarkosha semantics, gamification, and community features

-- Dictionary Words Table - Core vocabulary storage
CREATE TABLE IF NOT EXISTS dictionary_words (
    id INT PRIMARY KEY AUTO_INCREMENT,
    word VARCHAR(255) NOT NULL UNIQUE,
    pronunciation VARCHAR(255),
    part_of_speech ENUM('noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection') NOT NULL,
    
    -- English definitions and context
    english_definition TEXT NOT NULL,
    english_synonyms JSON DEFAULT '[]',
    english_antonyms JSON DEFAULT '[]',
    
    -- Hindi translations and context
    hindi_translation VARCHAR(500) NOT NULL,
    hindi_synonyms JSON DEFAULT '[]',
    devanagari_script VARCHAR(500),
    
    -- Amarkosha semantic categorization
    amarkosha_category VARCHAR(100),
    semantic_cluster VARCHAR(100),
    etymology TEXT,
    
    -- Usage examples and cultural context
    examples JSON DEFAULT '[]', -- Array of example sentences
    cultural_context TEXT,
    regional_usage JSON DEFAULT '[]', -- Different regional meanings
    
    -- Audio and media
    audio_url VARCHAR(500), -- Cloudflare CDN URL for pronunciation
    audio_accent ENUM('indian', 'british', 'american') DEFAULT 'indian',
    
    -- Difficulty and frequency
    difficulty_level ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'intermediate',
    frequency_rank INT, -- Word frequency ranking
    
    -- Metadata
    source VARCHAR(100) DEFAULT 'system',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_word (word),
    INDEX idx_hindi_translation (hindi_translation),
    INDEX idx_amarkosha_category (amarkosha_category),
    INDEX idx_semantic_cluster (semantic_cluster),
    INDEX idx_difficulty_level (difficulty_level),
    INDEX idx_frequency_rank (frequency_rank),
    FULLTEXT idx_search_content (word, english_definition, hindi_translation, cultural_context)
);

-- User Vocabulary Progress - Spaced repetition and learning tracking
CREATE TABLE IF NOT EXISTS user_vocab_progress (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    clerk_user_id VARCHAR(255) NOT NULL,
    word_id INT NOT NULL,
    
    -- Spaced repetition algorithm (Leitner system with EFactor)
    efactor DECIMAL(3,2) DEFAULT 2.50, -- Ease factor (1.3 to 2.5+)
    interval_days INT DEFAULT 1, -- Days until next review
    repetitions INT DEFAULT 0, -- Number of successful repetitions
    next_due_date DATE NOT NULL,
    last_reviewed TIMESTAMP NULL,
    
    -- Performance tracking
    correct_attempts INT DEFAULT 0,
    total_attempts INT DEFAULT 0,
    accuracy_percentage DECIMAL(5,2) DEFAULT 0.00,
    
    -- Learning status
    status ENUM('new', 'learning', 'review', 'mastered') DEFAULT 'new',
    first_learned_at TIMESTAMP NULL,
    mastered_at TIMESTAMP NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_word (user_id, word_id),
    INDEX idx_user_id (user_id),
    INDEX idx_clerk_user_id (clerk_user_id),
    INDEX idx_word_id (word_id),
    INDEX idx_next_due_date (next_due_date),
    INDEX idx_status (status),
    FOREIGN KEY (word_id) REFERENCES dictionary_words(id) ON DELETE CASCADE
);

-- Community Phrases - User-contributed regional expressions
CREATE TABLE IF NOT EXISTS community_phrases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    word_id INT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    clerk_user_id VARCHAR(255) NOT NULL,
    
    -- Phrase content
    phrase TEXT NOT NULL,
    context TEXT,
    region VARCHAR(100), -- e.g., 'Maharashtra', 'Punjab', 'Tamil Nadu'
    language_variant VARCHAR(50), -- e.g., 'Hinglish', 'Regional Hindi'
    
    -- Community validation
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(255) NULL,
    approved_at TIMESTAMP NULL,
    rejection_reason TEXT NULL,
    
    -- Community engagement
    upvotes INT DEFAULT 0,
    downvotes INT DEFAULT 0,
    reports INT DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_word_id (word_id),
    INDEX idx_user_id (user_id),
    INDEX idx_clerk_user_id (clerk_user_id),
    INDEX idx_region (region),
    INDEX idx_is_approved (is_approved),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (word_id) REFERENCES dictionary_words(id) ON DELETE CASCADE
);

-- Dictionary User Stats - Gamification and achievements
CREATE TABLE IF NOT EXISTS dictionary_user_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    clerk_user_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Learning statistics
    total_words_learned INT DEFAULT 0,
    words_mastered INT DEFAULT 0,
    current_streak_days INT DEFAULT 0,
    longest_streak_days INT DEFAULT 0,
    last_activity_date DATE NULL,
    
    -- Performance metrics
    total_quiz_attempts INT DEFAULT 0,
    correct_quiz_answers INT DEFAULT 0,
    average_accuracy DECIMAL(5,2) DEFAULT 0.00,
    
    -- Gamification
    total_points INT DEFAULT 0,
    level INT DEFAULT 1,
    badges_earned JSON DEFAULT '[]', -- Array of badge IDs
    achievements JSON DEFAULT '[]', -- Array of achievement objects
    
    -- Community contributions
    phrases_contributed INT DEFAULT 0,
    phrases_approved INT DEFAULT 0,
    community_reputation INT DEFAULT 0,
    
    -- Preferences
    daily_goal_words INT DEFAULT 5,
    preferred_difficulty ENUM('beginner', 'intermediate', 'advanced', 'mixed') DEFAULT 'mixed',
    notification_preferences JSON DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_clerk_user_id (clerk_user_id),
    INDEX idx_total_points (total_points),
    INDEX idx_level (level),
    INDEX idx_current_streak (current_streak_days),
    INDEX idx_last_activity (last_activity_date)
);

-- Dictionary Search History - Analytics and personalization
CREATE TABLE IF NOT EXISTS dictionary_search_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    clerk_user_id VARCHAR(255) NOT NULL,
    
    -- Search details
    search_query VARCHAR(255) NOT NULL,
    search_type ENUM('exact', 'fuzzy', 'phonetic', 'semantic') NOT NULL,
    results_count INT DEFAULT 0,
    selected_word_id INT NULL,
    
    -- Context
    search_context ENUM('learning', 'quiz', 'browse', 'community') DEFAULT 'browse',
    device_type ENUM('mobile', 'tablet', 'desktop') DEFAULT 'desktop',
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_clerk_user_id (clerk_user_id),
    INDEX idx_search_query (search_query),
    INDEX idx_selected_word_id (selected_word_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (selected_word_id) REFERENCES dictionary_words(id) ON DELETE SET NULL
);

-- Dictionary Offline Sync - PWA offline-first support
CREATE TABLE IF NOT EXISTS dictionary_offline_sync (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    clerk_user_id VARCHAR(255) NOT NULL,
    
    -- Sync metadata
    sync_version INT DEFAULT 1,
    last_full_sync TIMESTAMP NULL,
    last_incremental_sync TIMESTAMP NULL,
    
    -- Offline data status
    words_synced INT DEFAULT 0,
    audio_files_cached INT DEFAULT 0,
    total_cache_size_mb DECIMAL(8,2) DEFAULT 0.00,
    
    -- Sync preferences
    auto_sync_enabled BOOLEAN DEFAULT TRUE,
    wifi_only_sync BOOLEAN DEFAULT TRUE,
    max_cache_size_mb INT DEFAULT 100,
    
    -- Pending changes (for offline-first)
    pending_progress_updates JSON DEFAULT '[]',
    pending_phrase_submissions JSON DEFAULT '[]',
    pending_search_history JSON DEFAULT '[]',
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_sync (user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_clerk_user_id (clerk_user_id),
    INDEX idx_last_full_sync (last_full_sync)
);
