/**
 * Search for Specific Paragraphs - Detailed Text Matching
 * 
 * This script searches for the two target paragraphs with fuzzy matching
 * to account for OCR variations
 */

import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

// Target paragraphs
const PARAGRAPH_1_KEYWORDS = [
  'Himadri',
  'Himachal',
  'lesser Himalaya',
  'Pir Panjal',
  'Dhauladhar',
  'Mahabharat',
  'Kashmir',
  'Kangra',
  'Kullu Valley'
];

const PARAGRAPH_2_KEYWORDS = [
  'Deccan Trap',
  'volcanic origin',
  'igneous',
  'black soil',
  'Aravali Hills',
  'Gujarat',
  'Delhi',
  'southwest-northeast'
];

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('🔍 SEARCHING FOR SPECIFIC PARAGRAPHS');
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

  console.log(`Total chunks: ${allPoints.length}\n`);

  // ===== SEARCH FOR PARAGRAPH 1 =====
  console.log('📝 PARAGRAPH 1: Himachal/Lesser Himalaya');
  console.log('─'.repeat(100));
  console.log('Expected content:');
  console.log('"The range lying to the south of the Himadri forms the most rugged mountain');
  console.log('system and is known as Himachal or lesser Himalaya. The ranges are mainly');
  console.log('composed of highly compressed and altered rocks. The altitude varies between');
  console.log('3,700 and 4,500 metres and the average width is of 50 Km. While the Pir Panjal');
  console.log('range forms the longest and the most important range, the Dhauladhar and the');
  console.log('Mahabharat ranges are also prominent ones. This range consists of the famous');
  console.log('valley of Kashmir, the Kangra and Kullu Valley in Himachal Pradesh. This region');
  console.log('is well-known for its hill stations."\n');

  let paragraph1Found = false;
  for (const point of allPoints) {
    const text = point.payload.text || '';
    const page = point.payload.page || point.payload.pageNumber || 'Unknown';
    
    // Check if text contains key phrases from paragraph 1
    const hasHimachal = text.includes('Himachal') || text.includes('himachal');
    const hasLesserHimalaya = text.includes('lesser Himalaya') || text.includes('lesser himalaya');
    const hasPirPanjal = text.includes('Pir Panjal') || text.includes('pir panjal');
    const hasKangra = text.includes('Kangra') || text.includes('kangra');
    const hasKullu = text.includes('Kullu') || text.includes('kullu');
    
    if (hasHimachal && hasLesserHimalaya && (hasPirPanjal || hasKangra || hasKullu)) {
      paragraph1Found = true;
      console.log('✅ FOUND ON PAGE', page);
      console.log('─'.repeat(100));
      console.log('Chunk ID:', point.id);
      console.log('Page Number:', page);
      console.log('\nActual Text:');
      console.log(text);
      console.log('\n');
      
      // Check spelling accuracy
      console.log('Spelling Check:');
      PARAGRAPH_1_KEYWORDS.forEach(keyword => {
        const found = text.includes(keyword);
        console.log(`  ${found ? '✅' : '❌'} ${keyword}`);
      });
      console.log('\n');
    }
  }

  if (!paragraph1Found) {
    console.log('❌ PARAGRAPH 1 NOT FOUND\n');
    console.log('Searching for partial matches...\n');
    
    for (const point of allPoints) {
      const text = point.payload.text || '';
      const page = point.payload.page || point.payload.pageNumber || 'Unknown';
      
      const matchCount = PARAGRAPH_1_KEYWORDS.filter(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      
      if (matchCount >= 3) {
        console.log(`⚠️  Partial match on Page ${page} (${matchCount}/${PARAGRAPH_1_KEYWORDS.length} keywords)`);
        console.log('Text preview:', text.substring(0, 300) + '...\n');
      }
    }
  }

  // ===== SEARCH FOR PARAGRAPH 2 =====
  console.log('\n📝 PARAGRAPH 2: Deccan Trap/Aravali Hills');
  console.log('─'.repeat(100));
  console.log('Expected content:');
  console.log('"One of the distinct features of the Peninsular plateau is the black soil area');
  console.log('known as Deccan Trap. This is of volcanic origin, hence, the rocks are igneous.');
  console.log('Actually, these rocks have denuded over time and are responsible for the formation');
  console.log('of black soil. The Aravali Hills lie on the western and northwestern margins of the');
  console.log('Peninsular plateau. These are highly eroded hills and are found as broken hills.');
  console.log('They extend from Gujarat to Delhi in a southwest-northeast direction."\n');

  let paragraph2Found = false;
  for (const point of allPoints) {
    const text = point.payload.text || '';
    const page = point.payload.page || point.payload.pageNumber || 'Unknown';
    
    // Check if text contains key phrases from paragraph 2
    const hasDeccanTrap = text.includes('Deccan Trap') || text.includes('deccan trap') || text.includes('Decean Trap');
    const hasVolcanic = text.includes('volcanic origin') || text.includes('volcanic');
    const hasIgneous = text.includes('igneous');
    const hasAravali = text.includes('Aravali') || text.includes('aravali');
    const hasBlackSoil = text.includes('black soil');
    
    if (hasDeccanTrap && (hasVolcanic || hasIgneous || hasAravali || hasBlackSoil)) {
      paragraph2Found = true;
      console.log('✅ FOUND ON PAGE', page);
      console.log('─'.repeat(100));
      console.log('Chunk ID:', point.id);
      console.log('Page Number:', page);
      console.log('\nActual Text:');
      console.log(text);
      console.log('\n');
      
      // Check spelling accuracy
      console.log('Spelling Check:');
      PARAGRAPH_2_KEYWORDS.forEach(keyword => {
        const found = text.toLowerCase().includes(keyword.toLowerCase());
        console.log(`  ${found ? '✅' : '❌'} ${keyword}`);
      });
      console.log('\n');
    }
  }

  if (!paragraph2Found) {
    console.log('❌ PARAGRAPH 2 NOT FOUND\n');
    console.log('Searching for partial matches...\n');
    
    for (const point of allPoints) {
      const text = point.payload.text || '';
      const page = point.payload.page || point.payload.pageNumber || 'Unknown';
      
      const matchCount = PARAGRAPH_2_KEYWORDS.filter(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      
      if (matchCount >= 3) {
        console.log(`⚠️  Partial match on Page ${page} (${matchCount}/${PARAGRAPH_2_KEYWORDS.length} keywords)`);
        console.log('Text preview:', text.substring(0, 300) + '...\n');
      }
    }
  }

  // ===== SUMMARY =====
  console.log('\n' + '='.repeat(100));
  console.log('📊 SEARCH SUMMARY');
  console.log('='.repeat(100) + '\n');
  console.log(`Paragraph 1 (Himachal/Lesser Himalaya): ${paragraph1Found ? '✅ FOUND' : '❌ NOT FOUND'}`);
  console.log(`Paragraph 2 (Deccan Trap/Aravali): ${paragraph2Found ? '✅ FOUND' : '❌ NOT FOUND'}`);
  console.log('');
}

main().catch(console.error);

