/**
 * Add More Words to Dictionary
 * Expands the dictionary with common English words
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    console.log('🌱 Adding more words to dictionary...')

    // Check if words already exist
    const existingCount = await executeQuerySingle<{ count: number }>(
      'SELECT COUNT(*) as count FROM dictionary_words'
    )

    if (existingCount && existingCount.count > 10) {
      return NextResponse.json({
        success: true,
        message: 'Dictionary already has sufficient words',
        wordsCount: existingCount.count
      })
    }

    // Common English words with Hindi translations
    const commonWords = [
      {
        word: 'Beautiful',
        pronunciation: '/ˈbjuːtɪfʊl/',
        partOfSpeech: 'adjective',
        englishDefinition: 'Pleasing the senses or mind aesthetically.',
        hindiTranslation: 'सुंदर, खूबसूरत',
        devanagariScript: 'ब्यूटिफुल',
        amarkoshaCategory: 'Aesthetic Qualities',
        semanticCluster: 'Beauty',
        examples: JSON.stringify([
          {
            english: 'She has a beautiful smile.',
            hindi: 'उसकी मुस्कान बहुत सुंदर है।'
          }
        ]),
        culturalContext: 'Beauty in Indian culture is often associated with inner qualities, reflected in the concept of "सुंदरता".',
        difficultyLevel: 'beginner',
        frequencyRank: 500
      },
      {
        word: 'Knowledge',
        pronunciation: '/ˈnɒlɪdʒ/',
        partOfSpeech: 'noun',
        englishDefinition: 'Facts, information, and skills acquired through experience or education.',
        hindiTranslation: 'ज्ञान, विद्या',
        devanagariScript: 'नॉलेज',
        amarkoshaCategory: 'Mental Faculties',
        semanticCluster: 'Learning',
        examples: JSON.stringify([
          {
            english: 'Knowledge is power.',
            hindi: 'ज्ञान ही शक्ति है।'
          }
        ]),
        culturalContext: 'In Indian philosophy, "ज्ञान" (gyan) is considered one of the highest pursuits, as mentioned in ancient texts.',
        difficultyLevel: 'intermediate',
        frequencyRank: 800
      },
      {
        word: 'Happiness',
        pronunciation: '/ˈhæpɪnəs/',
        partOfSpeech: 'noun',
        englishDefinition: 'The feeling or state of being happy.',
        hindiTranslation: 'खुशी, प्रसन्नता',
        devanagariScript: 'हैप्पीनेस',
        amarkoshaCategory: 'Emotional States',
        semanticCluster: 'Joy',
        examples: JSON.stringify([
          {
            english: 'Money cannot buy happiness.',
            hindi: 'पैसे से खुशी नहीं खरीदी जा सकती।'
          }
        ]),
        culturalContext: 'Indian philosophy emphasizes "आनंद" (anand) as true bliss, different from temporary happiness.',
        difficultyLevel: 'beginner',
        frequencyRank: 600
      },
      {
        word: 'Education',
        pronunciation: '/ˌɛdʒʊˈkeɪʃən/',
        partOfSpeech: 'noun',
        englishDefinition: 'The process of receiving or giving systematic instruction.',
        hindiTranslation: 'शिक्षा, विद्या',
        devanagariScript: 'एजुकेशन',
        amarkoshaCategory: 'Learning Systems',
        semanticCluster: 'Teaching',
        examples: JSON.stringify([
          {
            english: 'Education is the foundation of progress.',
            hindi: 'शिक्षा प्रगति की आधारशिला है।'
          }
        ]),
        culturalContext: 'In Indian tradition, "शिक्षा" is revered, with the concept of "गुरु-शिष्य परंपरा" (teacher-student tradition).',
        difficultyLevel: 'intermediate',
        frequencyRank: 700
      },
      {
        word: 'Friend',
        pronunciation: '/frɛnd/',
        partOfSpeech: 'noun',
        englishDefinition: 'A person with whom one has a bond of mutual affection.',
        hindiTranslation: 'मित्र, दोस्त',
        devanagariScript: 'फ्रेंड',
        amarkoshaCategory: 'Social Relations',
        semanticCluster: 'Relationships',
        examples: JSON.stringify([
          {
            english: 'A friend in need is a friend indeed.',
            hindi: 'मुसीबत में काम आने वाला ही सच्चा मित्र है।'
          }
        ]),
        culturalContext: 'Friendship in Indian culture is sacred, often compared to the bond between Krishna and Sudama.',
        difficultyLevel: 'beginner',
        frequencyRank: 300
      },
      {
        word: 'Success',
        pronunciation: '/səkˈsɛs/',
        partOfSpeech: 'noun',
        englishDefinition: 'The accomplishment of an aim or purpose.',
        hindiTranslation: 'सफलता, कामयाबी',
        devanagariScript: 'सक्सेस',
        amarkoshaCategory: 'Achievement',
        semanticCluster: 'Victory',
        examples: JSON.stringify([
          {
            english: 'Hard work leads to success.',
            hindi: 'कड़ी मेहनत सफलता दिलाती है।'
          }
        ]),
        culturalContext: 'Success in Indian philosophy is measured not just by material gain but by dharmic achievement.',
        difficultyLevel: 'intermediate',
        frequencyRank: 900
      },
      {
        word: 'Love',
        pronunciation: '/lʌv/',
        partOfSpeech: 'noun',
        englishDefinition: 'An intense feeling of deep affection.',
        hindiTranslation: 'प्रेम, प्यार',
        devanagariScript: 'लव',
        amarkoshaCategory: 'Emotional States',
        semanticCluster: 'Affection',
        examples: JSON.stringify([
          {
            english: 'Love conquers all.',
            hindi: 'प्रेम सब पर विजय पाता है।'
          }
        ]),
        culturalContext: 'Love in Indian culture encompasses "प्रेम" (divine love) and "स्नेह" (affectionate love).',
        difficultyLevel: 'beginner',
        frequencyRank: 200
      },
      {
        word: 'Wisdom',
        pronunciation: '/ˈwɪzdəm/',
        partOfSpeech: 'noun',
        englishDefinition: 'The quality of having experience, knowledge, and good judgment.',
        hindiTranslation: 'बुद्धिमत्ता, प्रज्ञा',
        devanagariScript: 'विज्डम',
        amarkoshaCategory: 'Mental Qualities',
        semanticCluster: 'Intelligence',
        examples: JSON.stringify([
          {
            english: 'With age comes wisdom.',
            hindi: 'उम्र के साथ बुद्धिमत्ता आती है।'
          }
        ]),
        culturalContext: 'Wisdom or "प्रज्ञा" is highly valued in Indian scriptures, considered higher than mere knowledge.',
        difficultyLevel: 'intermediate',
        frequencyRank: 1200
      },
      {
        word: 'Peace',
        pronunciation: '/piːs/',
        partOfSpeech: 'noun',
        englishDefinition: 'A state of tranquility or quiet.',
        hindiTranslation: 'शांति, अमन',
        devanagariScript: 'पीस',
        amarkoshaCategory: 'Mental States',
        semanticCluster: 'Tranquility',
        examples: JSON.stringify([
          {
            english: 'Inner peace is true wealth.',
            hindi: 'आंतरिक शांति ही सच्चा धन है।'
          }
        ]),
        culturalContext: 'Peace or "शांति" is central to Indian philosophy, often invoked in prayers and mantras.',
        difficultyLevel: 'beginner',
        frequencyRank: 400
      },
      {
        word: 'Journey',
        pronunciation: '/ˈdʒɜːni/',
        partOfSpeech: 'noun',
        englishDefinition: 'An act of traveling from one place to another.',
        hindiTranslation: 'यात्रा, सफर',
        devanagariScript: 'जर्नी',
        amarkoshaCategory: 'Movement',
        semanticCluster: 'Travel',
        examples: JSON.stringify([
          {
            english: 'Life is a journey, not a destination.',
            hindi: 'जीवन एक यात्रा है, मंजिल नहीं।'
          }
        ]),
        culturalContext: 'Journey in Indian culture often refers to spiritual quest, like "तीर्थयात्रा" (pilgrimage).',
        difficultyLevel: 'intermediate',
        frequencyRank: 1000
      }
    ]

    // Insert words
    let insertedCount = 0
    for (const word of commonWords) {
      try {
        await executeQuery(
          `INSERT INTO dictionary_words 
           (word, pronunciation, part_of_speech, english_definition, hindi_translation, 
            devanagari_script, amarkosha_category, semantic_cluster, examples, 
            cultural_context, difficulty_level, frequency_rank, source) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            word.word, word.pronunciation, word.partOfSpeech, word.englishDefinition,
            word.hindiTranslation, word.devanagariScript, word.amarkoshaCategory,
            word.semanticCluster, word.examples, word.culturalContext,
            word.difficultyLevel, word.frequencyRank, 'system'
          ]
        )
        insertedCount++
      } catch (error: any) {
        if (!error.message.includes('Duplicate entry')) {
          console.error(`Error inserting word ${word.word}:`, error)
        }
      }
    }

    console.log(`✅ Added ${insertedCount} new words to dictionary`)

    return NextResponse.json({
      success: true,
      message: `Successfully added ${insertedCount} words to dictionary`,
      wordsAdded: insertedCount,
      totalWords: (existingCount?.count || 0) + insertedCount
    })

  } catch (error) {
    console.error('❌ Failed to add words:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add words to dictionary',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
