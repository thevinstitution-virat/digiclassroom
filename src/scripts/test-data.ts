import { db } from '../db';
import * as schema from '../db/schema';
import crypto from 'crypto';

async function main() {
    console.log("Adding test data...");
    
    const tenantId = 'test-tenant-123';
    const batchId = crypto.randomUUID();

    await db.insert(schema.batches).values({
        id: batchId,
        orgId: tenantId,
        name: "CBSE Class 10 Foundation Batch 2026",
        description: "A complete foundational batch for Class 10 CBSE boards.",
        levelId: "dummy-level-id",
        price: "0.00",
        isActive: true,
    });
    console.log("Created batch:", batchId);

    const users = await db.execute('SELECT id FROM user LIMIT 1');
    const firstUser = ((users[0] as unknown) as any[])[0];
    
    if (firstUser) {
        await db.insert(schema.enrollments).values({
            id: crypto.randomUUID(),
            orgId: tenantId,
            userId: firstUser.id,
            batchId,
            status: "active"
        });
        console.log(`Enrolled user ${firstUser.id} in batch ${batchId}`);
    } else {
        console.log("No users found to enroll");
    }

    console.log("Test data inserted successfully!");
    process.exit(0);
}

main().catch(console.error);
