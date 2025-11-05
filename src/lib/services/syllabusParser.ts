/**
 * Syllabus Parser Service
 * Parses CBSE/ICSE/State Board syllabi and extracts topics, exam dates
 */

import { promises as fs } from 'fs'
import path from 'path'

export interface SyllabusChapter {
  id: string
  title: string
  topics: string[]
  priority: 'high' | 'medium' | 'low'
  estimatedHours: number
  examDates?: string[]
}

export interface SyllabusData {
  board: string
  grade: number
  subject: string
  chapters: SyllabusChapter[]
  metadata?: any
}

export interface ExamDate {
  date: Date
  type: 'unit_test' | 'mid_term' | 'final' | 'board_exam' | 'competitive'
  subject: string
  topics: string[]
}

export class SyllabusParser {
  private static syllabusCache = new Map<string, SyllabusData>()

  /**
   * Parse PDF syllabus (placeholder for future PDF parsing)
   */
  static async parsePDF(filePath: string): Promise<SyllabusData> {
    // For now, return structured data
    // In production, this would use pdf-parse or similar
    throw new Error('PDF parsing not implemented yet. Use JSON syllabus data.')
  }

  /**
   * Load syllabus from JSON templates
   */
  static async loadSyllabus(board: string, grade: number, subject: string): Promise<SyllabusData> {
    const cacheKey = `${board}-${grade}-${subject}`
    
    if (this.syllabusCache.has(cacheKey)) {
      return this.syllabusCache.get(cacheKey)!
    }

    try {
      const syllabusData = this.getSyllabusData(board, grade, subject)
      this.syllabusCache.set(cacheKey, syllabusData)
      return syllabusData
    } catch (error) {
      console.error('Error loading syllabus:', error)
      return this.getDefaultSyllabus(board, grade, subject)
    }
  }

  /**
   * Get structured syllabus data
   */
  private static getSyllabusData(board: string, grade: number, subject: string): SyllabusData {
    const syllabusTemplates = this.getSyllabusTemplates()
    
    const boardData = syllabusTemplates[board]
    if (!boardData) {
      throw new Error(`Board ${board} not found`)
    }

    const gradeData = boardData[`grade${grade}`]
    if (!gradeData) {
      throw new Error(`Grade ${grade} not found for board ${board}`)
    }

    const subjectData = gradeData[subject.toLowerCase()]
    if (!subjectData) {
      throw new Error(`Subject ${subject} not found for grade ${grade}, board ${board}`)
    }

    return {
      board,
      grade,
      subject,
      chapters: subjectData.chapters
    }
  }

  /**
   * Extract topics from text (for PDF parsing)
   */
  static extractTopics(text: string): SyllabusChapter[] {
    const topicPattern = /Chapter\s+(\d+):\s*(.+?)(?=Chapter|\n\n|$)/g
    const chapters: SyllabusChapter[] = []
    let match

    while ((match = topicPattern.exec(text)) !== null) {
      chapters.push({
        id: `ch${match[1]}`,
        title: match[2].trim(),
        topics: this.extractChapterTopics(match[2]),
        priority: this.calculatePriority(match[2]),
        estimatedHours: this.estimateStudyHours(match[2])
      })
    }

    return chapters
  }

