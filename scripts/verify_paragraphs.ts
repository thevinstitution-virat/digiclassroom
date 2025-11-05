/**
 * Verify Specific Paragraphs in Qdrant Database
 * 
 * This script searches for two specific paragraphs from the geography textbook
 * to verify they are present with correct spelling and formatting.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'ncert-books-enhanced';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

// Target paragraphs to search for
const PARAGRAPH_1 = `The range lying to the south of the Himadri forms the most rugged mountain system and is known as Himachal or lesser Himalaya. The ranges are mainly composed of highly compressed and altered rocks. The altitude varies between 3,700 and 4,500 metres and the average width is of 50 Km. While the Pir Panjal range forms the longest and the most important range, the Dhauladhar and the Mahabharat ranges are also prominent ones. This range consists of the famous valley of Kashmir, the Kangra and Kullu Valley in Himachal Pradesh. This region is well-known for its hill stations.`;

const PARAGRAPH_2 = `One of the distinct features of the Peninsular plateau is the black soil area known as Deccan Trap. This is of volcanic origin, hence, the rocks are igneous. Actually, these rocks have denuded over time and are responsible for the formation of black soil. The Aravali Hills lie on the western and northwestern margins of the Peninsular plateau. These are highly eroded hills and are found as broken hills. They extend from Gujarat to Delhi in a southwest-northeast direction.`;

interface SearchResult {
  id: string | number;
  score: number;
  payload: any;
}

/**
 * Calculate text similarity using simple word overlap
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  
  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Search for a paragraph in Qdrant using scroll (no embeddings needed)
 */
