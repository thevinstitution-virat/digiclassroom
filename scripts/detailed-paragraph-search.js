/**
 * Detailed Paragraph Search with Text Extraction
 * 
 * This script extracts full text from chunks and searches for exact paragraph matches
 */

const { QdrantClient } = require('@qdrant/js-client-rest');

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

// Target paragraphs to search for
const TARGET_PARAGRAPHS = {
  paragraph1: {
    name: "Himachal/Lesser Himalaya Paragraph",
    keywords: ["Himachal", "lesser Himalaya", "Pir Panjal", "Kashmir", "Kangra", "Kullu Valley"],
    keyPhrases: [
      "range lying to the south of the Himadri",
      "most rugged mountain system",
      "Himachal or lesser Himalaya",
      "Pir Panjal range forms the longest",
      "valley of Kashmir",
      "Kangra and Kullu Valley"
    ]
  },
  paragraph2: {
    name: "Peninsular Plateau/Deccan Trap Paragraph",
    keywords: ["Peninsular plateau", "Deccan Trap", "volcanic origin", "Aravali Hills", "Gujarat", "Delhi"],
    keyPhrases: [
      "distinct features of the Peninsular plateau",
      "black soil area known as Deccan Trap",
      "volcanic origin",
      "Aravali Hills lie on the western",
      "extend from Gujarat to Delhi"
    ]
  }
};

async function main() {
  console.log('🔍 Detailed Paragraph Search with Text Extraction\n');

  const client = new QdrantClient({
    url: QDRANT_URL,
    checkCompatibility: false
  });

  try {
    // Fetch all Geography chunks
    console.log('📚 Fetching all Geography chunks...\n');
    const allPoints = await fetchAllGeographyChunks(client);
    console.log(`✅ Fetched ${allPoints.length} chunks\n`);

    // Search for each target paragraph
    for (const [key, target] of Object.entries(TARGET_PARAGRAPHS)) {
      console.log('='.repeat(100));
      console.log(`SEARCHING FOR: ${target.name}`);
      console.log('='.repeat(100));
      console.log(`Keywords: ${target.keywords.join(', ')}\n`);

      // Find chunks containing keywords
      const matchingChunks = allPoints.filter(point => {
        const text = point.payload.text?.toLowerCase() || '';
        return target.keywords.some(keyword => text.includes(keyword.toLowerCase()));
      });

      console.log(`Found ${matchingChunks.length} chunks with matching keywords:\n`);

      matchingChunks.forEach((chunk, index) => {
        const text = chunk.payload.text || '';
        const page = chunk.payload.pageNumber || chunk.payload.page;
        
        console.log(`${'─'.repeat(100)}`);
        console.log(`CHUNK ${index + 1} - Page ${page}`);
        console.log(`${'─'.repeat(100)}`);
        
        // Check which key phrases are present
        const presentPhrases = target.keyPhrases.filter(phrase => 
          text.toLowerCase().includes(phrase.toLowerCase())
        );
        
        console.log(`Key phrases found: ${presentPhrases.length}/${target.keyPhrases.length}`);
        presentPhrases.forEach(phrase => {
          console.log(`   ✓ "${phrase}"`);
        });
        
        if (presentPhrases.length === 0) {
          console.log(`   ✗ No key phrases found (only keywords matched)`);
        }
        
        console.log(`\nFull text (${text.length} characters):`);
        console.log(`${'─'.repeat(100)}`);
        console.log(text);
        console.log(`${'─'.repeat(100)}\n`);
      });

      if (matchingChunks.length === 0) {
        console.log('❌ No chunks found with matching keywords!\n');
        console.log('Showing all chunk pages for reference:');
        allPoints.forEach(point => {
          const page = point.payload.pageNumber || point.payload.page;
          const textPreview = (point.payload.text || '').substring(0, 100);
          console.log(`   Page ${page}: ${textPreview}...`);
        });
      }

      console.log('\n');
    }

    // Additional analysis: Show page-by-page content summary
    console.log('='.repeat(100));
    console.log('PAGE-BY-PAGE CONTENT SUMMARY');
    console.log('='.repeat(100));
    
    const pageMap = new Map();
    allPoints.forEach(point => {
      const page = point.payload.pageNumber || point.payload.page;
      pageMap.set(page, point.payload.text || '');
    });

    const sortedPages = Array.from(pageMap.keys()).sort((a, b) => a - b);
    sortedPages.forEach(page => {
      const text = pageMap.get(page);
      const preview = text.substring(0, 200).replace(/\n/g, ' ');
      console.log(`\nPage ${page} (${text.length} chars):`);
      console.log(`   "${preview}..."`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function fetchAllGeographyChunks(client) {
  const allPoints = [];
  let offset = null;

  do {
    const scrollResult = await client.scroll(COLLECTION_NAME, {
      limit: 100,
      with_payload: true,
      with_vector: false,
      offset: offset,
      filter: {
        must: [
          { key: 'subject', match: { value: 'Geography' } }
        ]
      }
    });

    allPoints.push(...scrollResult.points);
    offset = scrollResult.next_page_offset || null;
  } while (offset !== null);

  return allPoints;
}

main().catch(console.error);

