/**
 * Test Script for Phase 2 Implementation
 * Verifies all 4 tasks are working correctly
 */

import { validateChunkBatch, getValidatedExtractionStrategy } from '../src/lib/content/chunk-metadata-schema';

// Test data
const testChunks = [
  // Valid chunk
  {
    id: 'chunk_1',
    text: 'The Pythagorean theorem states that a² + b² = c²',
    metadata: {
      class: 'Class 9',
      subject: 'Mathematics',
      book_title: 'NCERT Mathematics',
      page: 45,
      chapter: 'Chapter 6: Triangles',
      section_title: 'Pythagorean Theorem',
      board: 'CBSE',
      medium: 'English',
      language: 'English',
      section_level: 2,
      content_type: 'text',
      confidence: 0.95,
    }
  },
  // Valid chunk with minimal metadata
  {
    id: 'chunk_2',
    text: 'A triangle has three sides and three angles.',
    metadata: {
      classLevel: 'Class IX', // Should be normalized to "Class 9"
      subject: 'Mathematics',
      bookTitle: 'NCERT Mathematics', // Should be mapped to book_title
      page: 46,
    }
  },
  // Invalid chunk - missing required fields
  {
    id: 'chunk_3',
    text: 'This chunk is missing required metadata.',
    metadata: {
      subject: 'Mathematics',
      // Missing: class, book_title, page
    }
  },
  // Invalid chunk - invalid page number
  {
    id: 'chunk_4',
    text: 'This chunk has an invalid page number.',
    metadata: {
      class: 'Class 9',
      subject: 'Mathematics',
      book_title: 'NCERT Mathematics',
      page: -5, // Invalid: must be positive
    }
  },
  // Valid chunk with all optional fields
  {
    id: 'chunk_5',
    text: 'Complete chunk with all metadata fields.',
    metadata: {
      class: 'Class 10',
      subject: 'Science',
      book_title: 'NCERT Science',
      page: 120,
      chapter: 'Chapter 10: Light',
      section_title: 'Reflection and Refraction',
      board: 'CBSE',
      medium: 'English',
      language: 'English',
      section_level: 3,
      content_type: 'text',
      confidence: 0.98,
      extraction_method: 'embedded_text',
      contains_equation: true,
      contains_table: false,
      contains_figure: true,
    }
  },
];

/**
 * Test 1: Chunk Validation
 */
function testChunkValidation() {
  console.log('\n🧪 Test 1: Chunk Validation');
  console.log('='.repeat(60));
  
  const { valid, invalid, stats } = validateChunkBatch(testChunks);
  
  console.log('\n📊 Validation Results:');
  console.log(`  - Total chunks: ${stats.total}`);
  console.log(`  - Valid: ${stats.validCount} (${(stats.validationRate * 100).toFixed(1)}%)`);
  console.log(`  - Invalid: ${stats.invalidCount}`);
  
  console.log('\n✅ Valid Chunks:');
  valid.forEach(({ chunk, metadata }) => {
    console.log(`  - ${chunk.id}:`);
    console.log(`    Class: ${metadata.class}`);
    console.log(`    Subject: ${metadata.subject}`);
    console.log(`    Book: ${metadata.book_title}`);
    console.log(`    Page: ${metadata.page}`);
  });
  
  console.log('\n❌ Invalid Chunks:');
  invalid.forEach(({ chunk, error }) => {
    console.log(`  - ${chunk.id}: ${error.message}`);
  });
  
  // Assertions
  const expectedValid = 3; // chunks 1, 2, 5
  const expectedInvalid = 2; // chunks 3, 4
  
  if (stats.validCount === expectedValid && stats.invalidCount === expectedInvalid) {
    console.log('\n✅ Test 1 PASSED');
    return true;
  } else {
    console.log(`\n❌ Test 1 FAILED: Expected ${expectedValid} valid and ${expectedInvalid} invalid, got ${stats.validCount} valid and ${stats.invalidCount} invalid`);
    return false;
  }
}

/**
 * Test 2: Class Level Normalization
 */
