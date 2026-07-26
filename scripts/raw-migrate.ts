import { db, connection } from '../src/db';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS announcements (
        id varchar(36) NOT NULL DEFAULT (UUID()),
        batch_id varchar(36) NOT NULL,
        org_id varchar(36) NOT NULL,
        author_id varchar(36) NOT NULL,
        title varchar(150) NOT NULL,
        body text,
        is_pinned boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT announcements_id PRIMARY KEY(id)
      );
    `);
    
    // Check if index exists before creating
    try {
      await db.execute(sql`CREATE INDEX idx_announcements_batch ON announcements (batch_id);`);
    } catch(e) {}
    try {
      await db.execute(sql`CREATE INDEX idx_announcements_org ON announcements (org_id);`);
    } catch(e) {}
    try {
      await db.execute(sql`ALTER TABLE announcements ADD CONSTRAINT announcements_batch_id_batches_id_fk FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE cascade ON UPDATE no action;`);
    } catch(e) {}

    console.log("Done!");
  } catch (e) {
    console.error(e);
  } finally {
    await connection.end();
  }
}
run();
