import { executeQuery, executeQuerySingle, withTransaction } from './connection'
import { generateId } from '@/lib/utils'

// Initialize database with sample data for testing
export async function initializeDatabase() {
  try {
    console.log('Initializing database...')

    // Create sample organization (Phase 4.1: legacy `tenants` table dropped;
    // Better Auth `organization` is the unified table).
    const tenantId = generateId()
    await executeQuery(
      `INSERT INTO \`organization\` (id, name, slug, subscription_plan, subscription_status, settings, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        tenantId,
        'Demo Educational Institute',
        'demo-educational-institute',
        'pro',
        'active',
        JSON.stringify({
          features: ['ai_chat', 'advanced_analytics', 'custom_branding'],
          limits: { maxClasses: 20, maxStudentsPerClass: 50 }
        })
      ]
    )

    // Create sample classes
    const classes = [
      {
        id: generateId(),
        name: 'Mathematics Grade 8',
        description: 'Advanced mathematics for grade 8 students',
        gradeLevel: 8,
        subjects: ['Algebra', 'Geometry', 'Statistics'],
      },
      {
        id: generateId(),
        name: 'Science Grade 8',
        description: 'Comprehensive science curriculum',
        gradeLevel: 8,
        subjects: ['Physics', 'Chemistry', 'Biology'],
      },
      {
        id: generateId(),
        name: 'English Literature Grade 8',
        description: 'English language and literature studies',
        gradeLevel: 8,
        subjects: ['Reading', 'Writing', 'Literature Analysis'],
      },
    ]

    for (const classData of classes) {
      await executeQuery(
        `INSERT INTO classes (id, organization_id, name, description, grade_level, qdrant_namespace, subjects, settings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          classData.id,
          tenantId,
          classData.name,
          classData.description,
          classData.gradeLevel,
          `org_${tenantId}_class_${classData.id}`,
          JSON.stringify(classData.subjects),
          JSON.stringify({})
        ]
      )
    }

    // Create sample educational content
    const sampleContent = [
      {
        classId: classes[0].id, // Math class
        title: 'Introduction to Algebra',
        content: `Algebra is a branch of mathematics that uses symbols and letters to represent numbers and quantities in formulas and equations. 

Key Concepts:
1. Variables: Letters like x, y, z that represent unknown numbers
2. Constants: Fixed numbers like 5, -3, 0.5
3. Expressions: Combinations of variables and constants like 3x + 5
4. Equations: Mathematical statements that show two expressions are equal, like 3x + 5 = 14

Basic Operations:
- Addition and Subtraction: Combine like terms (3x + 2x = 5x)
- Multiplication: Use distributive property (3(x + 2) = 3x + 6)
- Division: Isolate variables (if 2x = 10, then x = 5)

Solving Simple Equations:
To solve x + 3 = 7:
1. Subtract 3 from both sides: x + 3 - 3 = 7 - 3
2. Simplify: x = 4

Practice is essential for mastering algebraic concepts!`,
        subject: 'Algebra',
        contentType: 'lesson',
        difficulty: 'beginner'
      },
      {
        classId: classes[0].id, // Math class
        title: 'Geometric Shapes and Properties',
        content: `Geometry studies shapes, sizes, and properties of figures and spaces.

Basic Shapes:
1. Triangle: 3 sides, angles sum to 180°
2. Square: 4 equal sides, 4 right angles
3. Rectangle: 4 sides, opposite sides equal, 4 right angles
4. Circle: All points equidistant from center

Properties:
- Perimeter: Distance around a shape
- Area: Space inside a shape
- Volume: Space inside a 3D object

Formulas:
- Triangle area: (base × height) ÷ 2
- Rectangle area: length × width
- Circle area: π × radius²
- Circle circumference: 2 × π × radius

Understanding these basics helps solve complex geometric problems.`,
        subject: 'Geometry',
        contentType: 'lesson',
        difficulty: 'beginner'
      },
      {
        classId: classes[1].id, // Science class
        title: 'Photosynthesis Process',
        content: `Photosynthesis is the process by which plants make their own food using sunlight, water, and carbon dioxide.

The Process:
1. Light Absorption: Chlorophyll in leaves captures sunlight
2. Water Uptake: Roots absorb water from soil
3. CO2 Intake: Leaves take in carbon dioxide from air
4. Chemical Reaction: These combine to make glucose and oxygen

Chemical Equation:
6CO2 + 6H2O + light energy → C6H12O6 + 6O2

Key Components:
- Chloroplasts: Where photosynthesis occurs
- Chlorophyll: Green pigment that captures light
- Stomata: Tiny pores for gas exchange

Importance:
- Produces oxygen we breathe
- Creates food for plants and animals
- Removes CO2 from atmosphere
- Foundation of most food chains

This process is essential for life on Earth!`,
        subject: 'Biology',
        contentType: 'lesson',
        difficulty: 'intermediate'
      },
      {
        classId: classes[2].id, // English class
        title: 'Elements of a Short Story',
        content: `A short story is a brief work of fiction that focuses on a single incident or character.

Key Elements:
1. Plot: Sequence of events (exposition, rising action, climax, falling action, resolution)
2. Character: People or beings in the story (protagonist, antagonist, supporting characters)
3. Setting: Time and place where story occurs
4. Theme: Central message or meaning
5. Point of View: Perspective from which story is told (first person, third person)
6. Conflict: Problem or struggle (internal vs external)

Story Structure:
- Beginning: Introduces characters and setting
- Middle: Develops conflict and builds tension
- End: Resolves conflict and provides closure

Literary Devices:
- Symbolism: Objects representing deeper meanings
- Foreshadowing: Hints about future events
- Irony: Contrast between expectation and reality

Reading short stories helps develop critical thinking and appreciation for literature.`,
        subject: 'Literature Analysis',
        contentType: 'lesson',
        difficulty: 'intermediate'
      }
    ]

    for (const content of sampleContent) {
      const contentId = generateId()
      await executeQuery(
        `INSERT INTO content (id, tenant_id, class_id, title, content, content_type, subject, difficulty, tags, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          contentId,
          tenantId,
          content.classId,
          content.title,
          content.content,
          content.contentType,
          content.subject,
          content.difficulty,
          JSON.stringify([content.subject.toLowerCase(), content.difficulty]),
          null // No specific creator for sample data
        ]
      )
    }

    console.log('Database initialized successfully!')
    console.log(`Tenant ID: ${tenantId}`)
    console.log(`Created ${classes.length} classes`)
    console.log(`Created ${sampleContent.length} content items`)

    return {
      success: true,
      tenantId,
      classCount: classes.length,
      contentCount: sampleContent.length,
    }

  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}

// Get sample tenant for testing
export async function getSampleTenant() {
  try {
    const tenant = await executeQuerySingle<{
      id: string
      name: string
      subscription_plan: string
      subscription_status: string
    }>(
      `SELECT id, name, subscription_plan, subscription_status
       FROM \`organization\`
       WHERE name = 'Demo Educational Institute'
       LIMIT 1`
    )

    return tenant
  } catch (error) {
    console.error('Error getting sample tenant:', error)
    return null
  }
}

