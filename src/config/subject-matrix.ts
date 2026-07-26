/**
 * Subject Matrix Configuration for DigiClassroom Pro
 * Defines class-wise subject availability based on medium and stream
 *
 * This matrix is applicable to all boards (CBSE/ICSE/State Boards) and all user types
 * (Students/Parents & Guardians/Teachers)
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type Medium = 'ENGLISH' | 'HINDI';

export type Stream = 'HUMANITIES' | 'BIOLOGY' | 'MATHEMATICS' | 'COMMERCE' | 'ELECTIVES';

export interface SubjectAvailability {
  name: string;                      // Subject name
  availableInEnglish: boolean;       // Available in English medium
  availableInHindi: boolean;         // Available in Hindi medium
  isCore?: boolean;                  // Core subject flag (Classes 11-12)
  isOptional?: boolean;              // Optional subject flag (Classes 11-12)
  textbookCount?: number;            // Number of textbooks (e.g., English has 4)
  subSubjects?: string[];            // Sub-subjects (e.g., Social Science breakdown)
}

export interface ClassSubjectMatrix {
  classLevel: number;                // Class/Grade level (1-12)
  subjects: SubjectAvailability[];   // Array of subjects
  hasStreams: boolean;               // Stream-based flag (true for 11-12)
  streams?: {                        // Stream definitions (Classes 11-12)
    [key in Stream]?: {
      coreSubjects: string[];
      description: string;
    };
  };
  optionalSubjects?: string[];       // Optional subjects (Classes 11-12)
}

// ============================================================================
// Subject Matrix Configuration
// ============================================================================

export const SUBJECT_MATRIX: ClassSubjectMatrix[] = [
  // Classes 1-5: Primary Level (Identical structure)
  {
    classLevel: 1,
    subjects: [
      { name: 'Mathematics', availableInEnglish: true, availableInHindi: true },
      { name: 'English', availableInEnglish: true, availableInHindi: true },
      { name: 'Hindi', availableInEnglish: true, availableInHindi: true },
      { name: 'Environmental Studies', availableInEnglish: true, availableInHindi: true },
      { name: 'Physical Education', availableInEnglish: true, availableInHindi: false },
    ],
    hasStreams: false,
  },
  {
    classLevel: 2,
    subjects: [
      { name: 'Mathematics', availableInEnglish: true, availableInHindi: true },
      { name: 'English', availableInEnglish: true, availableInHindi: true },
      { name: 'Hindi', availableInEnglish: true, availableInHindi: true },
      { name: 'Environmental Studies', availableInEnglish: true, availableInHindi: true },
      { name: 'Physical Education', availableInEnglish: true, availableInHindi: false },
    ],
    hasStreams: false,
  },
  {
    classLevel: 3,
    subjects: [
      { name: 'Mathematics', availableInEnglish: true, availableInHindi: true },
      { name: 'English', availableInEnglish: true, availableInHindi: true },
      { name: 'Hindi', availableInEnglish: true, availableInHindi: true },
      { name: 'Environmental Studies', availableInEnglish: true, availableInHindi: true },
      { name: 'Physical Education', availableInEnglish: true, availableInHindi: false },
    ],
    hasStreams: false,
  },
  {
    classLevel: 4,
    subjects: [
      { name: 'Mathematics', availableInEnglish: true, availableInHindi: true },
      { name: 'English', availableInEnglish: true, availableInHindi: true },
      { name: 'Hindi', availableInEnglish: true, availableInHindi: true },
      { name: 'Environmental Studies', availableInEnglish: true, availableInHindi: true },
      { name: 'Physical Education', availableInEnglish: true, availableInHindi: false },
    ],
    hasStreams: false,
  },
  {
    classLevel: 5,
    subjects: [
      { name: 'Mathematics', availableInEnglish: true, availableInHindi: true },
      { name: 'English', availableInEnglish: true, availableInHindi: true },
      { name: 'Hindi', availableInEnglish: true, availableInHindi: true },
      { name: 'Environmental Studies', availableInEnglish: true, availableInHindi: true },
      { name: 'Physical Education', availableInEnglish: true, availableInHindi: false },
    ],
    hasStreams: false,
  },

  // Classes 6-8: Middle School (Identical structure)
  {
    classLevel: 6,
    subjects: [
      { name: 'Hindi', availableInEnglish: true, availableInHindi: true },
      { name: 'English', availableInEnglish: true, availableInHindi: true },
      { name: 'Mathematics', availableInEnglish: true, availableInHindi: true },
      { name: 'Social Science', availableInEnglish: true, availableInHindi: true },
      { name: 'Science', availableInEnglish: true, availableInHindi: true },
      { name: 'Physical Education', availableInEnglish: true, availableInHindi: false },
    ],
    hasStreams: false,
  },
  {
    classLevel: 7,
    subjects: [
      { name: 'Hindi', availableInEnglish: true, availableInHindi: true },
      { name: 'English', availableInEnglish: true, availableInHindi: true },
      { name: 'Mathematics', availableInEnglish: true, availableInHindi: true },
      { name: 'Social Science', availableInEnglish: true, availableInHindi: true },
      { name: 'Science', availableInEnglish: true, availableInHindi: true },
      { name: 'Physical Education', availableInEnglish: true, availableInHindi: false },
    ],
    hasStreams: false,
  },
  {
    classLevel: 8,
    subjects: [
      { name: 'Hindi', availableInEnglish: true, availableInHindi: true },
      { name: 'English', availableInEnglish: true, availableInHindi: true },
      { name: 'Mathematics', availableInEnglish: true, availableInHindi: true },
      { name: 'Social Science', availableInEnglish: true, availableInHindi: true },
      { name: 'Science', availableInEnglish: true, availableInHindi: true },
      { name: 'Physical Education', availableInEnglish: true, availableInHindi: false },
    ],
    hasStreams: false,
  },

  // Classes 9-10: Secondary Level (Identical structure)
  {
    classLevel: 9,
    subjects: [
      { name: 'English', availableInEnglish: true, availableInHindi: true, textbookCount: 4 },
      { name: 'Hindi', availableInEnglish: true, availableInHindi: true, textbookCount: 4 },
      { name: 'Mathematics', availableInEnglish: true, availableInHindi: true },
      { name: 'Science', availableInEnglish: true, availableInHindi: true },
      { name: 'Civics', availableInEnglish: true, availableInHindi: true },
      { name: 'Economics', availableInEnglish: true, availableInHindi: true },
      { name: 'History', availableInEnglish: true, availableInHindi: true },
      { name: 'Geography', availableInEnglish: true, availableInHindi: true },
      { name: 'Health & Physical Education', availableInEnglish: true, availableInHindi: false },
      { name: 'Information and Computer Technology', availableInEnglish: true, availableInHindi: false },
    ],
    hasStreams: false,
  },
  {
    classLevel: 10,
    subjects: [
      { name: 'English', availableInEnglish: true, availableInHindi: true, textbookCount: 4 },
      { name: 'Hindi', availableInEnglish: true, availableInHindi: true, textbookCount: 4 },
      { name: 'Mathematics', availableInEnglish: true, availableInHindi: true },
      { name: 'Science', availableInEnglish: true, availableInHindi: true },
      { name: 'Civics', availableInEnglish: true, availableInHindi: true },
      { name: 'Economics', availableInEnglish: true, availableInHindi: true },
      { name: 'History', availableInEnglish: true, availableInHindi: true },
      { name: 'Geography', availableInEnglish: true, availableInHindi: true },
      { name: 'Health & Physical Education', availableInEnglish: true, availableInHindi: false },
      { name: 'Information and Computer Technology', availableInEnglish: true, availableInHindi: false },
    ],
    hasStreams: false,
  },

  // Class 11: Senior Secondary - Stream-based
  {
    classLevel: 11,
    subjects: [],
    hasStreams: true,
    streams: {
      BIOLOGY: {
        coreSubjects: ['Biology', 'Chemistry', 'Physics'],
        description: 'Biology stream for students interested in medical and biological sciences',
      },
      MATHEMATICS: {
        coreSubjects: ['Physics', 'Chemistry', 'Mathematics'],
        description: 'Mathematics stream for students interested in engineering and technology',
      },
      COMMERCE: {
        coreSubjects: ['Accountancy', 'Business Studies', 'Economics'],
        description: 'Commerce stream for students interested in business and finance',
      },
      HUMANITIES: {
        coreSubjects: ['Geography', 'History', 'Political Science', 'Psychology', 'Sociology'],
        description: 'Humanities stream for students interested in social sciences and arts',
      },
      ELECTIVES: {
        coreSubjects: [
          'English',
          'Hindi',
          'Home Science',
          'Creative Writing and Translation',
          'Informatics Practices',
          'Computer Science',
          'Health & Physical Education',
          'Knowledge Traditions & Practices in India',
        ],
        description: 'Optional/Elective subjects available to students from all streams',
      },
    },
    optionalSubjects: [
      'English',
      'Hindi',
      'Home Science',
      'Creative Writing and Translation',
      'Informatics Practices',
      'Computer Science',
      'Health & Physical Education',
      'Knowledge Traditions & Practices in India',
    ],
  },

  // Class 12: Senior Secondary - Stream-based (includes Humanities)
  {
    classLevel: 12,
    subjects: [],
    hasStreams: true,
    streams: {
      BIOLOGY: {
        coreSubjects: ['Biology', 'Chemistry', 'Physics'],
        description: 'Biology stream for students interested in medical and biological sciences',
      },
      MATHEMATICS: {
        coreSubjects: ['Physics', 'Chemistry', 'Mathematics'],
        description: 'Mathematics stream for students interested in engineering and technology',
      },
      COMMERCE: {
        coreSubjects: ['Accountancy', 'Business Studies', 'Economics'],
        description: 'Commerce stream for students interested in business and finance',
      },
      HUMANITIES: {
        coreSubjects: ['Geography', 'History', 'Political Science', 'Psychology', 'Sociology'],
        description: 'Humanities stream for students interested in social sciences and arts',
      },
      ELECTIVES: {
        coreSubjects: [
          'English',
          'Hindi',
          'Home Science',
          'Creative Writing and Translation',
          'Informatics Practices',
          'Computer Science',
          'Health & Physical Education',
          'Knowledge Traditions & Practices in India',
        ],
        description: 'Optional/Elective subjects available to students from all streams',
      },
    },
    optionalSubjects: [
      'English',
      'Hindi',
      'Home Science',
      'Creative Writing and Translation',
      'Informatics Practices',
      'Computer Science',
      'Health & Physical Education',
      'Knowledge Traditions & Practices in India',
    ],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the subject matrix configuration for a specific class level
 */
