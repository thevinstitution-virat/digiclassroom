/**
 * Detailed Chunk Analysis Script
 * 
 * This script provides detailed analysis of geography book chunks to:
 * 1. Display full text of sample chunks
 * 2. Search for specific keywords from the target paragraphs
 * 3. Analyze the actual content stored in the database
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';

// Keywords from target paragraphs
const KEYWORDS_PARAGRAPH_1 = ['Himachal', 'lesser Himalaya', 'Pir Panjal', 'Dhauladhar', 'Mahabharat', 'Kashmir', 'Kangra', 'Kullu'];
const KEYWORDS_PARAGRAPH_2 = ['Deccan Trap', 'volcanic origin', 'black soil', 'Aravali Hills', 'Peninsular plateau'];

async function analyzeChunks() {
  console.log('🔍 Detailed Chunk Analysis for Geography Book\n');
  console.log('=' .repeat(80));
  
  const client = new QdrantClient({
    url: QDRANT_URL,
  });

  try {
    // Fetch all geography chunks
    console.log('\n📚 Fetching geography chunks...');
    const geographyChunks: any[] = [];
    let offset: string | number | null = null;
    
    do {
      const scrollResult = await client.scroll(COLLECTION_NAME, {
        limit: 100,
        with_payload: true,
        with_vector: false,
        offset: offset as any
      });

      for (const point of scrollResult.points) {
        const payload = point.payload as any;
        const subject = (payload.subject || '').toLowerCase();
        if (subject.includes('geography') || subject.includes('social')) {
          geographyChunks.push({
            id: point.id.toString(),
            payload: payload
          });
        }
      }

      offset = scrollResult.next_page_offset || null;
    } while (offset !== null);

    console.log(`✅ Found ${geographyChunks.length} geography chunks\n`);

    // Search for keywords from Paragraph 1
    console.log('=' .repeat(80));
    console.log('🔍 SEARCHING FOR PARAGRAPH 1 KEYWORDS');
    console.log('=' .repeat(80));
    
    for (const keyword of KEYWORDS_PARAGRAPH_1) {
      console.log(`\n🔎 Searching for: "${keyword}"`);
      let found = false;
      
      for (const chunk of geographyChunks) {
        const text = chunk.payload.text || '';
        if (text.toLowerCase().includes(keyword.toLowerCase())) {
          found = true;
          console.log(`   ✅ FOUND in chunk ${chunk.id}`);
          console.log(`   📄 Page: ${chunk.payload.pageNumber || chunk.payload.page || 'N/A'}`);
          console.log(`   📖 Chapter: ${chunk.payload.chapter || 'Unknown'}`);
          
          // Find the context around the keyword
          const lowerText = text.toLowerCase();
          const keywordIndex = lowerText.indexOf(keyword.toLowerCase());
          const start = Math.max(0, keywordIndex - 100);
          const end = Math.min(text.length, keywordIndex + keyword.length + 100);
          const context = text.substring(start, end);
          console.log(`   📝 Context: ...${context}...`);
          break;
        }
      }
      
      if (!found) {
        console.log(`   ❌ NOT FOUND`);
      }
    }

    // Search for keywords from Paragraph 2
    console.log('\n' + '='.repeat(80));
    console.log('🔍 SEARCHING FOR PARAGRAPH 2 KEYWORDS');
    console.log('=' .repeat(80));
    
    for (const keyword of KEYWORDS_PARAGRAPH_2) {
      console.log(`\n🔎 Searching for: "${keyword}"`);
      let found = false;
      
      for (const chunk of geographyChunks) {
        const text = chunk.payload.text || '';
        if (text.toLowerCase().includes(keyword.toLowerCase())) {
          found = true;
          console.log(`   ✅ FOUND in chunk ${chunk.id}`);
          console.log(`   📄 Page: ${chunk.payload.pageNumber || chunk.payload.page || 'N/A'}`);
          console.log(`   📖 Chapter: ${chunk.payload.chapter || 'Unknown'}`);
          
          // Find the context around the keyword
          const lowerText = text.toLowerCase();
          const keywordIndex = lowerText.indexOf(keyword.toLowerCase());
          const start = Math.max(0, keywordIndex - 100);
          const end = Math.min(text.length, keywordIndex + keyword.length + 100);
          const context = text.substring(start, end);
          console.log(`   📝 Context: ...${context}...`);
          break;
        }
      }
      
      if (!found) {
        console.log(`   ❌ NOT FOUND`);
      }
    }

    // Display full text of first 5 chunks
    console.log('\n' + '='.repeat(80));
    console.log('📄 FULL TEXT OF FIRST 5 CHUNKS');
    console.log('=' .repeat(80));
    
    for (let i = 0; i < Math.min(5, geographyChunks.length); i++) {
      const chunk = geographyChunks[i];
      const payload = chunk.payload;
      
      console.log(`\n--- CHUNK ${i + 1} ---`);
      console.log(`ID: ${chunk.id}`);
      console.log(`Book Title: ${payload.bookTitle || payload.book_title || 'N/A'}`);
      console.log(`Class: ${payload.classLevel || payload.class || 'N/A'}`);
      console.log(`Subject: ${payload.subject || 'N/A'}`);
      console.log(`Page: ${payload.pageNumber || payload.page || 'N/A'}`);
      console.log(`Chapter: ${payload.chapter || 'N/A'}`);
      console.log(`Section: ${payload.section || payload.section_title || 'N/A'}`);
      console.log(`\nFULL TEXT:`);
      console.log(payload.text || 'No text available');
      console.log('\n' + '-'.repeat(80));
    }

    // Analyze all unique metadata fields
    console.log('\n' + '='.repeat(80));
    console.log('🔬 METADATA FIELD ANALYSIS');
    console.log('=' .repeat(80));
    
    const metadataFields = new Set<string>();
    for (const chunk of geographyChunks) {
      Object.keys(chunk.payload).forEach(key => metadataFields.add(key));
    }
    
    console.log('\n📋 Available metadata fields:');
    Array.from(metadataFields).sort().forEach(field => {
      console.log(`   - ${field}`);
    });

    // Sample a chunk to show all metadata
    if (geographyChunks.length > 0) {
      console.log('\n📝 Sample chunk metadata (Chunk 1):');
      const samplePayload = geographyChunks[0].payload;
      for (const [key, value] of Object.entries(samplePayload)) {
        if (key !== 'text') {
          console.log(`   ${key}: ${JSON.stringify(value)}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analysis Complete');
    console.log('=' .repeat(80));

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  }
}

// Run the analysis
analyzeChunks()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

