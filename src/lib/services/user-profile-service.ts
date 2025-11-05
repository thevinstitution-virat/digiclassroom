/**
 * User Profile Management System
 * Provides role-aware context analysis and educational personalization
 * 🛡️ ENHANCED: Defensive defaults and comprehensive schema validation
 */

import { getPool, executeQuery, executeQuerySingle } from '@/lib/db/connection';
import { z } from 'zod';
import { ServiceLifecycleManager, cacheUserContext, getCachedUserContext } from './service-lifecycle-manager';

export type UserRole = 'student' | 'teacher' | 'parent_guardian';
export type BoardType = 'CBSE' | 'ICSE' | 'State';
export type LearningStyle = 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
export type LearningPace = 'slow' | 'average' | 'fast';
export type ComplexityLevel = 'basic' | 'intermediate' | 'advanced';
export type InvolvementLevel = 'high' | 'moderate' | 'minimal';

// 🛡️ DEFENSIVE SCHEMA VALIDATION: Comprehensive validation schemas
const UserProfileSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().min(1, 'User ID is required'),
  role: z.enum(['student', 'teacher', 'parent_guardian'] as const),
  board_type: z.enum(['CBSE', 'ICSE', 'State'] as const),
  grade_level: z.number().int().min(1).max(12).optional(),
  subjects: z.array(z.string()).min(1, 'At least one subject is required'),
  learning_style: z.enum(['visual', 'auditory', 'kinesthetic', 'mixed'] as const),
  learning_pace: z.enum(['slow', 'average', 'fast'] as const),
  preferred_explanation_complexity: z.enum(['basic', 'intermediate', 'advanced'] as const),
  language_preference: z.enum(['english', 'hindi'] as const),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
});

const UserContextSchema = z.object({
  role: z.enum(['student', 'teacher', 'parent_guardian'] as const),
  educationalLevel: z.object({
    board: z.enum(['CBSE', 'ICSE', 'State'] as const),
    grade: z.number().int().min(1).max(12).optional(),
    subjects: z.array(z.string()).min(1)
  }),
  learningPreferences: z.object({
    primaryStyle: z.enum(['visual', 'auditory', 'kinesthetic', 'mixed'] as const),
    pace: z.enum(['slow', 'average', 'fast'] as const),
    complexity: z.enum(['basic', 'intermediate', 'advanced'] as const),
    needsScaffolding: z.boolean(),
    sequentialLearning: z.boolean(),
    visualLearning: z.boolean(),
    handsonLearning: z.boolean()
  }),
  complexityLevel: z.enum(['basic', 'intermediate', 'advanced'] as const),
  contextualFilters: z.object({
    boardRestriction: z.enum(['CBSE', 'ICSE', 'State'] as const),
    gradeRestriction: z.number().int().min(1).max(12).optional(),
    subjectRestriction: z.array(z.string()),
    contentTypePreferences: z.array(z.string()),
    vocabularyComplexity: z.enum(['basic', 'intermediate', 'advanced'] as const)
  })
});

// 🛡️ DEFENSIVE DEFAULTS: Comprehensive default values
const DEFENSIVE_DEFAULTS = {
  ROLE: 'student' as UserRole,
  BOARD_TYPE: 'CBSE' as BoardType,
  GRADE_LEVEL: 9,
  SUBJECTS: ['Geography', 'History', 'Political Science', 'Economics'],
  LEARNING_STYLE: 'mixed' as LearningStyle,
  LEARNING_PACE: 'average' as LearningPace,
  EXPLANATION_COMPLEXITY: 'intermediate' as ComplexityLevel,
  LANGUAGE_PREFERENCE: 'english',
  NEEDS_SCAFFOLDING: true,
  SEQUENTIAL_LEARNING: true,
  VISUAL_LEARNING: true,
  HANDSON_LEARNING: false,
  CONTENT_TYPE_PREFERENCES: ['text', 'visual', 'interactive'],
  VOCABULARY_COMPLEXITY: 'intermediate' as ComplexityLevel
} as const;

export interface UserProfile {
  id: string;
  user_id: string;
  role: UserRole;
  
  // Educational Context
  board_type: BoardType;
  grade_level?: number;
  subjects?: string[];
  learning_style: LearningStyle;
  
  // Student-specific
  performance_metrics?: any;
  learning_pace: LearningPace;
  difficulty_preferences?: any;
  
