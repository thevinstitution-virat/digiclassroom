/**
 * Show all content in Qdrant database
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📚 DATABASE CONTENT VIEWER`);
  console.log(`${'='.repeat(80)}\n`);
  
  const client = new QdrantClient({ url: QDRANT_URL });
  
  // Get all points
  const scrollResult = await client.scroll(COLLECTION_NAME, {
    limit: 100,
    with_payload: true,
    with_vector: false
  });
  
  console.log(`📊 Total chunks in database: ${scrollResult.points.length}\n`);
  
  if (scrollResult.points.length === 0) {
    console.log(`❌ Database is EMPTY - No content uploaded yet!\n`);
    return;
  }
  
  // Show each chunk
  for (let i = 0; i < scrollResult.points.length; i++) {
    const point = scrollResult.points[i];
    const payload = point.payload as any;
    
    console.log(`${'─'.repeat(80)}`);
    console.log(`📄 Chunk #${i + 1}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`ID: ${point.id}`);
    console.log(`Class: ${payload.class || 'N/A'}`);
    console.log(`Subject: ${payload.subject || 'N/A'}`);
    console.log(`Page: ${payload.page || 'N/A'}`);
    console.log(`Book: ${payload.book_title || 'N/A'}`);
    console.log(`Extraction: ${payload.extraction_method || 'N/A'}`);
    console.log(`\n📝 Content (first 200 chars):`);
    console.log(`"${(payload.text || '').substring(0, 200)}..."`);
    console.log();
  }
  
  console.log(`${'='.repeat(80)}\n`);
}

main().catch(console.error);