async function searchForParagraph(
  client: QdrantClient,
  targetParagraph: string,
  paragraphName: string
): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 Searching for ${paragraphName}`);
  console.log(`${'='.repeat(80)}\n`);
  
  console.log(`📝 Target text (first 100 chars): "${targetParagraph.substring(0, 100)}..."\n`);
  
  try {
    // Use scroll to get all points from the collection
    console.log(`📊 Scrolling through collection: ${COLLECTION_NAME}...`);
    
    let offset: string | number | null = null;
    let totalChecked = 0;
    let bestMatch: { result: SearchResult; similarity: number } | null = null;
    const matches: Array<{ result: SearchResult; similarity: number }> = [];
    
    // Scroll through all points
    while (true) {
      const scrollResult = await client.scroll(COLLECTION_NAME, {
        limit: 100,
        with_payload: true,
        with_vector: false,
        offset: offset as any,
        filter: {
          must: [
            { key: 'subject', match: { value: 'Geography' } },
            { key: 'class', match: { value: 'Class 9' } }
          ]
        }
      });
      
      if (scrollResult.points.length === 0) {
        break;
      }
      
      // Check each point for similarity
      for (const point of scrollResult.points) {
        totalChecked++;
        const content = (point.payload as any)?.text || '';
        
        // Calculate similarity
        const similarity = calculateTextSimilarity(targetParagraph, content);
        
        // Store if similarity is high
        if (similarity > 0.3) {
          matches.push({ result: point as SearchResult, similarity });
          
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { result: point as SearchResult, similarity };
          }
        }
      }
      
      // Check if we have more results
      if (scrollResult.points.length < 100) {
        break;
      }
      
      offset = scrollResult.points[scrollResult.points.length - 1].id;
    }
    
    console.log(`✅ Checked ${totalChecked} chunks from the database\n`);
    
    // Report results
    if (matches.length === 0) {
      console.log(`❌ NO MATCHES FOUND`);
      console.log(`   The paragraph was not found in the database.\n`);
      return;
    }
    
    console.log(`✅ Found ${matches.length} potential match(es)\n`);
    
    // Sort matches by similarity
    matches.sort((a, b) => b.similarity - a.similarity);
    
    // Show top 3 matches
    const topMatches = matches.slice(0, 3);
    
    for (let i = 0; i < topMatches.length; i++) {
      const match = topMatches[i];
      const payload = match.result.payload as any;
      
      console.log(`${'─'.repeat(80)}`);
      console.log(`📄 Match #${i + 1} (Similarity: ${(match.similarity * 100).toFixed(1)}%)`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`ID: ${match.result.id}`);
      console.log(`Page: ${payload.page || 'N/A'}`);
      console.log(`Extraction Method: ${payload.extraction_method || 'N/A'}`);
      console.log(`\n📝 Content (first 200 chars):`);
      console.log(`"${(payload.text || '').substring(0, 200)}..."`);
      console.log(`\n📝 Full Content:`);
      console.log(`"${payload.text || ''}"`);
      console.log();
    }
    
    // Detailed comparison with best match
    if (bestMatch) {
      console.log(`${'='.repeat(80)}`);
      console.log(`🎯 BEST MATCH ANALYSIS (${(bestMatch.similarity * 100).toFixed(1)}% similarity)`);
      console.log(`${'='.repeat(80)}\n`);
      
      const storedText = (bestMatch.result.payload as any)?.text || '';
      
      console.log(`📊 Comparison:`);
      console.log(`   Target length: ${targetParagraph.length} characters`);
      console.log(`   Stored length: ${storedText.length} characters`);
      console.log(`   Similarity: ${(bestMatch.similarity * 100).toFixed(1)}%\n`);
      
      if (bestMatch.similarity > 0.8) {
        console.log(`✅ HIGH SIMILARITY - Content appears to be correctly stored`);
      } else if (bestMatch.similarity > 0.5) {
        console.log(`⚠️  MODERATE SIMILARITY - Content may have formatting differences`);
      } else {
        console.log(`❌ LOW SIMILARITY - Content may be corrupted or incorrectly extracted`);
      }
      
      // Check for exact match
      if (storedText.includes(targetParagraph) || targetParagraph.includes(storedText)) {
        console.log(`✅ EXACT SUBSTRING MATCH FOUND`);
      } else {
        console.log(`⚠️  No exact substring match - checking for encoding issues...`);
        
        // Check for common encoding issues
        const hasEncodingIssues = storedText.includes('\\u') || /[\x00-\x1F\x7F-\x9F]/.test(storedText);
        if (hasEncodingIssues) {
          console.log(`❌ ENCODING ISSUES DETECTED in stored text`);
        }
      }
    }
    
  } catch (error) {
    console.error(`❌ Error searching for paragraph:`, error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📚 PARAGRAPH VERIFICATION TOOL`);
  console.log(`${'='.repeat(80)}\n`);
  
  console.log(`🔧 Configuration:`);
  console.log(`   Qdrant URL: ${QDRANT_URL}`);
  console.log(`   Collection: ${COLLECTION_NAME}`);
  console.log(`   Subject: Geography`);
  console.log(`   Class: Class 9\n`);
  
  // Initialize Qdrant client
  const client = new QdrantClient({ url: QDRANT_URL });
  
  // Check collection exists
  try {
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);
    
    if (!collectionExists) {
      console.error(`❌ Collection "${COLLECTION_NAME}" does not exist!`);
      console.log(`\nAvailable collections:`);
      collections.collections.forEach(c => console.log(`   - ${c.name}`));
      process.exit(1);
    }
    
    console.log(`✅ Collection "${COLLECTION_NAME}" found\n`);
    
    // Get collection info
    const collectionInfo = await client.getCollection(COLLECTION_NAME);
    console.log(`📊 Collection stats:`);
    console.log(`   Total points: ${collectionInfo.points_count}`);
    console.log(`   Vectors: ${collectionInfo.vectors_count}\n`);
    
  } catch (error) {
    console.error(`❌ Error checking collection:`, error);
    process.exit(1);
  }
  
  // Search for both paragraphs
  await searchForParagraph(client, PARAGRAPH_1, 'Paragraph 1 (Himachal/Lesser Himalaya)');
  await searchForParagraph(client, PARAGRAPH_2, 'Paragraph 2 (Deccan Trap/Aravali Hills)');
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ VERIFICATION COMPLETE`);
  console.log(`${'='.repeat(80)}\n`);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

