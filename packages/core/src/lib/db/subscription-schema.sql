-- AI Tutor Subscription & Monetization Schema
-- Freemium + Tiered Subscriptions Model for DigiClassroom
-- Version: 1.0
-- Date: 2025-10-25

-- ============================================================================
-- TABLE 1: SUBSCRIPTION PLANS CATALOG
-- ============================================================================
-- Defines available pricing tiers and their features

CREATE TABLE IF NOT EXISTS subscription_plans (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Plan Details
    plan_name VARCHAR(100) NOT NULL UNIQUE,
    plan_code VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'FREE_TRIAL', 'BASIC', 'PRO', 'PREMIUM'
    plan_type ENUM('free_trial', 'board_access', 'class_access', 'subject_bundle', 'full_access') NOT NULL,
    
    -- Content Scope
    board ENUM('CBSE', 'ICSE', 'STATE_BOARD', 'ALL') NOT NULL,
    class_level TINYINT NULL CHECK (class_level >= 1 AND class_level <= 12 OR class_level IS NULL),
    class_access_type ENUM('single', 'all') DEFAULT 'single', -- single class or all classes
    included_subjects JSON NULL, -- Array of subjects, NULL = all subjects
    
    -- Pricing
    monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    quarterly_price DECIMAL(10,2) NULL,
    yearly_price DECIMAL(10,2) NULL,
    
    -- Limits & Features
    daily_question_limit INT DEFAULT 30,
    features JSON NULL, -- Additional features: {"priority_support": true, "downloadable_materials": true, "personalized_learning": false}
    
    -- Display & Marketing
    display_name VARCHAR(150) NOT NULL, -- e.g., "Basic - CBSE Class 10"
    description TEXT NULL,
    highlight_text VARCHAR(255) NULL, -- e.g., "Most Popular", "Best Value"
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_plan_type (plan_type),
    INDEX idx_board_class (board, class_level),
    INDEX idx_active (is_active),
    INDEX idx_display_order (display_order)
);

-- ============================================================================
-- TABLE 2: USER SUBSCRIPTIONS
-- ============================================================================
-- Tracks individual user subscriptions and purchases

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(255) NOT NULL,
    clerk_id VARCHAR(255) NOT NULL,
    
    -- Subscription Details
    subscription_plan_id VARCHAR(36) NULL, -- FK to subscription_plans
    subscription_type ENUM('free_trial', 'board_access', 'class_access', 'subject_bundle', 'full_access') NOT NULL,
    subscription_status ENUM('active', 'expired', 'cancelled', 'trial', 'pending') NOT NULL DEFAULT 'trial',
    
    -- Content Access (denormalized for performance)
    purchased_board ENUM('CBSE', 'ICSE', 'STATE_BOARD', 'ALL') NULL,
    purchased_class TINYINT NULL CHECK (purchased_class >= 1 AND purchased_class <= 12 OR purchased_class IS NULL),
    class_access_type ENUM('single', 'all') DEFAULT 'single',
    purchased_subjects JSON NULL, -- Array of subject names, NULL or empty = all subjects
    
    -- Pricing & Billing
    plan_name VARCHAR(100) NOT NULL, -- e.g., "Basic - CBSE Class 10"
    plan_code VARCHAR(50) NOT NULL, -- e.g., 'BASIC', 'PRO', 'PREMIUM'
    monthly_price DECIMAL(10,2) NOT NULL,
    billing_cycle ENUM('monthly', 'quarterly', 'yearly') DEFAULT 'monthly',
    
    -- Limits
    daily_question_limit INT DEFAULT 30,
    
    -- Dates
    start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expiry_date TIMESTAMP NOT NULL,
    last_payment_date TIMESTAMP NULL,
    next_billing_date TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    
    -- Payment
    payment_status ENUM('paid', 'pending', 'failed', 'refunded') DEFAULT 'pending',
    payment_gateway VARCHAR(50) NULL, -- 'razorpay', 'stripe', 'manual', etc.
    transaction_id VARCHAR(255) NULL,
    payment_metadata JSON NULL, -- Store payment gateway response
    
    -- Auto-renewal
    auto_renew BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_status (user_id, subscription_status),
    INDEX idx_clerk_id (clerk_id),
    INDEX idx_expiry (expiry_date),
    INDEX idx_plan_code (plan_code),
    INDEX idx_payment_status (payment_status),
    INDEX idx_next_billing (next_billing_date),
    
    FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL
);

