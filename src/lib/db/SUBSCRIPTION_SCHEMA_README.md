# AI Tutor Subscription Schema

## Overview

This schema implements a **Freemium + Tiered Subscriptions** monetization model for the DigiClassroom AI Tutor feature.

## Database Tables

### 1. `subscription_plans`
**Purpose:** Catalog of available pricing tiers and their features

**Key Fields:**
- `plan_code`: Unique identifier (e.g., 'FREE_TRIAL', 'BASIC_CBSE', 'PRO_CBSE', 'PREMIUM')
- `plan_type`: Type of plan (free_trial, board_access, class_access, full_access)
- `board`: Which board(s) are included (CBSE, ICSE, STATE_BOARD, ALL)
- `class_access_type`: Single class or all classes
- `monthly_price`: Price in INR
- `daily_question_limit`: Maximum questions per day

### 2. `user_subscriptions`
**Purpose:** Tracks individual user subscriptions and purchases

**Key Fields:**
- `user_id`, `clerk_id`: User identifiers
- `subscription_status`: active, expired, cancelled, trial, pending
- `purchased_board`: Which board user has access to
- `purchased_class`: Which class user has access to (NULL = all classes)
- `purchased_subjects`: JSON array of subjects (NULL/empty = all subjects)
- `daily_question_limit`: User's daily quota
- `expiry_date`: When subscription expires
- `payment_status`: paid, pending, failed, refunded

### 3. `ai_tutor_usage`
**Purpose:** Tracks daily question quota and usage analytics

**Key Fields:**
- `usage_date`: Date of usage (unique per user per day)
- `questions_asked`: Number of questions asked today
- `daily_limit`: User's daily limit
- `questions_log`: JSON array of question metadata for analytics

**Important:** This table enforces the daily question limit. Records are created/updated on each question.

### 4. `free_trials`
**Purpose:** Manages free trial users and conversion tracking

**Key Fields:**
- `trial_type`: questions_based, time_based, or hybrid
- `trial_questions_limit`: Total questions allowed (default: 10)
- `trial_questions_used`: Questions used so far
- `trial_days_limit`: Trial duration in days (default: 7)
- `trial_status`: active, expired, converted, cancelled
- `converted_to_paid`: Whether user upgraded to paid plan

### 5. `subscription_history`
**Purpose:** Audit log for subscription changes

**Key Fields:**
- `action`: created, renewed, upgraded, downgraded, cancelled, expired, refunded
- `old_plan_code`, `new_plan_code`: Plan transition tracking
- `amount`: Transaction amount
- `transaction_id`: Payment gateway transaction ID

### 6. `quota_alerts`
**Purpose:** Tracks when users hit quota limits (for marketing/notifications)

**Key Fields:**
- `alert_type`: quota_50_percent, quota_80_percent, quota_exhausted, trial_expiring, subscription_expiring
- `notification_sent`: Whether notification was sent
- `user_upgraded`: Whether user upgraded after alert

## Pricing Tiers

### Free Trial
- **Price:** ₹0
- **Duration:** 7 days or 10 questions (whichever comes first)
- **Access:** All boards, all classes, all subjects
- **Limit:** 10 questions total (not per day)

### Basic Tier
- **Price:** ₹249/month
- **Access:** 1 board (CBSE/ICSE/State), 1 class, all subjects
- **Limit:** 30 questions per day

### Pro Tier
- **Price:** ₹499/month
- **Access:** 1 board, all classes (1-12), all subjects
- **Limit:** 60 questions per day
- **Badge:** "Most Popular"

### Premium Tier
- **Price:** ₹999/month
- **Access:** All boards, all classes, all subjects
- **Limit:** 150 questions per day
- **Badge:** "Best Value"

## Migration Instructions

### Step 1: Run the Migration Script

```bash
# From the project root directory
npx tsx src/lib/db/subscription-migrate.ts
```

### Step 2: Verify Tables Created

```sql
SHOW TABLES LIKE 'subscription%';
SHOW TABLES LIKE 'ai_tutor_usage';
SHOW TABLES LIKE 'free_trials';
SHOW TABLES LIKE 'quota_alerts';
```

### Step 3: Verify Seed Data

```sql
SELECT plan_code, display_name, monthly_price, daily_question_limit 
FROM subscription_plans 
ORDER BY display_order;
```