function testClassLevelNormalization() {
  console.log('\n🧪 Test 2: Class Level Normalization');
  console.log('='.repeat(60));
  
  const testCases = [
    { input: 'Class IX', expected: 'Class 9' },
    { input: 'Class 9', expected: 'Class 9' },
    { input: 'IX', expected: 'Class 9' },
    { input: '9', expected: 'Class 9' },
    { input: 'Class X', expected: 'Class 10' },
    { input: 'Class XII', expected: 'Class 12' },
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach(({ input, expected }) => {
    const chunk = {
      id: 'test',
      text: 'test',
      metadata: {
        classLevel: input,
        subject: 'Test',
        bookTitle: 'Test Book',
        page: 1,
      }
    };
    
    const { valid } = validateChunkBatch([chunk]);
    
    if (valid.length > 0 && valid[0].metadata.class === expected) {
      console.log(`  ✅ "${input}" → "${valid[0].metadata.class}"`);
      passed++;
    } else {
      console.log(`  ❌ "${input}" → Expected "${expected}", got "${valid[0]?.metadata.class || 'INVALID'}"`);
      failed++;
    }
  });
  
  if (failed === 0) {
    console.log(`\n✅ Test 2 PASSED (${passed}/${testCases.length})`);
    return true;
  } else {
    console.log(`\n❌ Test 2 FAILED (${passed}/${testCases.length} passed, ${failed} failed)`);
    return false;
  }
}

/**
 * Test 3: Configuration Validation
 */
function testConfigurationValidation() {
  console.log('\n🧪 Test 3: Configuration Validation');
  console.log('='.repeat(60));
  
  try {
    const strategy = getValidatedExtractionStrategy();
    
    console.log(`\n📄 Current Configuration:`);
    console.log(`  - Strategy: ${strategy}`);
    console.log(`  - Valid: ${['auto', 'text_only', 'ocr_only', 'hybrid', 'force_pdf_extract_kit'].includes(strategy)}`);
    
    if (['auto', 'text_only', 'ocr_only', 'hybrid', 'force_pdf_extract_kit'].includes(strategy)) {
      console.log('\n✅ Test 3 PASSED');
      return true;
    } else {
      console.log(`\n❌ Test 3 FAILED: Invalid strategy "${strategy}"`);
      return false;
    }
  } catch (error) {
    console.log(`\n❌ Test 3 FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Test 4: Metadata Field Mapping
 */
function testMetadataFieldMapping() {
  console.log('\n🧪 Test 4: Metadata Field Mapping');
  console.log('='.repeat(60));
  
  const chunk = {
    id: 'test_mapping',
    text: 'Test chunk for field mapping',
    metadata: {
      classLevel: 'Class 9', // Should map to 'class'
      bookTitle: 'Test Book', // Should map to 'book_title'
      subject: 'Mathematics',
      page: 1,
      curriculum: 'CBSE', // Should map to 'board'
      language: 'English', // Should map to 'medium'
    }
  };
  
  const { valid } = validateChunkBatch([chunk]);
  
  if (valid.length === 0) {
    console.log('\n❌ Test 4 FAILED: Chunk validation failed');
    return false;
  }
  
  const metadata = valid[0].metadata;
  
  console.log('\n📋 Field Mapping Results:');
  console.log(`  - classLevel → class: ${metadata.class}`);
  console.log(`  - bookTitle → book_title: ${metadata.book_title}`);
  console.log(`  - curriculum → board: ${metadata.board}`);
  console.log(`  - language → medium: ${metadata.medium}`);
  
  const checks = [
    { field: 'class', expected: 'Class 9', actual: metadata.class },
    { field: 'book_title', expected: 'Test Book', actual: metadata.book_title },
    { field: 'board', expected: 'CBSE', actual: metadata.board },
    { field: 'medium', expected: 'English', actual: metadata.medium },
  ];
  
  let passed = 0;
  let failed = 0;
  
  checks.forEach(({ field, expected, actual }) => {
    if (actual === expected) {
      console.log(`  ✅ ${field}: "${actual}"`);
      passed++;
    } else {
      console.log(`  ❌ ${field}: Expected "${expected}", got "${actual}"`);
      failed++;
    }
  });
  
  if (failed === 0) {
    console.log(`\n✅ Test 4 PASSED (${passed}/${checks.length})`);
    return true;
  } else {
    console.log(`\n❌ Test 4 FAILED (${passed}/${checks.length} passed, ${failed} failed)`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('\n🚀 Phase 2 Implementation Test Suite');
  console.log('='.repeat(60));
  console.log('Testing all 4 tasks of Phase 2 implementation\n');
  
  const results = [
    testChunkValidation(),
    testClassLevelNormalization(),
    testConfigurationValidation(),
    testMetadataFieldMapping(),
  ];
  
  const passed = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`  - Total tests: ${results.length}`);
  console.log(`  - Passed: ${passed}`);
  console.log(`  - Failed: ${failed}`);
  console.log(`  - Success rate: ${(passed / results.length * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Phase 2 implementation is working correctly.');
    process.exit(0);
  } else {
    console.log(`\n❌ ${failed} TEST(S) FAILED. Please review the errors above.`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});