  // Teacher-specific
  teaching_experience_years?: number;
  specialization_subjects?: string[];
  classroom_size_preference?: number;
  
  // Parent-specific
  child_grade_levels?: number[];
  involvement_level?: InvolvementLevel;
  support_preferences?: any;
  
  // Behavioral Patterns
  interaction_history?: any;
  preferred_explanation_complexity: ComplexityLevel;
  language_preference: 'english' | 'hindi' | 'mixed';
  
  created_at: Date;
  updated_at: Date;
}

export interface UserContext {
  role: UserRole;
  educationalLevel: {
    board: BoardType;
    grade?: number;
    subjects: string[];
  };
  learningPreferences: {
    primaryStyle: LearningStyle;
    pace: LearningPace;
    complexity: ComplexityLevel;
    needsScaffolding: boolean;
    sequentialLearning: boolean;
    visualLearning: boolean;
    handsonLearning: boolean;
  };
  complexityLevel: ComplexityLevel;
  contextualFilters: ContextualFilters;
  professionalLevel?: {
    experience: string;
    specializations: string[];
  };
  involvementLevel?: InvolvementLevel;
}

export interface ContextualFilters {
  boardRestriction: BoardType;
  gradeRestriction?: number;
  subjectRestriction: string[];
  contentTypePreferences: string[];
  vocabularyComplexity: ComplexityLevel;
}

export interface LearningPreferences {
  primaryStyle: LearningStyle;
  pace: LearningPace;
  complexity: ComplexityLevel;
  needsScaffolding: boolean;
  sequentialLearning: boolean;
  visualLearning: boolean;
  handsonLearning: boolean;
}

export class UserProfileService {
  constructor() {
    // Database connection is handled by the connection utility functions
  }

  /**
   * Get or create user profile with defaults
   */
  async getOrCreateUserProfile(userId: string, defaultRole: UserRole = 'student'): Promise<UserProfile> {
    try {
      // Try to get existing profile
      const existingProfile = await this.getUserProfile(userId);
      if (existingProfile) {
        return existingProfile;
      }

      // Create default profile
      const defaultProfile: Partial<UserProfile> = {
        user_id: userId,
        role: defaultRole,
        board_type: 'CBSE',
        learning_style: 'mixed',
        learning_pace: 'average',
        preferred_explanation_complexity: 'intermediate',
        language_preference: 'english',
        subjects: defaultRole === 'student' ? ['Mathematics', 'Science', 'English'] : []
      };

      const profileId = await this.createUserProfile(defaultProfile);
      return await this.getUserProfile(userId) as UserProfile;
    } catch (error) {
      console.error('Error getting/creating user profile:', error);
      // Return minimal default profile if database fails
      return this.getDefaultProfile(userId, defaultRole);
    }
  }