export function getClassSubjectMatrix(classLevel: number): ClassSubjectMatrix | undefined {
  return SUBJECT_MATRIX.find((matrix) => matrix.classLevel === classLevel);
}

/**
 * Get available subjects for a specific class level, medium, and stream
 */
export function getAvailableSubjects(
  classLevel: number,
  medium: Medium,
  stream?: Stream,
  selectedOptionalSubjects?: string[]
): string[] {
  const matrix = getClassSubjectMatrix(classLevel);
  if (!matrix) {
    console.warn(`No subject matrix found for class ${classLevel}`);
    return [];
  }

  // For Classes 11-12 with streams
  if (matrix.hasStreams && stream && matrix.streams) {
    const streamData = matrix.streams[stream];
    if (!streamData) {
      console.warn(`No stream data found for ${stream} in class ${classLevel}`);
      return [];
    }

    // Combine core subjects with selected optional subjects
    const coreSubjects = streamData.coreSubjects;
    const optionalSubjects = selectedOptionalSubjects || [];

    return [...coreSubjects, ...optionalSubjects];
  }

  // For Classes 1-10 (non-stream based)
  const availableSubjects = matrix.subjects.filter((subject) => {
    if (medium === 'ENGLISH') {
      return subject.availableInEnglish;
    } else if (medium === 'HINDI') {
      return subject.availableInHindi;
    }
    return false;
  });

  return availableSubjects.map((subject) => subject.name);
}

