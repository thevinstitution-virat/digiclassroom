# 📚 Sanchika (संचिका) Database Migrations

This directory contains SQL migration scripts for the Sanchika notes system in DigiClassroom Pro.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Migration Files](#migration-files)
3. [Prerequisites](#prerequisites)
4. [How to Run Migrations](#how-to-run-migrations)
5. [Migration Order](#migration-order)
6. [Verification](#verification)
7. [Rollback](#rollback)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The Sanchika notes system uses MySQL database (`virat_gyankosh`) to store user notes, folders, activity logs, shares, and templates. These migration scripts create the necessary database schema.

**Database:** `virat_gyankosh`  
**Engine:** InnoDB  
**Charset:** utf8mb4_unicode_ci (supports emojis and international characters)

---

## 📁 Migration Files

### ✅ Required Migration

| File | Status | Description |
|------|--------|-------------|
| `create_user_notes_table.sql` | **REQUIRED** | Main notes table - stores all user notes |

### ⚪ Optional Migrations (Future Enhancements)

| File | Status | Description |
|------|--------|-------------|
| `create_note_folders_table.sql` | OPTIONAL | Folder organization system |
| `create_note_activity_log_table.sql` | OPTIONAL | Audit trail and analytics |
| `create_note_shares_table.sql` | OPTIONAL | Note sharing functionality |
| `create_note_templates_table.sql` | OPTIONAL | Reusable note templates |

---

## ✅ Prerequisites

Before running migrations, ensure:

1. **MySQL is running** (Docker container or local installation)
2. **Database exists:** `virat_gyankosh`
3. **You have credentials:** MySQL root password or user with CREATE/ALTER privileges
4. **Docker container name:** Know your MySQL container name (if using Docker)

### Find Your MySQL Container Name

```bash
docker ps | grep mysql
```

Example output:
```
abc123def456   mysql:8.0   "docker-entrypoint.s…"   mysql_container
```

---

## 🚀 How to Run Migrations

### Method 1: Docker Exec (Recommended)

**Step 1:** Navigate to the project root directory
```bash
cd "C:/DigiClassroom Pro"
```

**Step 2:** Run the required migration
```bash
docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/create_user_notes_table.sql
```

**Step 3:** Enter MySQL password when prompted

**Step 4:** (Optional) Run additional migrations
```bash
docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/create_note_folders_table.sql
docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/create_note_activity_log_table.sql
docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/create_note_shares_table.sql
docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/create_note_templates_table.sql
```

---

### Method 2: MySQL CLI (Local Installation)

```bash
mysql -h localhost -P 3306 -u root -p virat_gyankosh < src/lib/db/migrations/create_user_notes_table.sql
```

---

### Method 3: MySQL Workbench / phpMyAdmin

1. Open MySQL Workbench or phpMyAdmin
2. Connect to `virat_gyankosh` database
3. Open the migration file (`create_user_notes_table.sql`)
4. Copy the entire contents
5. Paste into SQL editor
6. Execute the script

---

### Method 4: Interactive MySQL Shell

**Step 1:** Enter MySQL shell
```bash
docker exec -it mysql_container mysql -uroot -p virat_gyankosh
```

**Step 2:** Copy and paste the migration SQL directly into the shell

**Step 3:** Exit when done
```sql
EXIT;
```

---

## 📊 Migration Order

Run migrations in this order to avoid foreign key constraint errors:

```
1. create_user_notes_table.sql        (REQUIRED - Run this first!)
2. create_note_folders_table.sql      (Optional - Adds folder organization)
3. create_note_activity_log_table.sql (Optional - Requires user_notes)
4. create_note_shares_table.sql       (Optional - Requires user_notes)
5. create_note_templates_table.sql    (Optional - Independent)
```

**⚠️ Important:** Always run `create_user_notes_table.sql` first!

---

## ✅ Verification

After running migrations, verify the tables were created successfully:

### Check if table exists

```sql
USE virat_gyankosh;
SHOW TABLES LIKE 'user_notes';
```

### View table structure

```sql
DESCRIBE user_notes;
```

### View indexes

```sql
SHOW INDEX FROM user_notes;
```

### Count rows (should be 0 initially)

```sql
SELECT COUNT(*) FROM user_notes;
```

### Check all Sanchika tables

```sql
SHOW TABLES LIKE 'note%';
```

Expected output:
```
+----------------------------------+
| Tables_in_virat_gyankosh (note%) |
+----------------------------------+
| note_activity_log                |
| note_folders                     |
| note_shares                      |
| note_templates                   |
| user_notes                       |
+----------------------------------+
```

---

## 🔄 Rollback

To remove tables (use with caution!):

```sql
-- Remove all Sanchika tables
DROP TABLE IF EXISTS note_activity_log;
DROP TABLE IF EXISTS note_shares;
DROP TABLE IF EXISTS user_notes;
DROP TABLE IF EXISTS note_folders;
DROP TABLE IF EXISTS note_templates;
```

**⚠️ Warning:** This will delete all data! Only use in development.

---

## 🐛 Troubleshooting

### Error: "Table already exists"

**Solution:** The migration is idempotent. It includes `DROP TABLE IF EXISTS`, so you can safely re-run it.

### Error: "Cannot add foreign key constraint"

**Cause:** Parent table doesn't exist yet.

**Solution:** Run migrations in the correct order (see [Migration Order](#migration-order))

### Error: "Access denied for user"

**Cause:** Insufficient MySQL privileges.

**Solution:** Use root user or a user with CREATE/ALTER privileges:
```bash
docker exec -i mysql_container mysql -uroot -p virat_gyankosh < migration.sql
```

### Error: "Unknown database 'virat_gyankosh'"

**Cause:** Database doesn't exist.

**Solution:** Create the database first:
```sql
CREATE DATABASE virat_gyankosh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Error: "Can't connect to MySQL server"

**Cause:** MySQL container is not running.

**Solution:** Start the MySQL container:
```bash
docker start mysql_container
```

### Error: "No such file or directory"

**Cause:** Wrong path to migration file.

**Solution:** Ensure you're in the project root directory:
```bash
cd "C:/DigiClassroom Pro"
pwd  # Should show: C:/DigiClassroom Pro
```

---

## 📝 Post-Migration Steps

After running the migrations:

1. **Restart the Next.js development server** (if running)
   ```bash
   npm run dev
   ```

2. **Test the Sanchika features:**
   - Navigate to AI Tutor
   - Ask a question
   - Click "Add to Sanchika (संचिका)" button
   - Add a title and tags
   - Save the note
   - Navigate to "Sanchika - Notes" from the sidebar
   - Verify the note appears in the list

3. **Check for errors in the browser console**

4. **Verify database entries:**
   ```sql
   SELECT id, title, subject, created_at FROM user_notes LIMIT 5;
   ```

---

## 🎉 Success!

If you see the verification queries returning table information without errors, the migration was successful!

You can now use the Sanchika notes system with:
- ✅ Create notes from AI Tutor answers
- ✅ Manual note creation
- ✅ Tags management
- ✅ Pin/Favorite/Archive functionality
- ✅ Search and filter notes
- ✅ Rich text editing with auto-save

---

## 📞 Need Help?

If you encounter issues not covered in this guide:

1. Check the MySQL error logs:
   ```bash
   docker logs mysql_container
   ```

2. Verify database connection in your application:
   - Check `src/lib/db/connection.ts`
   - Verify environment variables in `.env.local`

3. Test database connectivity:
   ```bash
   docker exec -it mysql_container mysql -uroot -p -e "SELECT 1;"
   ```

---

**Last Updated:** 2025-11-19  
**Version:** 1.0.0  
**Maintainer:** DigiClassroom Pro Development Team

