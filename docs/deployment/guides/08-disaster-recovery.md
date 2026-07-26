# Step 8: Disaster Recovery & Backup Procedures

## Overview
Comprehensive backup and recovery strategy for DigiClassroom Pro ensuring data safety and business continuity.

---

## 8.1 Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** (Recovery Time) | < 4 hours | Max time to restore service |
| **RPO** (Recovery Point) | < 1 hour | Max data loss acceptable |
| **Availability** | 99.9% | ~8.7 hours downtime/year |

---

## 8.2 Backup Strategy by Service

### PlanetScale (MySQL)

**Built-in Features:**
- ✅ Automatic daily backups (retained 7 days)
- ✅ Point-in-time recovery
- ✅ Branch-based recovery

**Manual Backup Script:**
```bash
#!/bin/bash
# scripts/backup-planetscale.sh

DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_DIR="./backups/mysql"

# Create backup using pscale
pscale database dump virat-gyankosh main --output "$BACKUP_DIR/dump_$DATE"

# Compress
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" "$BACKUP_DIR/dump_$DATE"

# Upload to S3/R2
aws s3 cp "$BACKUP_DIR/backup_$DATE.tar.gz" s3://digiclassroom-backups/mysql/

# Cleanup local (keep last 3)
ls -t $BACKUP_DIR/*.tar.gz | tail -n +4 | xargs rm -f

echo "✅ MySQL backup completed: backup_$DATE.tar.gz"
```

**Recovery:**
```bash
# Restore from branch
pscale branch create virat-gyankosh recovery-branch --restore <timestamp>

# Or import dump
pscale database restore virat-gyankosh ./backups/mysql/dump_2026-01-18/
```

---

### Qdrant Cloud (Vectors)

**Snapshot Strategy:**
```bash
#!/bin/bash
# scripts/backup-qdrant.sh

DATE=$(date +%Y-%m-%d_%H-%M)
QDRANT_URL="https://your-cluster.qdrant.io:6333"
API_KEY="your-api-key"

# Create snapshot
SNAPSHOT=$(curl -s -X POST "$QDRANT_URL/collections/ncert-books-enhanced/snapshots" \
  -H "api-key: $API_KEY" | jq -r '.result.name')

# Download snapshot
curl -o "./backups/qdrant/snapshot_$DATE.snapshot" \
  "$QDRANT_URL/collections/ncert-books-enhanced/snapshots/$SNAPSHOT/download" \
  -H "api-key: $API_KEY"

# Upload to cloud storage
aws s3 cp "./backups/qdrant/snapshot_$DATE.snapshot" s3://digiclassroom-backups/qdrant/

echo "✅ Qdrant backup completed: $SNAPSHOT"
```

**Recovery:**
```bash
# Delete corrupted collection (if needed)
curl -X DELETE "$QDRANT_URL/collections/ncert-books-enhanced" \
  -H "api-key: $API_KEY"

# Restore from snapshot
curl -X PUT "$QDRANT_URL/collections/ncert-books-enhanced/snapshots/recover" \
  -H "api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"location": "s3://digiclassroom-backups/qdrant/snapshot_2026-01-18.snapshot"}'
```

---

### Upstash Redis (Cache)

**Note:** Cache is transient. Focus on fast rebuild, not backup.

```typescript
// src/lib/cache/rebuild.ts
export async function rebuildCache() {
  // Clear all keys
  await redis.flushall();
  
  // Rebuild critical caches
  await warmupPopularQuestions();
  await warmupUserSessions();
  
  console.log('✅ Cache rebuilt');
}

async function warmupPopularQuestions() {
  // Fetch top 100 questions from analytics
  const popular = await db.query(`
    SELECT question, answer FROM cached_answers 
    ORDER BY hit_count DESC LIMIT 100
  `);
  
  for (const q of popular) {
    await redis.setex(`ai:popular:${hash(q.question)}`, 86400, q.answer);
  }
}
```

---

## 8.3 Automated Backup Schedule

