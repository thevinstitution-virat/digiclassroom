/**
 * Test Books API - Verify Page Count Fix
 * 
 * This script tests the /api/admin/qdrant/books endpoint
 * to verify that the page count is now correctly calculated
 */

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('🧪 TESTING BOOKS API - PAGE COUNT FIX');
  console.log('='.repeat(100) + '\n');

  const API_URL = 'http://localhost:3000/api/admin/qdrant/books';

  try {
    console.log(`📡 Fetching books from: ${API_URL}\n`);
    
    const response = await fetch(API_URL);
    
    if (!response.ok) {
      console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    const data = await response.json();

    if (!data.success) {
      console.error('❌ API returned error:', data.error);
      process.exit(1);
    }

    console.log(`✅ API request successful\n`);
    console.log(`📚 Total Books: ${data.totalBooks}`);
    console.log(`📊 Total Chunks: ${data.totalChunks}\n`);

    console.log('─'.repeat(100));
    console.log('📖 BOOK DETAILS:');
    console.log('─'.repeat(100) + '\n');

    for (const book of data.books) {
      console.log(`Book: ${book.bookTitle}`);
      console.log(`  Class: ${book.classLevel}`);
      console.log(`  Subject: ${book.subject}`);
      console.log(`  Curriculum: ${book.curriculum}`);
      console.log(`  Language: ${book.language}`);
      console.log(`  📄 Total Pages: ${book.totalPages}`);
      console.log(`  📦 Total Chunks: ${book.totalChunks}`);
      console.log(`  🧮 Formulas: ${book.hasFormulas ? 'Yes' : 'No'}`);
      console.log(`  📊 Tables: ${book.hasTables ? 'Yes' : 'No'}`);
      console.log(`  📅 Upload Date: ${book.uploadDate || 'N/A'}`);
      console.log('');
    }

    // Verify Geography book
    const geographyBook = data.books.find((book: any) => 
      book.subject === 'Geography' || book.bookTitle.toLowerCase().includes('geography')
    );

    if (geographyBook) {
      console.log('─'.repeat(100));
      console.log('✅ GEOGRAPHY BOOK VERIFICATION:');
      console.log('─'.repeat(100) + '\n');
      console.log(`Book Title: ${geographyBook.bookTitle}`);
      console.log(`Total Pages: ${geographyBook.totalPages}`);
      console.log(`Total Chunks: ${geographyBook.totalChunks}`);
      console.log('');

      if (geographyBook.totalPages === 16) {
        console.log('✅ SUCCESS: Page count is correct (16 pages)');
      } else {
        console.log(`❌ FAILURE: Expected 16 pages, got ${geographyBook.totalPages}`);
      }

      if (geographyBook.totalChunks === 16) {
        console.log('✅ SUCCESS: Chunk count is correct (16 chunks)');
      } else {
        console.log(`⚠️  WARNING: Expected 16 chunks, got ${geographyBook.totalChunks}`);
      }
    } else {
      console.log('⚠️  WARNING: Geography book not found in API response');
    }

    console.log('\n' + '='.repeat(100));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(100) + '\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

main().catch(console.error);