Expected output:
```
+-------------+-------------------------+---------------+----------------------+
| plan_code   | display_name            | monthly_price | daily_question_limit |
+-------------+-------------------------+---------------+----------------------+
| FREE_TRIAL  | Free Trial              |          0.00 |                   10 |
| BASIC_CBSE  | Basic - CBSE            |        249.00 |                   30 |
| PRO_CBSE    | Pro - CBSE All Classes  |        499.00 |                   60 |
| PREMIUM     | Premium - All Access    |        999.00 |                  150 |
+-------------+-------------------------+---------------+----------------------+
```

## Usage Examples

### Check User Subscription

```sql
SELECT 
    us.plan_code,
    us.subscription_status,
    us.purchased_board,
    us.purchased_class,
    us.daily_question_limit,
    us.expiry_date
FROM user_subscriptions us
WHERE us.clerk_id = 'user_xxx' 
  AND us.subscription_status = 'active'
  AND us.expiry_date > NOW()
ORDER BY us.expiry_date DESC
LIMIT 1;
```

### Check Daily Usage

```sql
SELECT 
    questions_asked,
    daily_limit,
    (daily_limit - questions_asked) as remaining
FROM ai_tutor_usage
WHERE user_id = 'user_xxx' 
  AND usage_date = CURDATE();
```

### Check Free Trial Status

```sql
SELECT 
    trial_questions_used,
    trial_questions_limit,
    (trial_questions_limit - trial_questions_used) as remaining,
    trial_status,
    trial_end_date
FROM free_trials
WHERE clerk_id = 'user_xxx';
```

## Daily Quota Reset

The daily quota automatically resets because:
1. Each day gets a new record in `ai_tutor_usage` (unique constraint on `user_id` + `usage_date`)
2. When a new day starts, no record exists for that date
3. The service creates a new record with `questions_asked = 1` on first question

**No cron job needed!** The reset is implicit based on the date.

## Free Trial Logic

1. **On User Signup:** Create record in `free_trials` table
   - `trial_questions_limit = 10`
   - `trial_days_limit = 7`
   - `trial_end_date = NOW() + 7 days`
   - `trial_status = 'active'`

2. **On Each Question:** 
   - Check if trial is active and not expired
   - Increment `trial_questions_used`
   - If `trial_questions_used >= trial_questions_limit`, set `trial_status = 'expired'`

3. **On Purchase:**
   - Set `converted_to_paid = TRUE`
   - Set `trial_status = 'converted'`
   - Set `conversion_date = NOW()`
   - Create record in `user_subscriptions`

## Access Control Logic

### Board Access
```
User can access board IF:
  - subscription_status = 'active' AND
  - expiry_date > NOW() AND
  - (purchased_board = requested_board OR purchased_board = 'ALL')
```

### Class Access
```
User can access class IF:
  - Has board access AND
  - (purchased_class = requested_class OR purchased_class IS NULL)
```

### Subject Access
```
User can access subject IF:
  - Has class access AND
  - (purchased_subjects IS NULL OR purchased_subjects = '[]' OR requested_subject IN purchased_subjects)
```

### Question Quota
```
User can ask question IF:
  - Has subject access AND
  - (questions_asked_today < daily_limit)
```

## Environment Variables Required

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=virat_gyankosh
```

## Next Steps

After running this migration:

1. ✅ **Phase 1 Complete:** Database schema is ready
2. ⏭️ **Phase 2:** Create `SubscriptionValidationService`
3. ⏭️ **Phase 3:** Modify API routes to add validation
4. ⏭️ **Phase 4:** Update frontend to show quota and restrictions
5. ⏭️ **Phase 5:** Integrate payment gateway (Razorpay/Stripe)

## Rollback Instructions

If you need to rollback this migration:

```sql
DROP TABLE IF EXISTS quota_alerts;
DROP TABLE IF EXISTS subscription_history;
DROP TABLE IF EXISTS free_trials;
DROP TABLE IF EXISTS ai_tutor_usage;
DROP TABLE IF EXISTS user_subscriptions;
DROP TABLE IF EXISTS subscription_plans;
```

**⚠️ Warning:** This will delete all subscription data. Only use in development!

## Support

For questions or issues, contact the development team.