/**
 * Get core subjects for a specific stream and class level
 */
export function getCoreSubjectsForStream(classLevel: number, stream: Stream): string[] {
  const matrix = getClassSubjectMatrix(classLevel);
  if (!matrix || !matrix.hasStreams || !matrix.streams) {
    return [];
  }

  const streamData = matrix.streams[stream];
  return streamData ? streamData.coreSubjects : [];
}

/**
 * Get optional subjects for a specific class level
 */
export function getOptionalSubjects(classLevel: number): string[] {
  const matrix = getClassSubjectMatrix(classLevel);
  if (!matrix || !matrix.hasStreams) {
    return [];
  }

  return matrix.optionalSubjects || [];
}

/**
 * Get all available streams for a specific class level
 */
export function getAvailableStreams(classLevel: number): Stream[] {
  const matrix = getClassSubjectMatrix(classLevel);
  if (!matrix || !matrix.hasStreams || !matrix.streams) {
    return [];
  }

  return Object.keys(matrix.streams) as Stream[];
}

/**
 * Validate subject selection for a user
 */
export function validateSubjectSelection(
  classLevel: number,
  medium: Medium,
  subjects: string[],
  stream?: Stream
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  const matrix = getClassSubjectMatrix(classLevel);
  if (!matrix) {
    errors.push(`Invalid class level: ${classLevel}`);
    return { isValid: false, errors };
  }

  // For Classes 11-12, validate stream-based selection
  if (matrix.hasStreams) {
    if (!stream) {
      errors.push('Stream is required for Classes 11-12');
      return { isValid: false, errors };
    }

    const coreSubjects = getCoreSubjectsForStream(classLevel, stream);
    const optionalSubjects = getOptionalSubjects(classLevel);

    // Check if all core subjects are included
    const missingCoreSubjects = coreSubjects.filter((core) => !subjects.includes(core));
    if (missingCoreSubjects.length > 0) {
      errors.push(`Missing core subjects for ${stream}: ${missingCoreSubjects.join(', ')}`);
    }

    // Check if selected subjects are valid
    const invalidSubjects = subjects.filter(
      (subject) => !coreSubjects.includes(subject) && !optionalSubjects.includes(subject)
    );
    if (invalidSubjects.length > 0) {
      errors.push(`Invalid subjects for ${stream}: ${invalidSubjects.join(', ')}`);
    }
  } else {
    // For Classes 1-10, validate against available subjects
    const availableSubjects = getAvailableSubjects(classLevel, medium);
    const invalidSubjects = subjects.filter((subject) => !availableSubjects.includes(subject));

    if (invalidSubjects.length > 0) {
      errors.push(`Subjects not available in ${medium} medium: ${invalidSubjects.join(', ')}`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Check if a subject is available for a specific class level and medium
 */
export function isSubjectAvailable(
  classLevel: number,
  medium: Medium,
  subjectName: string,
  stream?: Stream
): boolean {
  const availableSubjects = getAvailableSubjects(classLevel, medium, stream);
  return availableSubjects.includes(subjectName);
}

/**
 * Get stream description
 */
export function getStreamDescription(classLevel: number, stream: Stream): string | undefined {
  const matrix = getClassSubjectMatrix(classLevel);
  if (!matrix || !matrix.hasStreams || !matrix.streams) {
    return undefined;
  }

  const streamData = matrix.streams[stream];
  return streamData?.description;
}

/**
 * Check if a class level requires stream selection
 */
export function requiresStreamSelection(classLevel: number): boolean {
  const matrix = getClassSubjectMatrix(classLevel);
  return matrix ? matrix.hasStreams : false;
}

/**
 * Get all subjects for a class level (regardless of medium)
 */
export function getAllSubjectsForClass(classLevel: number): string[] {
  const matrix = getClassSubjectMatrix(classLevel);
  if (!matrix) {
    return [];
  }

  if (matrix.hasStreams) {
    // For stream-based classes, return all possible subjects
    const allCoreSubjects = new Set<string>();
    if (matrix.streams) {
      Object.values(matrix.streams).forEach((streamData) => {
        streamData.coreSubjects.forEach((subject) => allCoreSubjects.add(subject));
      });
    }
    const optionalSubjects = matrix.optionalSubjects || [];
    return [...Array.from(allCoreSubjects), ...optionalSubjects];
  }

  // For non-stream classes, return all subjects
  return matrix.subjects.map((subject) => subject.name);
}