-- ============================================================================
-- TABLE 3: AI TUTOR USAGE TRACKING
-- ============================================================================
-- Tracks daily question quota and usage analytics

CREATE TABLE IF NOT EXISTS ai_tutor_usage (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(255) NOT NULL,
    clerk_id VARCHAR(255) NOT NULL,
    
    -- Usage Tracking
    usage_date DATE NOT NULL,
    questions_asked INT DEFAULT 0,
    daily_limit INT DEFAULT 30,
    
    -- Question Details (for analytics)
    questions_log JSON NULL, -- Array of {timestamp, subject, board, class, menu_type, tokens_used}
    
    -- Analytics
    total_tokens_used INT DEFAULT 0,
    avg_response_time_ms INT DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_date (user_id, usage_date),
    INDEX idx_user_date (user_id, usage_date),
    INDEX idx_clerk_date (clerk_id, usage_date),
    INDEX idx_usage_date (usage_date)
);

-- ============================================================================
-- TABLE 4: FREE TRIALS
-- ============================================================================
-- Manages free trial users and conversion tracking

CREATE TABLE IF NOT EXISTS free_trials (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    clerk_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Trial Details
    trial_type ENUM('questions_based', 'time_based', 'hybrid') DEFAULT 'hybrid',
    trial_questions_limit INT DEFAULT 10, -- 10 free questions
    trial_questions_used INT DEFAULT 0,
    trial_days_limit INT DEFAULT 7, -- 7 days trial
    
    -- Dates
    trial_start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trial_end_date TIMESTAMP NOT NULL,
    trial_status ENUM('active', 'expired', 'converted', 'cancelled') DEFAULT 'active',
    
    -- Conversion Tracking
    converted_to_paid BOOLEAN DEFAULT FALSE,
    conversion_date TIMESTAMP NULL,
    converted_plan_code VARCHAR(50) NULL,
    
    -- Engagement Metrics
    first_question_at TIMESTAMP NULL,
    last_question_at TIMESTAMP NULL,
    total_sessions INT DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_status (user_id, trial_status),
    INDEX idx_clerk_status (clerk_id, trial_status),
    INDEX idx_expiry (trial_end_date),
    INDEX idx_converted (converted_to_paid)
);

-- ============================================================================
-- TABLE 5: SUBSCRIPTION HISTORY
-- ============================================================================
-- Audit log for subscription changes

