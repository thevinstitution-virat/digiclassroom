-- Migration: Add persona column and update role system
-- Date: 2025-01-19
-- Description: Simplify roles to admin/user and add persona for AI response customization

-- Step 1: Add persona column to users table
ALTER TABLE users 
ADD COLUMN persona ENUM('teacher', 'student', 'guardian') NOT NULL DEFAULT 'student';

-- Step 2: Create index on persona for analytics performance
CREATE INDEX idx_user_persona ON users(persona);

-- Step 3: Update existing users based on current role
-- Map existing roles to new persona system
UPDATE users SET persona = 'teacher' WHERE role = 'teacher';
UPDATE users SET persona = 'student' WHERE role = 'student';
UPDATE users SET persona = 'guardian' WHERE role = 'parent';

-- Step 4: Update role column to simplified admin/user system
-- Keep admins as admin, convert all others to user
UPDATE users SET role = 'user' WHERE role IN ('teacher', 'student', 'parent');

-- Step 5: Modify role enum to only include admin and user
ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'user') NOT NULL;

-- Step 6: Update indexes for new role structure
DROP INDEX IF EXISTS idx_tenant_role ON users;
CREATE INDEX idx_tenant_role ON users(tenant_id, role);
CREATE INDEX idx_tenant_persona ON users(tenant_id, persona);

-- Step 7: Add composite index for role and persona queries
CREATE INDEX idx_role_persona ON users(role, persona);

-- Verification queries (commented out for production)
-- SELECT role, persona, COUNT(*) as count FROM users GROUP BY role, persona;
-- SELECT * FROM users WHERE role = 'admin';
-- SELECT * FROM users WHERE role = 'user' AND persona = 'teacher';
