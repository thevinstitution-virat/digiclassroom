import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });

  const collectionName = process.env.QDRANT_COLLECTION_NAME || 'digiclassroom_vectors';

  console.log(`Creating missing indexes on collection: ${collectionName}`);
  
  const missingIndexes = [
    { field: 'classLevel', type: 'keyword' },
    { field: 'class_level', type: 'keyword' },
    { field: 'board', type: 'keyword' },
    { field: 'medium', type: 'keyword' },
    { field: 'org_id', type: 'keyword' },
    { field: 'filename', type: 'keyword' },
  ];

  for (const index of missingIndexes) {
    try {
      console.log(`Creating index for ${index.field}...`);
      await client.createPayloadIndex(collectionName, {
        field_name: index.field,
        field_schema: index.type,
      });
      console.log(`✅ Index for ${index.field} created.`);
    } catch (e: any) {
      console.log(`⚠️ Failed to create index for ${index.field}: ${e.message}`);
    }
  }
}

main().catch(console.error);
