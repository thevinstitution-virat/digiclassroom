/**
 * Investigation Script: Geography Book Data Integrity
 * 
 * This script investigates the data integrity issue where a 16-page geography book
 * shows only 1 page in the Content Overview UI.
 * 
 * Tasks:
 * 1. Verify metadata preservation (page numbers, chapters, sections)
 * 2. Search for specific paragraphs from the geography textbook
 * 3. Report findings on page number distribution
 * 4. Identify if this is a UI display issue or actual data loss
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';

// Target paragraphs to search for
const PARAGRAPH_1 = "The range lying to the south of the Himadri forms the most rugged mountain system and is known as Himachal or lesser Himalaya. The ranges are mainly composed of highly compressed and altered rocks. The altitude varies between 3,700 and 4,500 metres and the average width is of 50 Km. While the Pir Panjal range forms the longest and the most important range, the Dhauladhar and the Mahabharat ranges are also prominent ones. This range consists of the famous valley of Kashmir, the Kangra and Kullu Valley in Himachal Pradesh. This region is well-known for its hill stations.";

const PARAGRAPH_2 = "One of the distinct features of the Peninsular plateau is the black soil area known as Deccan Trap. This is of volcanic origin, hence, the rocks are igneous. Actually, these rocks have denuded over time and are responsible for the formation of black soil. The Aravali Hills lie on the western and northwestern margins of the Peninsular plateau. These are highly eroded hills and are found as broken hills. They extend from Gujarat to Delhi in a southwest-northeast direction.";

interface ChunkInfo {
  id: string;
  text: string;
  pageNumber: number;
  chapter: string;
  section: string;
  bookTitle: string;
  subject: string;
  classLevel: string;
}

interface PageDistribution {
  [pageNumber: number]: number; // page number -> chunk count
}

interface InvestigationReport {
  totalChunks: number;
  uniquePages: Set<number>;
  pageDistribution: PageDistribution;
  paragraph1Found: boolean;
  paragraph1Location?: {
    chunkId: string;
    pageNumber: number;
    chapter: string;
    matchQuality: string;
  };
  paragraph2Found: boolean;
  paragraph2Location?: {
    chunkId: string;
    pageNumber: number;
    chapter: string;
    matchQuality: string;
  };
  metadataIssues: string[];
  sampleChunks: ChunkInfo[];
}

/**
 * Calculate text similarity (simple word overlap)
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size; // Jaccard similarity
}

/**
 * Check if text contains the target paragraph (with fuzzy matching)
 */
function containsParagraph(text: string, targetParagraph: string): {
  found: boolean;
  similarity: number;
  matchQuality: 'exact' | 'high' | 'medium' | 'low' | 'none';
} {
  // Normalize whitespace
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const normalizedTarget = targetParagraph.replace(/\s+/g, ' ').trim();
  
  // Check for exact match
  if (normalizedText.includes(normalizedTarget)) {
    return { found: true, similarity: 1.0, matchQuality: 'exact' };
  }
  
  // Calculate similarity
  const similarity = calculateSimilarity(text, targetParagraph);
  
  if (similarity > 0.8) {
    return { found: true, similarity, matchQuality: 'high' };
  } else if (similarity > 0.6) {
    return { found: true, similarity, matchQuality: 'medium' };
  } else if (similarity > 0.4) {
    return { found: true, similarity, matchQuality: 'low' };
  }
  
  return { found: false, similarity, matchQuality: 'none' };
}

/**
 * Main investigation function
 */