  /**
   * Extract exam dates from text
   */
  static extractExamDates(text: string): ExamDate[] {
    const datePattern = /(?:exam|test|assessment).*?(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi
    const dates: ExamDate[] = []
    let match

    while ((match = datePattern.exec(text)) !== null) {
      dates.push({
        date: new Date(match[1]),
        type: this.determineExamType(match[0]),
        subject: 'Unknown',
        topics: []
      })
    }

    return dates
  }

  /**
   * Calculate topic priority based on keywords
   */
  private static calculatePriority(topicText: string): 'high' | 'medium' | 'low' {
    const highPriorityKeywords = ['fundamental', 'basic', 'important', 'essential', 'core']
    const lowPriorityKeywords = ['advanced', 'optional', 'supplementary', 'additional']
    
    const text = topicText.toLowerCase()
    
    if (highPriorityKeywords.some(keyword => text.includes(keyword))) {
      return 'high'
    }
    
    if (lowPriorityKeywords.some(keyword => text.includes(keyword))) {
      return 'low'
    }
    
    return 'medium'
  }

  /**
   * Extract chapter topics from title
   */
  private static extractChapterTopics(chapterTitle: string): string[] {
    // Simple extraction - in production, this would be more sophisticated
    return [chapterTitle.trim()]
  }

  /**
   * Estimate study hours for a topic
   */
  private static estimateStudyHours(topicText: string): number {
    const baseHours = 8
    const complexityKeywords = ['advanced', 'complex', 'detailed', 'comprehensive']
    const simpleKeywords = ['basic', 'simple', 'introduction', 'overview']
    
    const text = topicText.toLowerCase()
    
    if (complexityKeywords.some(keyword => text.includes(keyword))) {
      return baseHours + 4
    }
    
    if (simpleKeywords.some(keyword => text.includes(keyword))) {
      return baseHours - 2
    }
    
    return baseHours
  }

  /**
   * Determine exam type from text
   */
  private static determineExamType(examText: string): ExamDate['type'] {
    const text = examText.toLowerCase()
    
    if (text.includes('board') || text.includes('final')) return 'board_exam'
    if (text.includes('mid') || text.includes('semester')) return 'mid_term'
    if (text.includes('unit') || text.includes('chapter')) return 'unit_test'
    if (text.includes('competitive') || text.includes('entrance')) return 'competitive'
    
    return 'unit_test'
  }

  /**
   * Get default syllabus if loading fails
   */
  private static getDefaultSyllabus(board: string, grade: number, subject: string): SyllabusData {
    return {
      board,
      grade,
      subject,
      chapters: [
        {
          id: 'ch1',
          title: `${subject} Fundamentals`,
          topics: ['Basic Concepts', 'Introduction', 'Key Principles'],
          priority: 'high',
          estimatedHours: 8
        }
      ]
    }
  }

  /**
   * Syllabus templates (comprehensive CBSE/ICSE data)
   */
  private static getSyllabusTemplates() {
    return {
      CBSE: {
        grade9: {
          mathematics: {
            chapters: [
              {
                id: 'ch1',
                title: 'Number Systems',
                topics: ['Real Numbers', 'Irrational Numbers', 'Rationalization', 'Laws of Exponents'],
                priority: 'high' as const,
                estimatedHours: 12,
                examDates: ['2024-03-15', '2024-04-20']
              },
              {
                id: 'ch2',
                title: 'Polynomials',
                topics: ['Polynomial Definition', 'Degree of Polynomial', 'Zeros of Polynomial', 'Remainder Theorem'],
                priority: 'high' as const,
                estimatedHours: 10,
                examDates: ['2024-03-15', '2024-04-20']
              },
              {
                id: 'ch3',
                title: 'Coordinate Geometry',
                topics: ['Cartesian System', 'Distance Formula', 'Section Formula', 'Area of Triangle'],
                priority: 'medium' as const,
                estimatedHours: 8,
                examDates: ['2024-03-15', '2024-04-20']
              },
              {
                id: 'ch4',
                title: 'Linear Equations in Two Variables',
                topics: ['Linear Equations', 'Graphical Method', 'Algebraic Methods', 'Applications'],
                priority: 'high' as const,
                estimatedHours: 10,
                examDates: ['2024-03-15', '2024-04-20']
              }
            ]
          },
          science: {
            chapters: [
              {
                id: 'ch1',
                title: 'Matter in Our Surroundings',
                topics: ['States of Matter', 'Evaporation', 'Temperature and Heat', 'Kinetic Theory'],
                priority: 'medium' as const,
                estimatedHours: 8,
                examDates: ['2024-03-18', '2024-04-22']
              },
              {
                id: 'ch2',
                title: 'Is Matter Around Us Pure',
                topics: ['Mixtures', 'Solutions', 'Separation Techniques', 'Physical and Chemical Changes'],
                priority: 'high' as const,
                estimatedHours: 10,
                examDates: ['2024-03-18', '2024-04-22']
              }
            ]
          }
        },
        grade10: {
          mathematics: {
            chapters: [
              {
                id: 'ch1',
                title: 'Real Numbers',
                topics: ['Euclid Division Algorithm', 'HCF and LCM', 'Irrational Numbers', 'Decimal Expansion'],
                priority: 'high' as const,
                estimatedHours: 14,
                examDates: ['2024-03-20', '2024-04-25']
              },
              {
                id: 'ch2',
                title: 'Quadratic Equations',
                topics: ['Standard Form', 'Factorization Method', 'Quadratic Formula', 'Nature of Roots'],
                priority: 'high' as const,
                estimatedHours: 12,
                examDates: ['2024-03-20', '2024-04-25']
              },
              {
                id: 'ch3',
                title: 'Arithmetic Progressions',
                topics: ['AP Definition', 'nth Term', 'Sum of n Terms', 'Applications'],
                priority: 'medium' as const,
                estimatedHours: 8,
                examDates: ['2024-03-20', '2024-04-25']
              }
            ]
          },
          science: {
            chapters: [
              {
                id: 'ch1',
                title: 'Light - Reflection and Refraction',
                topics: ['Laws of Reflection', 'Spherical Mirrors', 'Refraction', 'Lenses'],
                priority: 'high' as const,
                estimatedHours: 12,
                examDates: ['2024-03-22', '2024-04-27']
              },
              {
                id: 'ch2',
                title: 'Electricity',
                topics: ['Electric Current', 'Potential Difference', 'Ohms Law', 'Resistance'],
                priority: 'high' as const,
                estimatedHours: 14,
                examDates: ['2024-03-22', '2024-04-27']
              }
            ]
          }
        },
        grade11: {
          mathematics: {
            chapters: [
              {
                id: 'ch1',
                title: 'Sets and Functions',
                topics: ['Set Theory', 'Types of Sets', 'Functions', 'Domain and Range'],
                priority: 'high' as const,
                estimatedHours: 16,
                examDates: ['2024-04-10', '2024-05-15']
              },
              {
                id: 'ch2',
                title: 'Trigonometric Functions',
                topics: ['Angles', 'Trigonometric Ratios', 'Identities', 'Equations'],
                priority: 'high' as const,
                estimatedHours: 18,
                examDates: ['2024-04-10', '2024-05-15']
              }
            ]
          }
        },
        grade12: {
          mathematics: {
            chapters: [
              {
                id: 'ch1',
                title: 'Relations and Functions',
                topics: ['Types of Relations', 'Equivalence Relations', 'Functions', 'Inverse Functions'],
                priority: 'high' as const,
                estimatedHours: 18,
                examDates: ['2024-04-25', '2024-05-30']
              },
              {
                id: 'ch2',
                title: 'Calculus',
                topics: ['Limits', 'Derivatives', 'Applications of Derivatives', 'Integrals'],
                priority: 'high' as const,
                estimatedHours: 25,
                examDates: ['2024-04-25', '2024-05-30']
              }
            ]
          }
        }
      },
      ICSE: {
        grade9: {
          mathematics: {
            chapters: [
              {
                id: 'ch1',
                title: 'Rational and Irrational Numbers',
                topics: ['Properties of Rational Numbers', 'Irrational Numbers', 'Real Numbers', 'Surds'],
                priority: 'high' as const,
                estimatedHours: 10
              }
            ]
          }
        },
        grade10: {
          mathematics: {
            chapters: [
              {
                id: 'ch1',
                title: 'Commercial Mathematics',
                topics: ['Compound Interest', 'Installment Buying', 'Income Tax', 'Banking'],
                priority: 'medium' as const,
                estimatedHours: 12
              }
            ]
          }
        }
      }
    }
  }

  /**
   * Get upcoming topics based on current progress
   */
  static getUpcomingTopics(syllabus: SyllabusData, currentChapter: string): SyllabusChapter[] {
    const currentIndex = syllabus.chapters.findIndex(ch => ch.id === currentChapter)
    if (currentIndex === -1) return syllabus.chapters.slice(0, 3)
    
    return syllabus.chapters.slice(currentIndex + 1, currentIndex + 4)
  }

  /**
   * Calculate topic priority based on exam proximity
   */
  static calculateTopicPriority(topic: string, examDates: ExamDate[]): 'high' | 'medium' | 'low' {
    const now = new Date()
    const upcomingExams = examDates.filter(exam => exam.date > now)
    
    if (upcomingExams.length === 0) return 'medium'
    
    const nearestExam = upcomingExams.reduce((nearest, exam) => 
      exam.date < nearest.date ? exam : nearest
    )
    
    const daysUntilExam = Math.ceil((nearestExam.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilExam <= 7) return 'high'
    if (daysUntilExam <= 21) return 'medium'
    return 'low'
  }
}
