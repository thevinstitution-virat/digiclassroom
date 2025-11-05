/**
 * Investigation Script: Geography Book Data Integrity
 * 
 * Purpose: Investigate the discrepancy between 16-page source document and 1-page display
 * Tasks:
 * 1. Query Qdrant for all chunks from the geography book
 * 2. Analyze page number distribution
 * 3. Search for specific paragraphs
 * 4. Report metadata integrity issues
 */

import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

// Target paragraphs to search for
const TARGET_PARAGRAPH_1 = "The range lying to the south of the Himadri forms the most rugged mountain system and is known as Himachal or lesser Himalaya";
const TARGET_PARAGRAPH_2 = "One of the distinct features of the Peninsular plateau is the black soil area known as Deccan Trap";

interface ChunkInfo {
  id: string;
  text: string;
  page: number;
  chapter: string;
  section: string;
  bookTitle: string;
  subject: string;
  classLevel: string;
}

async function investigateGeographyBook() {
  console.log('🔍 Starting Geography Book Investigation...\n');
  
  // Initialize Qdrant client
  const client = new QdrantClient({
    url: QDRANT_URL,
  });

  try {
    // Check if collection exists
    console.log(`📊 Connecting to Qdrant collection: ${COLLECTION_NAME}`);
    await client.getCollection(COLLECTION_NAME);
    console.log('✅ Collection found\n');

    // Scroll through all points to find geography book chunks
    console.log('📚 Fetching all chunks from vector database...');
    const allChunks: ChunkInfo[] = [];
    let offset: string | number | null = null;
    let totalPoints = 0;
    
    do {
      const scrollResult = await client.scroll(COLLECTION_NAME, {
        limit: 100,
        with_payload: true,
        with_vector: false,
        offset: offset as any
      });

      totalPoints += scrollResult.points.length;

      for (const point of scrollResult.points) {
        const payload = point.payload as any;
        
        // Filter for geography books (look for common geography keywords)
        const text = payload.text || '';
        const bookTitle = payload.bookTitle || payload.book_title || '';
        const subject = payload.subject || '';
        
        // Check if this is a geography book
        const isGeography = 
          subject.toLowerCase().includes('geography') ||
          subject.toLowerCase().includes('social') ||
          bookTitle.toLowerCase().includes('geography') ||
          text.toLowerCase().includes('himadri') ||
          text.toLowerCase().includes('himalaya') ||
          text.toLowerCase().includes('peninsular plateau');

        if (isGeography) {
          allChunks.push({
            id: point.id.toString(),
            text: text,
            page: payload.page || payload.pageNumber || 0,
            chapter: payload.chapter || 'Unknown',
            section: payload.section || payload.section_title || 'Unknown',
            bookTitle: bookTitle,
            subject: subject,
            classLevel: payload.classLevel || payload.class || 'Unknown'
          });
        }
      }

      offset = scrollResult.next_page_offset || null;
    } while (offset !== null);

    console.log(`✅ Scanned ${totalPoints} total points in database`);
    console.log(`📖 Found ${allChunks.length} geography-related chunks\n`);

    if (allChunks.length === 0) {
      console.log('❌ No geography book chunks found in the database!');
      console.log('   This could mean:');
      console.log('   1. The book was not indexed successfully');
      console.log('   2. The book metadata does not contain "geography" keywords');
      console.log('   3. The collection is empty or corrupted\n');
      return;
    }

    // Analyze page number distribution
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 PAGE NUMBER DISTRIBUTION ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const pageDistribution = new Map<number, number>();
    const uniqueBooks = new Set<string>();
    
    for (const chunk of allChunks) {
      const page = chunk.page;
      pageDistribution.set(page, (pageDistribution.get(page) || 0) + 1);
      uniqueBooks.add(`${chunk.bookTitle} - ${chunk.classLevel} - ${chunk.subject}`);
    }

    console.log(`📚 Unique Books Found: ${uniqueBooks.size}`);
    for (const book of uniqueBooks) {
      console.log(`   - ${book}`);
    }
    console.log('');

    const sortedPages = Array.from(pageDistribution.entries()).sort((a, b) => a[0] - b[0]);
    const maxPage = Math.max(...Array.from(pageDistribution.keys()));
    const minPage = Math.min(...Array.from(pageDistribution.keys()));

    console.log(`📄 Page Range: ${minPage} to ${maxPage}`);
    console.log(`📊 Total Chunks: ${allChunks.length}`);
    console.log(`📈 Page Distribution:`);
    
    for (const [page, count] of sortedPages) {
      const bar = '█'.repeat(Math.ceil(count / 2));
      console.log(`   Page ${page.toString().padStart(3)}: ${count.toString().padStart(3)} chunks ${bar}`);
    }
    console.log('');

    // Identify the issue
    if (maxPage === 1 && allChunks.length > 10) {
      console.log('⚠️  ISSUE DETECTED: All chunks have page number = 1');
      console.log('   This indicates a metadata preservation problem during indexing.');
      console.log('   The page numbers were not correctly extracted or stored.\n');
    } else if (maxPage < 16 && allChunks.length > 50) {
      console.log(`⚠️  ISSUE DETECTED: Maximum page number (${maxPage}) is less than expected (16)`);
      console.log('   Some pages may not have been indexed or page numbers are incorrect.\n');
    } else {
      console.log('✅ Page distribution looks reasonable\n');
    }

    // Search for specific paragraphs
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 SEARCHING FOR SPECIFIC PARAGRAPHS');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📝 Paragraph 1: Himachal/Lesser Himalaya');
    console.log('   Search term: "' + TARGET_PARAGRAPH_1.substring(0, 80) + '..."\n');

    const paragraph1Matches = allChunks.filter(chunk => 
      chunk.text.includes('Himachal') && 
      chunk.text.includes('lesser Himalaya') &&
      chunk.text.includes('Himadri')
    );

    if (paragraph1Matches.length > 0) {
      console.log(`✅ Found ${paragraph1Matches.length} chunk(s) containing Paragraph 1\n`);
      
      for (let i = 0; i < Math.min(paragraph1Matches.length, 3); i++) {
        const match = paragraph1Matches[i];
        console.log(`   Match ${i + 1}:`);
        console.log(`   - Chunk ID: ${match.id}`);
        console.log(`   - Page Number: ${match.page}`);
        console.log(`   - Chapter: ${match.chapter}`);
        console.log(`   - Section: ${match.section}`);
        console.log(`   - Text Preview: ${match.text.substring(0, 200)}...`);
        console.log('');
      }
    } else {
      console.log('❌ Paragraph 1 NOT FOUND in database\n');
    }

    console.log('📝 Paragraph 2: Deccan Trap/Peninsular Plateau');
    console.log('   Search term: "' + TARGET_PARAGRAPH_2.substring(0, 80) + '..."\n');

    const paragraph2Matches = allChunks.filter(chunk => 
      chunk.text.includes('Deccan Trap') && 
      chunk.text.includes('Peninsular plateau') &&
      chunk.text.includes('black soil')
    );

    if (paragraph2Matches.length > 0) {
      console.log(`✅ Found ${paragraph2Matches.length} chunk(s) containing Paragraph 2\n`);
      
      for (let i = 0; i < Math.min(paragraph2Matches.length, 3); i++) {
        const match = paragraph2Matches[i];
        console.log(`   Match ${i + 1}:`);
        console.log(`   - Chunk ID: ${match.id}`);
        console.log(`   - Page Number: ${match.page}`);
        console.log(`   - Chapter: ${match.chapter}`);
        console.log(`   - Section: ${match.section}`);
        console.log(`   - Text Preview: ${match.text.substring(0, 200)}...`);
        console.log('');
      }
    } else {
      console.log('❌ Paragraph 2 NOT FOUND in database\n');
    }

    // Check for OCR errors or text corruption
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 TEXT QUALITY ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Sample some chunks for quality check
    const sampleSize = Math.min(10, allChunks.length);
    const samples = allChunks.slice(0, sampleSize);

    console.log(`📊 Analyzing ${sampleSize} sample chunks for quality issues:\n`);

    let corruptedCount = 0;
    for (const chunk of samples) {
      const text = chunk.text;
      const hasWeirdChars = /[^\x00-\x7F\u0900-\u097F\u0980-\u09FF]/.test(text);
      const hasExcessiveSpaces = /\s{5,}/.test(text);
      const tooShort = text.length < 50;
      
      if (hasWeirdChars || hasExcessiveSpaces || tooShort) {
        corruptedCount++;
        console.log(`⚠️  Chunk ${chunk.id} (Page ${chunk.page}):`);
        if (hasWeirdChars) console.log('   - Contains unusual characters');
        if (hasExcessiveSpaces) console.log('   - Has excessive spacing');
        if (tooShort) console.log(`   - Too short (${text.length} chars)`);
        console.log(`   - Preview: ${text.substring(0, 100)}...\n`);
      }
    }

    if (corruptedCount === 0) {
      console.log('✅ No obvious text quality issues detected in samples\n');
    } else {
      console.log(`⚠️  Found ${corruptedCount}/${sampleSize} chunks with potential quality issues\n`);
    }

    // Final summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 INVESTIGATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Total Geography Chunks: ${allChunks.length}`);
    console.log(`Page Range: ${minPage} - ${maxPage}`);
    console.log(`Paragraph 1 Found: ${paragraph1Matches.length > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`Paragraph 2 Found: ${paragraph2Matches.length > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`Text Quality Issues: ${corruptedCount > 0 ? `⚠️  ${corruptedCount} samples` : '✅ None detected'}`);
    console.log('');

    // Root cause analysis
    console.log('🔍 ROOT CAUSE ANALYSIS:\n');

    if (maxPage === 1 && allChunks.length > 10) {
      console.log('❌ PRIMARY ISSUE: Page Number Metadata Loss');
      console.log('   - All chunks have page = 1');
      console.log('   - This is NOT a UI display bug');
      console.log('   - This is a DATA INTEGRITY issue in the vector database');
      console.log('');
      console.log('   Possible Causes:');
      console.log('   1. doc-extract-engine is not extracting page numbers correctly');
      console.log('   2. Page metadata is lost during chunk transformation');
      console.log('   3. PDF has no page markers or unusual structure');
      console.log('');
      console.log('   Recommended Fix:');
      console.log('   - Check doc_extract_engine_processor.py line 187 (page assignment)');
      console.log('   - Verify PDF structure with PyMuPDF page count');
      console.log('   - Re-index the document after fixing page extraction');
    } else if (paragraph1Matches.length === 0 || paragraph2Matches.length === 0) {
      console.log('❌ PRIMARY ISSUE: Content Not Indexed');
      console.log('   - Expected paragraphs are missing from database');
      console.log('   - This indicates incomplete indexing or text extraction failure');
      console.log('');
      console.log('   Recommended Fix:');
      console.log('   - Check upload logs for errors during PDF processing');
      console.log('   - Verify PDF is not corrupted or password-protected');
      console.log('   - Re-upload the document');
    } else {
      console.log('✅ Data appears to be correctly indexed');
      console.log('   - Page numbers are distributed across multiple pages');
      console.log('   - Target paragraphs are present in database');
      console.log('   - If UI shows 1 page, this is a frontend display bug');
    }

  } catch (error) {
    console.error('❌ Investigation failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack trace:', error.stack);
    }
  }
}

// Run the investigation
investigateGeographyBook().then(() => {
  console.log('\n✅ Investigation complete');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Investigation failed with error:', error);
  process.exit(1);
});