// Create sample user for testing
export async function createSampleUser(
  clerkId: string,
  email: string,
  firstName: string,
  lastName: string,
  role: 'admin' | 'teacher' | 'student' | 'parent' = 'student'
) {
  try {
    const tenant = await getSampleTenant()
    if (!tenant) {
      throw new Error('No sample tenant found. Please initialize database first.')
    }

    const userId = generateId()
    
    // Get a sample class for students
    let classId = null
    if (role === 'student') {
      const sampleClass = await executeQuerySingle<{ id: string }>(
        'SELECT id FROM classes LIMIT 1'
      )
      classId = sampleClass?.id || null
    }

    // Phase 4.1: Better Auth `user` table. The Better Auth user.id is the
    // canonical user identity (the clerkId param is now used as the user.id
    // for back-compat in test fixtures).
    await executeQuery(
      `INSERT INTO \`user\` (id, email, name, role, first_name, last_name, class_id, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [clerkId, email, firstName + ' ' + lastName, role, firstName, lastName, classId, true]
    )

    console.log(`Created sample user: ${firstName} ${lastName} (${role})`)
    
    return {
      id: userId,
      tenantId: tenant.id,
      clerkId,
      email,
      role,
      firstName,
      lastName,
      classId,
    }

  } catch (error) {
    console.error('Error creating sample user:', error)
    throw error
  }
}

// Check if database is initialized
export async function isDatabaseInitialized(): Promise<boolean> {
  try {
    const tenant = await getSampleTenant()
    return tenant !== null
  } catch (error) {
    console.error('Error checking database initialization:', error)
    return false
  }
}

// Reset database (for development/testing)
export async function resetDatabase() {
  try {
    console.log('Resetting database...')

    // Delete in correct order to respect foreign key constraints
    await executeQuery('DELETE FROM analytics_events')
    await executeQuery('DELETE FROM assessment_submissions')
    await executeQuery('DELETE FROM assessments')
    await executeQuery('DELETE FROM learning_progress')
    await executeQuery('DELETE FROM chat_messages')
    await executeQuery('DELETE FROM chat_sessions')
    await executeQuery('DELETE FROM vector_embeddings')
    await executeQuery('DELETE FROM content')
    await executeQuery('DELETE FROM `user`')
    await executeQuery('DELETE FROM classes')
    await executeQuery('DELETE FROM `organization`')

    console.log('Database reset successfully!')
    
    return { success: true }

  } catch (error) {
    console.error('Error resetting database:', error)
    throw error
  }
}
