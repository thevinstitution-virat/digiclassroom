import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function checkDuplicates() {
  const result = await db.execute(sql`
    SELECT user_id, organization_id, COUNT(*) as cnt
    FROM member
    GROUP BY user_id, organization_id
    HAVING cnt > 1;
  `);
  
  console.log("RESULT", JSON.stringify(result[0], null, 2));
  process.exit(0);
}

checkDuplicates().catch(console.error);