```yaml
# .github/workflows/backup.yml
name: Scheduled Backups

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM IST (8:30 PM UTC)
  workflow_dispatch:

jobs:
  backup-mysql:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install pscale
        run: |
          curl -s https://api.github.com/repos/planetscale/cli/releases/latest \
            | grep "pscale_.*_linux_amd64.deb" \
            | cut -d : -f 2,3 | tr -d \" | wget -qi - -O pscale.deb
          sudo dpkg -i pscale.deb
      
      - name: Backup MySQL
        env:
          PLANETSCALE_SERVICE_TOKEN: ${{ secrets.PLANETSCALE_TOKEN }}
        run: |
          pscale database dump virat-gyankosh main --output ./backup
          tar -czf mysql-backup-$(date +%Y%m%d).tar.gz ./backup
      
      - name: Upload to S3
        uses: jakejarvis/s3-sync-action@master
        with:
          args: --exclude '*' --include '*.tar.gz'
        env:
          AWS_S3_BUCKET: digiclassroom-backups
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_KEY }}
          SOURCE_DIR: './'
          DEST_DIR: 'mysql/'

  backup-qdrant:
    runs-on: ubuntu-latest
    steps:
      - name: Create Qdrant Snapshot
        run: |
          curl -X POST "${{ secrets.QDRANT_URL }}/collections/ncert-books-enhanced/snapshots" \
            -H "api-key: ${{ secrets.QDRANT_API_KEY }}"
```

---

## 8.4 Incident Response Playbook

### Severity Levels

| Level | Impact | Response Time | Examples |
|-------|--------|---------------|----------|
| **P1** | Service down | < 15 min | Database unreachable, auth failure |
| **P2** | Major degradation | < 1 hour | AI responses slow, partial outage |
| **P3** | Minor issue | < 4 hours | Single feature broken |
| **P4** | Low impact | < 24 hours | UI glitches, non-critical bugs |

### Response Procedures

#### P1: Complete Outage
```
1. CHECK: Vercel status page (vercel.com/status)
2. CHECK: PlanetScale status (planetscale.com/status)
3. CHECK: Qdrant status (status.qdrant.io)
4. IF external: Wait + communicate to users
5. IF our code:
   a. Rollback: vercel rollback
   b. Check logs: vercel logs --follow
   c. Fix and redeploy
```

#### Database Recovery
```bash
# 1. Identify issue scope
pscale database show virat-gyankosh

# 2. Create recovery branch from last good state
pscale branch create virat-gyankosh recovery --restore 2026-01-18T00:00:00Z

# 3. Verify data integrity
pscale shell virat-gyankosh recovery
> SELECT COUNT(*) FROM users;
> SELECT COUNT(*) FROM chat_messages;

# 4. Promote recovery branch
pscale deploy-request create virat-gyankosh recovery --into main
```

---

## 8.5 Monitoring & Alerts

### Uptime Monitoring (Free Options)

| Service | Features | Cost |
|---------|----------|------|
| [UptimeRobot](https://uptimerobot.com) | 50 monitors, 5-min checks | Free |
| [Better Uptime](https://betteruptime.com) | Status page, alerts | Free tier |
| [Checkly](https://checklyhq.com) | API monitoring | Free tier |

### Configure Alerts:
```
Endpoints to monitor:
- https://your-domain.com/api/health (main app)
- https://your-domain.com/api/trpc/health (API)

Alert channels:
- Email (primary)
- SMS (P1 only)
- Slack/Discord webhook
```

---

## 8.6 Data Export for Compliance

```typescript
// scripts/export-user-data.ts
// GDPR/Data portability compliance

export async function exportUserData(userId: string) {
  const userData = {
    profile: await db.query('SELECT * FROM users WHERE id = ?', [userId]),
    notes: await db.query('SELECT * FROM user_notes WHERE user_id = ?', [userId]),
    chatHistory: await db.query('SELECT * FROM chat_messages cm JOIN chat_sessions cs ON cm.session_id = cs.id WHERE cs.user_id = ?', [userId]),
    quizResults: await db.query('SELECT * FROM quiz_sessions WHERE user_id = ?', [userId]),
    progress: await db.query('SELECT * FROM learning_progress WHERE user_id = ?', [userId]),
  };
  
  return JSON.stringify(userData, null, 2);
}
```

---

## ✅ Disaster Recovery Checklist

- [ ] Daily MySQL backups automated
- [ ] Weekly Qdrant snapshots scheduled
- [ ] Backup verification tested monthly
- [ ] Recovery procedure documented
- [ ] Team trained on incident response
- [ ] Uptime monitoring configured
- [ ] Alert channels set up
- [ ] Status page created

---

## Next Step
→ [Step 9: Vector Database Freshness](./09-vector-freshness.md)
