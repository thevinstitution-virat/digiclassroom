# Step 3: PlanetScale Database Migration

## Overview
Migrate your local MySQL database to PlanetScale's serverless MySQL platform for scalable, maintenance-free database hosting.

---

## 3.1 Create PlanetScale Account

1. Go to [planetscale.com](https://planetscale.com)
2. Sign up with GitHub
3. Create organization (e.g., `digiclassroom`)

---

## 3.2 Create Database

### Via Dashboard:
1. Click **Create a database**
2. **Name**: `virat-gyankosh`
3. **Region**: `ap-south-1` (Mumbai) ← **Critical for Indian users!**
4. **Plan**: Hobby (Free) or Scaler
5. Click **Create database**

### Via CLI:
```powershell
# Install PlanetScale CLI
scoop install pscale

# Or via npm
npm install -g pscale

# Login
pscale auth login

# Create database in Mumbai region
pscale database create virat-gyankosh --region ap-south-1
```

---

## 3.3 Export Local MySQL Data

```powershell
# Export schema and data from local MySQL
cd "J:\DigiClassroom Pro"

# Export schema only (recommended first)
docker exec digiclassroom-mysql mysqldump -u root -prootpassword123 \
  --no-data virat_gyankosh > schema-export.sql

# Export data separately
docker exec digiclassroom-mysql mysqldump -u root -prootpassword123 \
  --no-create-info virat_gyankosh > data-export.sql

# Or full export
docker exec digiclassroom-mysql mysqldump -u root -prootpassword123 \
  virat_gyankosh > full-export.sql
```

---

## 3.4 Prepare Schema for PlanetScale

PlanetScale doesn't support foreign keys. Remove them from schema:

```powershell
# Create a modified schema file
# Remove all FOREIGN KEY constraints
# Keep INDEX definitions

# Use this PowerShell script:
(Get-Content schema-export.sql) `
  -replace 'FOREIGN KEY.*ON DELETE.*,?', '' `
  -replace ',\s*\)', ')' `
  | Set-Content schema-planetscale.sql
```

Or manually edit `schema-export.sql`:
- Remove all `FOREIGN KEY` lines
- Remove all `REFERENCES` clauses
- Keep `INDEX` definitions

---

## 3.5 Import to PlanetScale

### Option A: Via Dashboard
1. Go to Database → Branches → `main`
2. Click **Console**
3. Paste and run schema SQL

### Option B: Via CLI (Recommended)
```powershell
# Create a branch for schema changes
pscale branch create virat-gyankosh schema-update

# Connect to branch
pscale shell virat-gyankosh schema-update

# In the MySQL shell, run schema file
source schema-planetscale.sql

# Exit shell
exit

# Create deploy request
pscale deploy-request create virat-gyankosh schema-update

# Deploy to main
pscale deploy-request deploy virat-gyankosh <deploy-request-number>
```

### Import Data:
```powershell
# Connect to main branch
pscale shell virat-gyankosh main

# Import data
source data-export.sql
```

---

## 3.6 Get Connection String

### For Vercel:
1. Go to Database → Connect → Create password
2. Select **Connect with**: `Prisma` or `Node.js`
3. Copy the connection string

**Format:**
```
mysql://username:password@aws.connect.psdb.cloud/virat-gyankosh?ssl={"rejectUnauthorized":true}
```

### For Local Development:
```powershell
# Use pscale proxy for local connection
pscale connect virat-gyankosh main --port 3309

# Connection string becomes:
# mysql://root@127.0.0.1:3309/virat-gyankosh
```

---

## 3.7 Update Application Configuration

```typescript
// src/lib/db/connection.ts
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
});

export default pool;
```

---

## 3.8 Branching Workflow (Safe Deployments)

PlanetScale uses branches like Git:

```mermaid
graph LR
    Main[main branch<br/>Production] --> Dev[development<br/>Staging]
    Dev --> Feature[feature-x<br/>Testing]
    Feature -->|Deploy Request| Dev
    Dev -->|Deploy Request| Main
```

```powershell
# Create development branch
pscale branch create virat-gyankosh development

# Create feature branch
pscale branch create virat-gyankosh feature-new-table --from development

# Make schema changes on feature branch
pscale shell virat-gyankosh feature-new-table
# Run ALTER TABLE, CREATE TABLE etc.

# Create deploy request to merge
pscale deploy-request create virat-gyankosh feature-new-table --into development

# Review and deploy
pscale deploy-request deploy virat-gyankosh <number>
```

---

## ✅ Verification Checklist

- [ ] PlanetScale account created
- [ ] Database in Mumbai region
- [ ] Schema imported successfully
- [ ] Data migrated
- [ ] Connection string obtained
- [ ] Application tested with PlanetScale
- [ ] Development branch created

---

## 💰 Pricing

| Plan | Price | Includes |
|------|-------|----------|
| Hobby (Free) | ₹0 | 5GB storage, 1B row reads/mo |
| Scaler | ₹2,500/mo | 10GB, 100B reads, production features |
| Team | ₹8,000/mo | 25GB, insights, SOC2 |

---

## Next Step
→ [Step 4: Qdrant Cloud Setup](./04-qdrant-cloud-setup.md)
