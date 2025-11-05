/**
 * Inspect Chunk Content - Detailed Analysis
 * 
 * This script displays the full content of all geography chunks
 * to understand what was actually extracted from the PDF
 */

import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('📖 GEOGRAPHY TEXTBOOK - FULL CONTENT INSPECTION');
  console.log('='.repeat(100) + '\n');

  const client = new QdrantClient({ url: QDRANT_URL });

  // Fetch all geography chunks
  const allPoints: any[] = [];
  let offset: string | number | null = null;
  
  do {
    const scrollResult = await client.scroll(COLLECTION_NAME, {
      limit: 100,
      with_payload: true,
      with_vector: false,
      offset: offset as any,
      filter: {
        must: [
          {
            key: 'subject',
            match: { value: 'Geography' }
          }
        ]
      }
    });

    allPoints.push(...scrollResult.points);
    offset = scrollResult.next_page_offset || null;
  } while (offset !== null);

  console.log(`Found ${allPoints.length} geography chunks\n`);

  // Sort by page number
  allPoints.sort((a, b) => {
    const pageA = a.payload.page || a.payload.pageNumber || 0;
    const pageB = b.payload.page || b.payload.pageNumber || 0;
    return pageA - pageB;
  });

  // Display each chunk
  for (const point of allPoints) {
    const payload = point.payload as any;
    const page = payload.page || payload.pageNumber || 'Unknown';
    const text = payload.text || '';
    const chapter = payload.chapter || 'Unknown';
    const section = payload.section || payload.section_title || 'Unknown';
    
    console.log('─'.repeat(100));
    console.log(`📄 Page ${page} | Chunk ID: ${point.id}`);
    console.log(`📚 Chapter: ${chapter}`);
    console.log(`📑 Section: ${section}`);
    console.log(`📏 Length: ${text.length} characters`);
    console.log('─'.repeat(100));
    console.log(text);
    console.log('\n');
  }

  console.log('='.repeat(100));
  console.log('✅ Content inspection complete');
  console.log('='.repeat(100) + '\n');
}

main().catch(console.error);