CREATE TABLE IF NOT EXISTS subscription_history (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(255) NOT NULL,
    clerk_id VARCHAR(255) NOT NULL,
    subscription_id VARCHAR(36) NOT NULL,
    
    -- Change Details
    action ENUM('created', 'renewed', 'upgraded', 'downgraded', 'cancelled', 'expired', 'refunded') NOT NULL,
    old_plan_code VARCHAR(50) NULL,
    new_plan_code VARCHAR(50) NULL,
    old_status VARCHAR(50) NULL,
    new_status VARCHAR(50) NULL,
    
    -- Financial
    amount DECIMAL(10,2) NULL,
    transaction_id VARCHAR(255) NULL,
    
    -- Metadata
    reason TEXT NULL,
    changed_by VARCHAR(255) NULL, -- user_id or 'system' or 'admin'
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_subscription_id (subscription_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE 6: QUOTA ALERTS
-- ============================================================================
-- Tracks when users hit quota limits (for marketing/notifications)

CREATE TABLE IF NOT EXISTS quota_alerts (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(255) NOT NULL,
    clerk_id VARCHAR(255) NOT NULL,
    
    -- Alert Details
    alert_type ENUM('quota_50_percent', 'quota_80_percent', 'quota_exhausted', 'trial_expiring', 'subscription_expiring') NOT NULL,
    alert_date DATE NOT NULL,
    questions_remaining INT DEFAULT 0,
    
    -- Notification Status
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP NULL,
    
    -- User Action
    user_upgraded BOOLEAN DEFAULT FALSE,
    upgraded_at TIMESTAMP NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_alert (user_id, alert_type, alert_date),
    INDEX idx_notification_sent (notification_sent),
    INDEX idx_user_upgraded (user_upgraded)
);

-- ============================================================================
-- SEED DATA: DEFAULT SUBSCRIPTION PLANS
-- ============================================================================

-- Free Trial Plan (Updated: 15 questions instead of 10)
INSERT INTO subscription_plans (
    plan_name, plan_code, plan_type, board, class_level, class_access_type,
    monthly_price, daily_question_limit, display_name, description, display_order, is_active
) VALUES (
    'Free Trial', 'FREE_TRIAL', 'free_trial', 'ALL', NULL, 'all',
    0.00, 15, 'Free Trial',
    '15 questions total across all boards, classes, and subjects. Valid for 7 days.',
    0, TRUE
) ON DUPLICATE KEY UPDATE
    daily_question_limit = 15,
    description = '15 questions total across all boards, classes, and subjects. Valid for 7 days.',
    updated_at = CURRENT_TIMESTAMP;

-- Basic Plan (Board-agnostic, single class)
INSERT INTO subscription_plans (
    plan_name, plan_code, plan_type, board, class_level, class_access_type,
    monthly_price, daily_question_limit, display_name, description, display_order, is_active
) VALUES (
    'Basic', 'BASIC', 'class_access', NULL, NULL, 'single',
    249.00, 30, 'Basic',
    '30 questions per day for one board and one class with all subjects included.',
    1, TRUE
) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Keep legacy BASIC_CBSE for backward compatibility (deprecated)
INSERT INTO subscription_plans (
    plan_name, plan_code, plan_type, board, class_level, class_access_type,
    monthly_price, daily_question_limit, display_name, description, display_order, is_active
) VALUES (
    'Basic - CBSE', 'BASIC_CBSE', 'class_access', 'CBSE', NULL, 'single',
    249.00, 30, 'Basic - CBSE',
    '30 questions per day for one CBSE class with all subjects included.',
    1, FALSE
) ON DUPLICATE KEY UPDATE
    is_active = FALSE,
    updated_at = CURRENT_TIMESTAMP;

-- Classic Plan (NEW: 60 questions/day, single board, single class)
INSERT INTO subscription_plans (
    plan_name, plan_code, plan_type, board, class_level, class_access_type,
    monthly_price, daily_question_limit, display_name, description, highlight_text, display_order, is_active, is_featured
) VALUES (
    'Classic', 'CLASSIC', 'class_access', NULL, NULL, 'single',
    499.00, 60, 'Classic',
    '60 questions per day for one board and one class with all subjects included.',
    'Popular', 2, TRUE, TRUE
) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Pro Plan (Updated: 150 questions/day, single board, all classes)
INSERT INTO subscription_plans (
    plan_name, plan_code, plan_type, board, class_level, class_access_type,
    monthly_price, daily_question_limit, display_name, description, highlight_text, display_order, is_active, is_featured
) VALUES (
    'Pro', 'PRO', 'board_access', NULL, NULL, 'all',
    999.00, 150, 'Pro',
    '150 questions per day for one board with all classes (1-12) and all subjects included.',
    'Best Value', 3, TRUE, TRUE
) ON DUPLICATE KEY UPDATE
    daily_question_limit = 150,
    description = '150 questions per day for one board with all classes (1-12) and all subjects included.',
    updated_at = CURRENT_TIMESTAMP;

-- Keep legacy PRO_CBSE for backward compatibility (deprecated)
INSERT INTO subscription_plans (
    plan_name, plan_code, plan_type, board, class_level, class_access_type,
    monthly_price, daily_question_limit, display_name, description, highlight_text, display_order, is_active, is_featured
) VALUES (
    'Pro - CBSE All Classes', 'PRO_CBSE', 'board_access', 'CBSE', NULL, 'all',
    999.00, 150, 'Pro - CBSE All Classes',
    '150 questions per day for all CBSE classes (1-12) with all subjects included.',
    'Most Popular', 2, FALSE, FALSE
) ON DUPLICATE KEY UPDATE
    is_active = FALSE,
    is_featured = FALSE,
    daily_question_limit = 150,
    updated_at = CURRENT_TIMESTAMP;

-- Premium Plan - All Access (DEPRECATED: Set to inactive)
INSERT INTO subscription_plans (
    plan_name, plan_code, plan_type, board, class_level, class_access_type,
    monthly_price, daily_question_limit, display_name, description, highlight_text, display_order, is_active
) VALUES (
    'Premium - All Access', 'PREMIUM', 'full_access', 'ALL', NULL, 'all',
    999.00, 150, 'Premium - All Access',
    '150 questions per day for all boards, all classes, and all subjects. (DEPRECATED)',
    'Best Value', 4, FALSE
) ON DUPLICATE KEY UPDATE
    is_active = FALSE,
    description = '150 questions per day for all boards, all classes, and all subjects. (DEPRECATED)',
    updated_at = CURRENT_TIMESTAMP;