async function investigateGeographyBook() {
  console.log('🔍 Starting Geography Book Data Integrity Investigation...\n');
  console.log('=' .repeat(80));
  
  // Initialize Qdrant client
  const client = new QdrantClient({
    url: QDRANT_URL,
  });

  try {
    // Check if collection exists
    console.log(`\n📊 Connecting to Qdrant collection: ${COLLECTION_NAME}`);
    const collectionInfo = await client.getCollection(COLLECTION_NAME);
    console.log(`✅ Collection found with ${collectionInfo.points_count} total points\n`);

    // Scroll through all points to find geography book chunks
    console.log('📚 Fetching all chunks from vector database...');
    const geographyChunks: ChunkInfo[] = [];
    let offset: string | number | null = null;
    let totalPoints = 0;
    
    do {
      const scrollResult = await client.scroll(COLLECTION_NAME, {
        limit: 100,
        with_payload: true,
        with_vector: false,
        offset: offset as any
      });

      for (const point of scrollResult.points) {
        totalPoints++;
        const payload = point.payload as any;
        
        // Filter for geography books (case-insensitive)
        const subject = (payload.subject || '').toLowerCase();
        if (subject.includes('geography') || subject.includes('social')) {
          geographyChunks.push({
            id: point.id.toString(),
            text: payload.text || '',
            pageNumber: payload.pageNumber || payload.page || 0,
            chapter: payload.chapter || 'Unknown',
            section: payload.section || payload.section_title || 'Unknown',
            bookTitle: payload.bookTitle || payload.book_title || 'Unknown',
            subject: payload.subject || 'Unknown',
            classLevel: payload.classLevel || payload.class || 'Unknown'
          });
        }
      }

      offset = scrollResult.next_page_offset || null;
    } while (offset !== null);

    console.log(`✅ Scanned ${totalPoints} total points`);
    console.log(`📖 Found ${geographyChunks.length} geography-related chunks\n`);

    if (geographyChunks.length === 0) {
      console.log('❌ No geography book chunks found in the database!');
      return;
    }

    // Analyze page distribution
    console.log('=' .repeat(80));
    console.log('📊 METADATA ANALYSIS');
    console.log('=' .repeat(80));
    
    const pageDistribution: PageDistribution = {};
    const uniquePages = new Set<number>();
    const metadataIssues: string[] = [];
    
    for (const chunk of geographyChunks) {
      const page = chunk.pageNumber;
      uniquePages.add(page);
      pageDistribution[page] = (pageDistribution[page] || 0) + 1;
      
      // Check for metadata issues
      if (page === 0) {
        metadataIssues.push(`Chunk ${chunk.id} has page number 0`);
      }
      if (chunk.chapter === 'Unknown') {
        metadataIssues.push(`Chunk ${chunk.id} has unknown chapter`);
      }
    }

    console.log(`\n📄 Total Chunks: ${geographyChunks.length}`);
    console.log(`📄 Unique Pages: ${uniquePages.size}`);
    console.log(`📄 Page Range: ${Math.min(...uniquePages)} - ${Math.max(...uniquePages)}`);
    
    console.log('\n📊 Page Distribution:');
    const sortedPages = Object.keys(pageDistribution).map(Number).sort((a, b) => a - b);
    for (const page of sortedPages) {
      const count = pageDistribution[page];
      const bar = '█'.repeat(Math.min(count, 50));
      console.log(`   Page ${page.toString().padStart(2)}: ${count.toString().padStart(3)} chunks ${bar}`);
    }

    // Search for target paragraphs
    console.log('\n' + '='.repeat(80));
    console.log('🔍 PARAGRAPH SEARCH');
    console.log('=' .repeat(80));
    
    let paragraph1Found = false;
    let paragraph1Location: any = undefined;
    let paragraph2Found = false;
    let paragraph2Location: any = undefined;

    console.log('\n🔍 Searching for Paragraph 1 (Himachal/Lesser Himalaya)...');
    for (const chunk of geographyChunks) {
      const match = containsParagraph(chunk.text, PARAGRAPH_1);
      if (match.found && match.matchQuality !== 'none') {
        paragraph1Found = true;
        paragraph1Location = {
          chunkId: chunk.id,
          pageNumber: chunk.pageNumber,
          chapter: chunk.chapter,
          matchQuality: match.matchQuality,
          similarity: match.similarity
        };
        console.log(`✅ FOUND! Match Quality: ${match.matchQuality.toUpperCase()} (${(match.similarity * 100).toFixed(1)}% similarity)`);
        console.log(`   Chunk ID: ${chunk.id}`);
        console.log(`   Page Number: ${chunk.pageNumber}`);
        console.log(`   Chapter: ${chunk.chapter}`);
        console.log(`   Section: ${chunk.section}`);
        break;
      }
    }
    if (!paragraph1Found) {
      console.log('❌ Paragraph 1 NOT FOUND in any chunk');
    }

    console.log('\n🔍 Searching for Paragraph 2 (Deccan Trap/Aravali Hills)...');
    for (const chunk of geographyChunks) {
      const match = containsParagraph(chunk.text, PARAGRAPH_2);
      if (match.found && match.matchQuality !== 'none') {
        paragraph2Found = true;
        paragraph2Location = {
          chunkId: chunk.id,
          pageNumber: chunk.pageNumber,
          chapter: chunk.chapter,
          matchQuality: match.matchQuality,
          similarity: match.similarity
        };
        console.log(`✅ FOUND! Match Quality: ${match.matchQuality.toUpperCase()} (${(match.similarity * 100).toFixed(1)}% similarity)`);
        console.log(`   Chunk ID: ${chunk.id}`);
        console.log(`   Page Number: ${chunk.pageNumber}`);
        console.log(`   Chapter: ${chunk.chapter}`);
        console.log(`   Section: ${chunk.section}`);
        break;
      }
    }
    if (!paragraph2Found) {
      console.log('❌ Paragraph 2 NOT FOUND in any chunk');
    }

    // Metadata issues
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  METADATA ISSUES');
    console.log('=' .repeat(80));
    
    if (metadataIssues.length > 0) {
      console.log(`\n❌ Found ${metadataIssues.length} metadata issues:`);
      metadataIssues.slice(0, 10).forEach(issue => console.log(`   - ${issue}`));
      if (metadataIssues.length > 10) {
        console.log(`   ... and ${metadataIssues.length - 10} more`);
      }
    } else {
      console.log('\n✅ No critical metadata issues found');
    }

    // Sample chunks
    console.log('\n' + '='.repeat(80));
    console.log('📝 SAMPLE CHUNKS (First 3)');
    console.log('=' .repeat(80));
    
    for (let i = 0; i < Math.min(3, geographyChunks.length); i++) {
      const chunk = geographyChunks[i];
      console.log(`\n--- Chunk ${i + 1} ---`);
      console.log(`ID: ${chunk.id}`);
      console.log(`Book: ${chunk.bookTitle}`);
      console.log(`Class: ${chunk.classLevel}`);
      console.log(`Subject: ${chunk.subject}`);
      console.log(`Page: ${chunk.pageNumber}`);
      console.log(`Chapter: ${chunk.chapter}`);
      console.log(`Section: ${chunk.section}`);
      console.log(`Text Preview: ${chunk.text.substring(0, 200)}...`);
    }

    // Final diagnosis
    console.log('\n' + '='.repeat(80));
    console.log('🏥 DIAGNOSIS');
    console.log('=' .repeat(80));
    
    console.log('\n📋 Summary:');
    console.log(`   Total Chunks: ${geographyChunks.length}`);
    console.log(`   Unique Pages: ${uniquePages.size}`);
    console.log(`   Expected Pages: 16`);
    console.log(`   Paragraph 1 Found: ${paragraph1Found ? '✅ YES' : '❌ NO'}`);
    console.log(`   Paragraph 2 Found: ${paragraph2Found ? '✅ YES' : '❌ NO'}`);
    
    console.log('\n🔬 Root Cause Analysis:');
    if (uniquePages.size === 1 && uniquePages.has(1)) {
      console.log('   ❌ CRITICAL: All chunks have page number 1!');
      console.log('   📌 This is a DATA LOSS issue during PDF extraction.');
      console.log('   📌 The page numbers are NOT being preserved correctly.');
      console.log('   📌 The UI is displaying correct data - the problem is in the indexing pipeline.');
    } else if (uniquePages.size < 16) {
      console.log(`   ⚠️  WARNING: Only ${uniquePages.size} unique pages found (expected 16)`);
      console.log('   📌 Some pages may not have been indexed or page numbers are incorrect.');
    } else {
      console.log('   ✅ Page numbers appear to be preserved correctly.');
      console.log('   📌 The issue may be in the UI display logic.');
    }

    console.log('\n💡 Recommendations:');
    if (uniquePages.size === 1) {
      console.log('   1. Check the PDF extraction process (PyMuPDF/doc-extract-engine)');
      console.log('   2. Verify page number assignment in pdf-extract-kit-processor.ts');
      console.log('   3. Check the enhanced-rag-pipeline.ts indexing logic');
      console.log('   4. Re-index the geography book with corrected page numbers');
    } else if (!paragraph1Found || !paragraph2Found) {
      console.log('   1. Verify the source PDF contains these paragraphs');
      console.log('   2. Check for OCR errors or text extraction issues');
      console.log('   3. Review the chunking strategy (text may be split across chunks)');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Investigation Complete');
    console.log('=' .repeat(80));

  } catch (error) {
    console.error('❌ Investigation failed:', error);
    throw error;
  }
}

// Run the investigation
investigateGeographyBook()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

