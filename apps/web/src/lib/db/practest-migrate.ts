// VG Kosh Practest Engine - Database Migration Runner

import mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'

// Database connection configuration
const getConnection = async () => {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'virat_gyankosh',
    charset: 'utf8mb4',
    multipleStatements: true // Allow multiple SQL statements
  })
}

export async function runPractestMigration() {
  const connection = await getConnection()
  
  try {
    console.log('🚀 Starting Practest database migration...')
    
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/003_practest_tables.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Execute the migration
    console.log('📊 Creating Practest tables...')
    await connection.execute(migrationSQL)
    
    console.log('✅ Practest migration completed successfully!')
    
    // Insert some sample data for testing
    await insertSampleData(connection)
    
    console.log('🎯 Sample data inserted successfully!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await connection.end()
  }
}

async function insertSampleData(connection: mysql.Connection) {
  console.log('📝 Inserting sample questions...')
  
  // Sample questions for testing
  const sampleQuestions = [
    {
      question_text: 'What is the value of π (pi) approximately?',
      question_type: 'MCQ',
      option_a: '3.14',
      option_b: '3.41',
      option_c: '2.14',
      option_d: '4.13',
      correct_option: 'A',
      explanation: 'π (pi) is approximately 3.14159, so 3.14 is the closest approximation.',
      board: 'CBSE',
      class_level: 10,
      subject: 'Mathematics',
      chapter: 'Introduction to Trigonometry',
      topic: 'Basic Concepts',
      difficulty_level: 'EASY',
      bloom_level: 'REMEMBER',
      has_math_content: true,
      validation_status: 'APPROVED',
      created_by: 'system'
    },
    {
      question_text: 'Solve the quadratic equation: x² - 5x + 6 = 0',
      question_type: 'MCQ',
      option_a: 'x = 2, 3',
      option_b: 'x = 1, 6',
      option_c: 'x = -2, -3',
      option_d: 'x = 5, 1',
      correct_option: 'A',
      explanation: 'Using factorization: x² - 5x + 6 = (x-2)(x-3) = 0, so x = 2 or x = 3',
      board: 'CBSE',
      class_level: 10,
      subject: 'Mathematics',
      chapter: 'Quadratic Equations',
      topic: 'Solving by Factorization',
      difficulty_level: 'MEDIUM',
      bloom_level: 'APPLY',
      has_math_content: true,
      validation_status: 'APPROVED',
      created_by: 'system'
    },
    {
      question_text: 'What is the chemical formula for water?',
      question_type: 'MCQ',
      option_a: 'H₂O',
      option_b: 'CO₂',
      option_c: 'NaCl',
      option_d: 'H₂SO₄',
      correct_option: 'A',
      explanation: 'Water consists of two hydrogen atoms and one oxygen atom, hence H₂O.',
      board: 'CBSE',
      class_level: 9,
      subject: 'Science',
      chapter: 'Atoms and Molecules',
      topic: 'Chemical Formulas',
      difficulty_level: 'EASY',
      bloom_level: 'REMEMBER',
      has_chemical_formulas: true,
      validation_status: 'APPROVED',
      created_by: 'system'
    },
    {
      question_text: 'Explain the process of photosynthesis in plants.',
      question_type: 'SUBJECTIVE',
      model_answer: 'Photosynthesis is the process by which plants convert light energy into chemical energy. It occurs in chloroplasts and involves two main stages: light reactions and dark reactions (Calvin cycle). The overall equation is: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂',
      explanation: 'This question tests understanding of the fundamental biological process of photosynthesis.',
      board: 'CBSE',
      class_level: 10,
      subject: 'Science',
      chapter: 'Life Processes',
      topic: 'Nutrition in Plants',
      difficulty_level: 'MEDIUM',
      bloom_level: 'UNDERSTAND',
      has_chemical_formulas: true,
      validation_status: 'APPROVED',
      created_by: 'system'
    },
    {
      question_text: 'The capital of India is _______.',
      question_type: 'FILL_BLANK',
      model_answer: 'New Delhi',
      keywords: '["New Delhi", "Delhi"]',
      explanation: 'New Delhi is the capital city of India.',
      board: 'CBSE',
      class_level: 6,
      subject: 'Social Studies',
      chapter: 'Our Country India',
      topic: 'Political Geography',
      difficulty_level: 'EASY',
      bloom_level: 'REMEMBER',
      validation_status: 'APPROVED',
      created_by: 'system'
    }
  ]
  
  for (const question of sampleQuestions) {
    const contentHash = require('crypto')
      .createHash('md5')
      .update(question.question_text + question.subject + question.chapter)
      .digest('hex')
    
    await connection.execute(`
      INSERT INTO practest_question_bank (
        question_text, question_type, option_a, option_b, option_c, option_d,
        correct_option, model_answer, keywords, explanation, max_marks,
        time_limit_seconds, has_math_content, has_chemical_formulas,
        has_diagrams, board, class_level, subject, chapter, topic,
        difficulty_level, bloom_level, content_hash, validation_status,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      question.question_text,
      question.question_type,
      question.option_a || null,
      question.option_b || null,
      question.option_c || null,
      question.option_d || null,
      question.correct_option || null,
      question.model_answer || null,
      question.keywords || null,
      question.explanation,
      1.0, // max_marks
      120, // time_limit_seconds
      question.has_math_content || false,
      question.has_chemical_formulas || false,
      false, // has_diagrams
      question.board,
      question.class_level,
      question.subject,
      question.chapter,
      question.topic,
      question.difficulty_level,
      question.bloom_level,
      contentHash,
      question.validation_status,
      question.created_by
    ])
  }
  
  // Insert a sample test configuration
  await connection.execute(`
    INSERT INTO practest_test_configurations (
      name, description, board, class_level, subject, chapters,
      total_questions, duration_minutes, max_marks, difficulty_distribution,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'Class 10 Mathematics Quick Test',
    'A quick 20-question test covering basic mathematics concepts',
    'CBSE',
    10,
    'Mathematics',
    JSON.stringify(['Quadratic Equations', 'Introduction to Trigonometry']),
    20,
    40,
    20.0,
    JSON.stringify({ EASY: 6, MEDIUM: 10, HARD: 4 }),
    'system'
  ])
}

// Run migration if called directly
if (require.main === module) {
  runPractestMigration()
    .then(() => {
      console.log('✅ Migration completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error)
      process.exit(1)
    })
}
