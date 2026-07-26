/**
 * Auto-Flashcard Generation from Smart Detections API
 * 
 * POST /api/flashcards/generate
 * Generate flashcards from smart detection results
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { executeQuery, executeUpdate } from '@/lib/db/connection';
import { v4 as uuidv4 } from 'uuid';

interface Detection {
  id: string;
  detection_type: 'date' | 'formula' | 'chemical' | 'definition' | 'event';
  detected_text: string;
  parsed_data: any;
  context_text: string;
}

/**
 * POST /api/flashcards/generate
 * Generate flashcards from smart detections
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { noteId, detectionIds } = body;

    if (!noteId) {
      return NextResponse.json(
        { success: false, error: 'Note ID is required' },
        { status: 400 }
      );
    }

    // Verify note ownership
    const noteResults = await executeQuery(
      'SELECT user_id FROM user_notes WHERE id = ?',
      [noteId]
    );

    if (!Array.isArray(noteResults) || noteResults.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Note not found' },
        { status: 404 }
      );
    }

    if (noteResults[0].user_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Fetch detections
    let detections: Detection[];
    if (detectionIds && detectionIds.length > 0) {
      // Fetch specific detections
      const placeholders = detectionIds.map(() => '?').join(',');
      detections = await executeQuery(
        `SELECT * FROM note_smart_detections 
         WHERE note_id = ? AND id IN (${placeholders})`,
        [noteId, ...detectionIds]
      ) as Detection[];
    } else {
      // Fetch all detections for the note
      detections = await executeQuery(
        'SELECT * FROM note_smart_detections WHERE note_id = ?',
        [noteId]
      ) as Detection[];
    }

    if (!detections || detections.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No detections found' },
        { status: 404 }
      );
    }

    // Generate flashcards from detections
    const flashcards = [];
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    for (const detection of detections) {
      const flashcard = generateFlashcardFromDetection(detection);
      if (flashcard) {
        const flashcardId = uuidv4();
        
        // Insert flashcard into database
        await executeUpdate(
          `INSERT INTO note_flashcards (
            id, note_id, question, answer, card_type, difficulty_level,
            auto_generated, generation_confidence, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            flashcardId,
            noteId,
            flashcard.question,
            flashcard.answer,
            flashcard.card_type,
            flashcard.difficulty_level,
            1, // auto_generated = true
            flashcard.confidence,
            1, // is_active = true
            now,
            now,
          ]
        );

        flashcards.push({
          id: flashcardId,
          ...flashcard,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        flashcards,
        count: flashcards.length,
      },
    });

  } catch (error) {
    console.error('❌ Generate flashcards error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate a flashcard from a detection
 */
function generateFlashcardFromDetection(detection: Detection) {
  const { detection_type, detected_text, parsed_data, context_text } = detection;

  switch (detection_type) {
    case 'definition':
      // Extract term and definition from parsed_data or detected_text
      const term = parsed_data?.term || detected_text.split(':')[0]?.trim() || detected_text.substring(0, 50);
      const definition = parsed_data?.definition || detected_text.split(':')[1]?.trim() || context_text;

      return {
        question: `What is ${term}?`,
        answer: definition,
        card_type: 'definition',
        difficulty_level: 'medium',
        confidence: 0.85,
      };

    case 'formula':
      // Extract formula name and expression
      const formulaName = parsed_data?.name || detected_text.split('=')[0]?.trim() || 'Formula';
      const formulaExpression = parsed_data?.expression || detected_text;
      const formulaExplanation = parsed_data?.explanation || context_text;

      return {
        question: `What is the formula for ${formulaName}?`,
        answer: `${formulaExpression}\n\n${formulaExplanation}`,
        card_type: 'formula',
        difficulty_level: 'hard',
        confidence: 0.90,
      };

    case 'chemical':
      // Extract chemical equation
      const reactants = parsed_data?.reactants || detected_text.split('→')[0]?.trim() || '';
      const products = parsed_data?.products || detected_text.split('→')[1]?.trim() || '';
      const equation = detected_text;

      return {
        question: `What are the products when ${reactants} react?`,
        answer: `${products}\n\nFull equation: ${equation}`,
        card_type: 'concept',
        difficulty_level: 'medium',
        confidence: 0.80,
      };

    case 'date':
    case 'event':
      // Extract event and date
      const event = parsed_data?.event || context_text || detected_text;
      const date = parsed_data?.date || detected_text;

      return {
        question: `When did ${event} occur?`,
        answer: date,
        card_type: 'concept',
        difficulty_level: 'easy',
        confidence: 0.75,
      };

    default:
      return null;
  }
}