  /**
   * Get user profile by user ID with strict validation
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      if (!this.db) {
        console.error('❌ CRITICAL: Database connection not available - failing fast');
        throw new Error('Database connection required for profile operations');
      }

      const query = 'SELECT * FROM enhanced_user_profiles WHERE user_id = ? LIMIT 1';
      const rows = await executeQuery(query, [userId]);

      if (rows && rows.length > 0) {
        const rawProfile = rows[0];

        // Parse JSON fields with error handling
        try {
          rawProfile.subjects = rawProfile.subjects ? JSON.parse(rawProfile.subjects) : [];
          rawProfile.performance_metrics = rawProfile.performance_metrics ? JSON.parse(rawProfile.performance_metrics) : null;
          rawProfile.difficulty_preferences = rawProfile.difficulty_preferences ? JSON.parse(rawProfile.difficulty_preferences) : null;
          rawProfile.specialization_subjects = rawProfile.specialization_subjects ? JSON.parse(rawProfile.specialization_subjects) : null;
          rawProfile.child_grade_levels = rawProfile.child_grade_levels ? JSON.parse(rawProfile.child_grade_levels) : null;
        } catch (parseError) {
          console.error('❌ Profile JSON parsing failed:', parseError);
          return null;
        }

        // 🔧 CRITICAL: Strict schema validation
        const validatedProfile = this.validateProfileSchema(rawProfile);
        if (!validatedProfile) {
          console.error('❌ Profile schema validation failed for user:', userId);
          return null;
        }

        console.log('✅ Valid profile loaded from database:', {
          userId: validatedProfile.user_id,
          role: validatedProfile.role,
          complexity: validatedProfile.preferred_explanation_complexity,
          subjects: validatedProfile.subjects?.length || 0
        });

        return validatedProfile;
        profile.support_preferences = profile.support_preferences ? JSON.parse(profile.support_preferences) : null;
        profile.interaction_history = profile.interaction_history ? JSON.parse(profile.interaction_history) : null;
        
        return profile as UserProfile;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  /**
   * Create new user profile
   */
  async createUserProfile(profileData: Partial<UserProfile>): Promise<string> {
    try {
      const query = `
        INSERT INTO enhanced_user_profiles (
          user_id, role, board_type, grade_level, subjects, learning_style,
          learning_pace, preferred_explanation_complexity, language_preference,
          teaching_experience_years, specialization_subjects, classroom_size_preference,
          child_grade_levels, involvement_level, support_preferences
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        profileData.user_id,
        profileData.role || 'student',
        profileData.board_type || 'CBSE',
        profileData.grade_level || null,
        profileData.subjects ? JSON.stringify(profileData.subjects) : null,
        profileData.learning_style || 'mixed',
        profileData.learning_pace || 'average',
        profileData.preferred_explanation_complexity || 'intermediate',
        profileData.language_preference || 'english',
        profileData.teaching_experience_years || null,
        profileData.specialization_subjects ? JSON.stringify(profileData.specialization_subjects) : null,
        profileData.classroom_size_preference || null,
        profileData.child_grade_levels ? JSON.stringify(profileData.child_grade_levels) : null,
        profileData.involvement_level || null,
        profileData.support_preferences ? JSON.stringify(profileData.support_preferences) : null
      ];

      const pool = getPool();
      const [result] = await pool.execute(query, values);
      return (result as any).insertId.toString();
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<boolean> {
    try {
      const setClause = [];
      const values = [];

      // Build dynamic update query
      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'user_id' && key !== 'created_at') {
          if (['subjects', 'performance_metrics', 'difficulty_preferences', 
               'specialization_subjects', 'child_grade_levels', 'support_preferences', 
               'interaction_history'].includes(key)) {
            setClause.push(`${key} = ?`);
            values.push(JSON.stringify(value));
          } else {
            setClause.push(`${key} = ?`);
            values.push(value);
          }
        }
      });

      if (setClause.length === 0) return false;

      const query = `UPDATE enhanced_user_profiles SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`;
      values.push(userId);

      const pool = getPool();
      const [result] = await pool.execute(query, values);
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
  }

  /**
   * Analyze user context for AI interactions
   * 🔧 CRITICAL FIX: Added robust error handling and profile validation
   * 🛡️ ENHANCED: Uses caching to avoid repeated database queries
   */
  async analyzeUserContext(userId: string): Promise<UserContext> {
    try {
      console.log(`🔍 Analyzing user context for: ${userId}`);

      // 🛡️ ENHANCED: Check cache first to avoid database query
      const cachedContext = getCachedUserContext(userId);
      if (cachedContext) {
        console.log(`⚡ Using cached user context for user: ${userId}`);
        return cachedContext;
      }

      const profile = await this.getOrCreateUserProfile(userId);

      // 🔧 CRITICAL FIX: Validate profile structure before use
      if (!profile) {
        console.error('❌ Profile is null, using default context');
        return this.getDefaultUserContext(userId);
      }

      // 🔧 CRITICAL FIX: Validate critical properties exist
      const validatedProfile = this.validateAndRepairProfile(profile);

      const interactionHistory = await this.getInteractionHistory(userId);

      // 🛡️ ENHANCED: Build context with defensive defaults
      const userContext = this.buildUserContextWithDefaults(validatedProfile, interactionHistory);

      // 🛡️ ENHANCED: Validate the generated context
      const validationResult = UserContextSchema.safeParse(userContext);

      if (validationResult.success) {
        console.log('✅ User context analyzed and validated successfully:', {
          role: userContext.role,
          complexity: userContext.complexityLevel,
          grade: userContext.educationalLevel.grade,
          subjects: userContext.educationalLevel.subjects.length
        });

        // 🛡️ ENHANCED: Cache the validated context for future use
        cacheUserContext(userId, validationResult.data);

        return validationResult.data;
      } else {
        console.warn('⚠️ User context validation failed, using defaults:', validationResult.error.issues);
        const defaultContext = this.getDefaultUserContext(userId);

        // Cache the default context as well to avoid repeated failures
        cacheUserContext(userId, defaultContext, 60000); // Shorter TTL for defaults

        return defaultContext;
      }
    } catch (error) {
      console.error('❌ Critical error in analyzeUserContext:', error);
      return this.getDefaultUserContext(userId);
    }
  }

  /**
   * 🛡️ ENHANCED: Validate and repair profile with comprehensive schema validation
   */
  private validateAndRepairProfile(profile: UserProfile | null): UserProfile {
    console.log('🛡️ Validating and repairing user profile with defensive defaults...');

    if (!profile) {
      console.warn('⚠️ Profile is null/undefined, using emergency defaults');
      return this.getEmergencyProfile('unknown');
    }

    try {
      // Apply defensive defaults first
      const profileWithDefaults = this.applyDefensiveDefaults(profile);

      // Validate with schema (partial validation for existing profiles)
      const validationResult = UserProfileSchema.safeParse(profileWithDefaults);

      if (validationResult.success) {
        console.log('✅ Profile validation successful:', {
          role: validationResult.data.role,
          complexity: validationResult.data.preferred_explanation_complexity,
          grade: validationResult.data.grade_level,
          subjects: validationResult.data.subjects.length
        });

        return validationResult.data as UserProfile;
      } else {
        console.warn('⚠️ Profile validation failed, applying repairs:', validationResult.error.issues);
        return this.repairInvalidProfile(profile);
      }

    } catch (error) {
      console.error('❌ Profile validation error, using emergency defaults:', error);
      return this.getEmergencyProfile(profile.user_id || 'unknown');
    }
  }

  /**
   * 🛡️ NEW: Apply comprehensive defensive defaults
   */
  private applyDefensiveDefaults(profile: Partial<UserProfile>): UserProfile {
    const now = new Date();

    return {
      id: profile.id || 'temp-' + Date.now(),
      user_id: profile.user_id || 'unknown',
      role: profile.role || DEFENSIVE_DEFAULTS.ROLE,
      board_type: profile.board_type || DEFENSIVE_DEFAULTS.BOARD_TYPE,
      grade_level: profile.grade_level || DEFENSIVE_DEFAULTS.GRADE_LEVEL,
      subjects: Array.isArray(profile.subjects) && profile.subjects.length > 0
        ? profile.subjects
        : [...DEFENSIVE_DEFAULTS.SUBJECTS],
      learning_style: profile.learning_style || DEFENSIVE_DEFAULTS.LEARNING_STYLE,
      learning_pace: profile.learning_pace || DEFENSIVE_DEFAULTS.LEARNING_PACE,
      preferred_explanation_complexity: profile.preferred_explanation_complexity || DEFENSIVE_DEFAULTS.EXPLANATION_COMPLEXITY,
      language_preference: profile.language_preference || DEFENSIVE_DEFAULTS.LANGUAGE_PREFERENCE,
      created_at: profile.created_at || now,
      updated_at: profile.updated_at || now,
      // Apply any additional fields from the original profile
      ...profile
    } as UserProfile;
  }

  /**
   * 🛡️ NEW: Emergency profile with guaranteed valid values
   */
  private getEmergencyProfile(userId: string): UserProfile {
    const now = new Date();

    console.log('🚨 Using emergency profile for user:', userId);

    return {
      id: 'emergency-' + Date.now(),
      user_id: userId,
      role: DEFENSIVE_DEFAULTS.ROLE,
      board_type: DEFENSIVE_DEFAULTS.BOARD_TYPE,
      grade_level: DEFENSIVE_DEFAULTS.GRADE_LEVEL,
      subjects: [...DEFENSIVE_DEFAULTS.SUBJECTS],
      learning_style: DEFENSIVE_DEFAULTS.LEARNING_STYLE,
      learning_pace: DEFENSIVE_DEFAULTS.LEARNING_PACE,
      preferred_explanation_complexity: DEFENSIVE_DEFAULTS.EXPLANATION_COMPLEXITY,
      language_preference: DEFENSIVE_DEFAULTS.LANGUAGE_PREFERENCE,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * 🛡️ NEW: Repair invalid profile by fixing specific issues
   */
  private repairInvalidProfile(profile: Partial<UserProfile>): UserProfile {
    console.log('🔧 Repairing invalid profile with targeted fixes...');

    const repaired = this.applyDefensiveDefaults(profile);

    // Additional repairs for common issues
    if (!Array.isArray(repaired.subjects) || repaired.subjects.length === 0) {
      repaired.subjects = [...DEFENSIVE_DEFAULTS.SUBJECTS];
    }

    if (repaired.grade_level && (repaired.grade_level < 1 || repaired.grade_level > 12)) {
      repaired.grade_level = DEFENSIVE_DEFAULTS.GRADE_LEVEL;
    }

    console.log('🔧 Profile repaired successfully');
    return repaired;
  }

  /**
   * 🛡️ NEW: Build user context with comprehensive defensive defaults
   */
  private buildUserContextWithDefaults(profile: UserProfile, interactionHistory: any[] = []): UserContext {
    return {
      role: profile.role || DEFENSIVE_DEFAULTS.ROLE,
      educationalLevel: this.determineEducationalLevelWithDefaults(profile),
      learningPreferences: this.analyzeLearningPreferencesWithDefaults(profile, interactionHistory),
      complexityLevel: this.calculateOptimalComplexityWithDefaults(profile, interactionHistory),
      contextualFilters: this.buildContextualFiltersWithDefaults(profile),
      professionalLevel: profile.role === 'teacher' ? this.buildProfessionalLevel(profile) : undefined,
      involvementLevel: profile.role === 'parent_guardian' ? profile.involvement_level : undefined
    };
  }

  /**
   * 🛡️ ENHANCED: Failsafe default context with comprehensive validation
   */
  private getDefaultUserContext(userId: string): UserContext {
    console.log('🛡️ Using failsafe default user context for:', userId);

    return {
      role: DEFENSIVE_DEFAULTS.ROLE,
      educationalLevel: {
        board: DEFENSIVE_DEFAULTS.BOARD_TYPE,
        grade: DEFENSIVE_DEFAULTS.GRADE_LEVEL,
        subjects: [...DEFENSIVE_DEFAULTS.SUBJECTS]
      },
      learningPreferences: {
        primaryStyle: DEFENSIVE_DEFAULTS.LEARNING_STYLE,
        pace: DEFENSIVE_DEFAULTS.LEARNING_PACE,
        complexity: DEFENSIVE_DEFAULTS.EXPLANATION_COMPLEXITY,
        needsScaffolding: DEFENSIVE_DEFAULTS.NEEDS_SCAFFOLDING,
        sequentialLearning: DEFENSIVE_DEFAULTS.SEQUENTIAL_LEARNING,
        visualLearning: DEFENSIVE_DEFAULTS.VISUAL_LEARNING,
        handsonLearning: DEFENSIVE_DEFAULTS.HANDSON_LEARNING
      },
      complexityLevel: DEFENSIVE_DEFAULTS.EXPLANATION_COMPLEXITY,
      contextualFilters: {
        boardRestriction: DEFENSIVE_DEFAULTS.BOARD_TYPE,
        gradeRestriction: DEFENSIVE_DEFAULTS.GRADE_LEVEL,
        subjectRestriction: [...DEFENSIVE_DEFAULTS.SUBJECTS],
        contentTypePreferences: [...DEFENSIVE_DEFAULTS.CONTENT_TYPE_PREFERENCES],
        vocabularyComplexity: DEFENSIVE_DEFAULTS.VOCABULARY_COMPLEXITY
      }
    };
  }

  /**
   * 🔧 CRITICAL: Strict profile schema validation
   */
  private validateProfileSchema(rawProfile: any): UserProfile | null {
    if (!rawProfile) {
      console.error('❌ Profile is null or undefined');
      return null;
    }

    // Required fields validation
    const requiredFields = ['user_id', 'role'];
    for (const field of requiredFields) {
      if (!rawProfile[field]) {
        console.error(`❌ Missing required field: ${field}`);
        return null;
      }
    }

    // Validate role enum
    const validRoles = ['student', 'teacher', 'parent_guardian'];
    if (!validRoles.includes(rawProfile.role)) {
      console.error(`❌ Invalid role: ${rawProfile.role}`);
      return null;
    }

    // Validate and set defaults for critical fields
    const validatedProfile: UserProfile = {
      ...rawProfile,
      board_type: rawProfile.board_type || 'CBSE',
      grade_level: rawProfile.grade_level || 9,
      subjects: Array.isArray(rawProfile.subjects) ? rawProfile.subjects : ['Geography', 'History'],
      learning_style: rawProfile.learning_style || 'mixed',
      learning_pace: rawProfile.learning_pace || 'average',
      preferred_explanation_complexity: rawProfile.preferred_explanation_complexity || 'intermediate',
      language_preference: rawProfile.language_preference || 'english',
      created_at: rawProfile.created_at || new Date(),
      updated_at: rawProfile.updated_at || new Date()
    };

    // Log validation success
    console.log('✅ Profile schema validated:', {
      userId: validatedProfile.user_id,
      role: validatedProfile.role,
      complexity: validatedProfile.preferred_explanation_complexity,
      subjects: validatedProfile.subjects.length
    });

    return validatedProfile;
  }

  /**
   * Get interaction history for analysis
   */
  async getInteractionHistory(userId: string, days: number = 30): Promise<any[]> {
    try {
      if (!this.db) return [];

      const query = `
        SELECT * FROM learning_analytics 
        WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY created_at DESC
        LIMIT 100
      `;
      
      const rows = await executeQuery(query, [userId, days]);
      return rows || [];
    } catch (error) {
      console.error('Error fetching interaction history:', error);
      return [];
    }
  }

  /**
   * 🛡️ ENHANCED: Determine educational level with defensive defaults
   */
  private determineEducationalLevelWithDefaults(profile: UserProfile): UserContext['educationalLevel'] {
    return {
      board: profile.board_type || DEFENSIVE_DEFAULTS.BOARD_TYPE,
      grade: profile.grade_level || DEFENSIVE_DEFAULTS.GRADE_LEVEL,
      subjects: Array.isArray(profile.subjects) && profile.subjects.length > 0
        ? profile.subjects
        : [...DEFENSIVE_DEFAULTS.SUBJECTS]
    };
  }

  /**
   * Legacy method for backward compatibility
   */
  private determineEducationalLevel(profile: UserProfile) {
    return this.determineEducationalLevelWithDefaults(profile);
  }

  /**
   * 🛡️ ENHANCED: Analyze learning preferences with defensive defaults
   */
  private analyzeLearningPreferencesWithDefaults(profile: UserProfile, history: any[]): LearningPreferences {
    const primaryStyle = profile.learning_style || DEFENSIVE_DEFAULTS.LEARNING_STYLE;
    const pace = profile.learning_pace || DEFENSIVE_DEFAULTS.LEARNING_PACE;
    const complexity = profile.preferred_explanation_complexity || DEFENSIVE_DEFAULTS.EXPLANATION_COMPLEXITY;

    return {
      primaryStyle,
      pace,
      complexity,
      needsScaffolding: pace === 'slow' || complexity === 'basic' || DEFENSIVE_DEFAULTS.NEEDS_SCAFFOLDING,
      sequentialLearning: primaryStyle === 'auditory' || pace === 'slow' || DEFENSIVE_DEFAULTS.SEQUENTIAL_LEARNING,
      visualLearning: primaryStyle === 'visual' || primaryStyle === 'mixed' || DEFENSIVE_DEFAULTS.VISUAL_LEARNING,
      handsonLearning: primaryStyle === 'kinesthetic' || DEFENSIVE_DEFAULTS.HANDSON_LEARNING
    };
  }

  /**
   * Legacy method for backward compatibility
   */
  private analyzeLearningPreferences(profile: UserProfile, history: any[]): LearningPreferences {
    return this.analyzeLearningPreferencesWithDefaults(profile, history);
  }

  /**
   * 🛡️ ENHANCED: Calculate optimal complexity with defensive defaults
   */
  private calculateOptimalComplexityWithDefaults(profile: UserProfile, history: any[]): ComplexityLevel {
    // Start with user preference or defensive default
    let complexity: ComplexityLevel = profile.preferred_explanation_complexity || DEFENSIVE_DEFAULTS.EXPLANATION_COMPLEXITY;

    // Validate complexity level
    if (!['basic', 'intermediate', 'advanced'].includes(complexity)) {
      console.warn(`⚠️ Invalid complexity level: ${complexity}, using default`);
      complexity = DEFENSIVE_DEFAULTS.EXPLANATION_COMPLEXITY;
    }

    // Adjust based on recent performance if available
    if (Array.isArray(history) && history.length > 0) {
      const recentPerformance = history.slice(0, 10);
      const avgEngagement = recentPerformance.reduce((sum, item) =>
        sum + (item.engagement_score || 0.5), 0) / recentPerformance.length;

      if (avgEngagement > 0.8 && complexity === 'basic') complexity = 'intermediate';
      if (avgEngagement > 0.9 && complexity === 'intermediate') complexity = 'advanced';
      if (avgEngagement < 0.4 && complexity === 'advanced') complexity = 'intermediate';
      if (avgEngagement < 0.3 && complexity === 'intermediate') complexity = 'basic';
    }

    return complexity;
  }

  /**
   * Legacy method for backward compatibility
   */
  private calculateOptimalComplexity(profile: UserProfile, history: any[]): ComplexityLevel {
    return this.calculateOptimalComplexityWithDefaults(profile, history);
  }

  /**
   * 🛡️ ENHANCED: Build contextual filters with defensive defaults
   */
  private buildContextualFiltersWithDefaults(profile: UserProfile): ContextualFilters {
    return {
      boardRestriction: profile.board_type || DEFENSIVE_DEFAULTS.BOARD_TYPE,
      gradeRestriction: profile.grade_level || DEFENSIVE_DEFAULTS.GRADE_LEVEL,
      subjectRestriction: Array.isArray(profile.subjects) && profile.subjects.length > 0
        ? profile.subjects
        : [...DEFENSIVE_DEFAULTS.SUBJECTS],
      contentTypePreferences: this.deriveContentPreferencesWithDefaults(profile),
      vocabularyComplexity: profile.preferred_explanation_complexity || DEFENSIVE_DEFAULTS.VOCABULARY_COMPLEXITY
    };
  }

  /**
   * Legacy method for backward compatibility
   */
  private buildContextualFilters(profile: UserProfile): ContextualFilters {
    return this.buildContextualFiltersWithDefaults(profile);
  }

  /**
   * 🛡️ ENHANCED: Derive content type preferences with defensive defaults
   */
  private deriveContentPreferencesWithDefaults(profile: UserProfile): string[] {
    const preferences = ['text']; // Always include text
    const learningStyle = profile.learning_style || DEFENSIVE_DEFAULTS.LEARNING_STYLE;

    switch (learningStyle) {
      case 'visual':
        preferences.push('figure', 'diagram', 'chart', 'map');
        break;
      case 'kinesthetic':
        preferences.push('activity', 'experiment', 'hands_on');
        break;
      case 'mixed':
        preferences.push('figure', 'diagram', 'activity', 'example');
        break;
      case 'auditory':
        preferences.push('audio', 'discussion', 'explanation');
        break;
      default:
        // Use defensive defaults
        preferences.push(...DEFENSIVE_DEFAULTS.CONTENT_TYPE_PREFERENCES.filter(p => p !== 'text'));
        break;
    }

    return preferences;
  }

  /**
   * Legacy method for backward compatibility
   */
  private deriveContentPreferences(profile: UserProfile): string[] {
    return this.deriveContentPreferencesWithDefaults(profile);
  }

  /**
   * Build professional level context for teachers
   */
  private buildProfessionalLevel(profile: UserProfile) {
    const experience = profile.teaching_experience_years || 0;
    let experienceLevel = 'novice';
    
    if (experience >= 10) experienceLevel = 'expert';
    else if (experience >= 5) experienceLevel = 'experienced';
    else if (experience >= 2) experienceLevel = 'intermediate';
    
    return {
      experience: experienceLevel,
      specializations: profile.specialization_subjects || []
    };
  }

  /**
   * Get default profile when database is unavailable
   */
  private getDefaultProfile(userId: string, role: UserRole): UserProfile {
    return {
      id: 'default',
      user_id: userId,
      role,
      board_type: 'CBSE',
      learning_style: 'mixed',
      learning_pace: 'average',
      preferred_explanation_complexity: 'intermediate',
      language_preference: 'english',
      subjects: role === 'student' ? ['Mathematics', 'Science', 'English'] : [],
      created_at: new Date(),
      updated_at: new Date()
    };
  }
}

// Export singleton instance
export const userProfileService = new UserProfileService();
