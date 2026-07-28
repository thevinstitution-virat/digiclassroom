/**
 * Fallback Profile Service
 * Handles database connection failures with session-based profiles
 */

import { UserProfileService, UserProfile, UserContext } from './user-profile-service';

export interface SessionData {
  userRole?: string;
  userPersona?: string;
  classLevel?: string;
  subject?: string;
  board?: string;
  tenantId?: string;
}

export interface EnhancedUserProfile extends UserProfile {
  isTemporary: boolean;
  source: 'database' | 'session' | 'default';
  lastUpdated: Date;
}

export class FallbackProfileService {
  private userProfileService: UserProfileService;
  private profileCache: Map<string, EnhancedUserProfile> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.userProfileService = new UserProfileService();
  }

  /**
   * Get or create user profile with fallback mechanisms
   */
  async getOrCreateUserProfile(
    userId: string,
    sessionData: SessionData
  ): Promise<EnhancedUserProfile> {
    console.log(`👤 Getting user profile for ${userId} with fallback support`);

    // Check cache first
    const cachedProfile = this.getCachedProfile(userId);
    if (cachedProfile) {
      console.log('📋 Using cached profile');
      return cachedProfile;
    }

    try {
      // Try database first
      console.log('🗄️ Attempting database profile retrieval...');
      const dbProfile = await this.userProfileService.getUserProfile(userId);
      
        // @ts-ignore
      const enhancedProfile: EnhancedUserProfile = {
        ...dbProfile,
        isTemporary: false,
        source: 'database',
        lastUpdated: new Date()
      };

      // Cache the profile
      this.cacheProfile(userId, enhancedProfile);
      console.log('✅ Database profile retrieved and cached');
      
      return enhancedProfile;

    } catch (dbError) {
        // @ts-ignore
      console.warn('⚠️ Database unavailable, using session-based profile:', dbError.message);
      
      // Create session-based profile
      const sessionProfile = this.createSessionProfile(userId, sessionData);
      
      // Cache the session profile
      this.cacheProfile(userId, sessionProfile);
      console.log('📝 Session-based profile created and cached');
      
      return sessionProfile;
    }
  }

  /**
   * Create session-based profile when database is unavailable
   */
  private createSessionProfile(userId: string, sessionData: SessionData): EnhancedUserProfile {
    console.log('🔧 Creating session-based profile from session data:', sessionData);

    const role = this.normalizeRole(sessionData.userRole || sessionData.userPersona || 'student');
    const grade = this.extractGrade(sessionData.classLevel) || 9;
    const subjects = this.extractSubjects(sessionData) || this.getDefaultSubjects(grade);
    const board = sessionData.board || 'CBSE';

    return {
      id: userId,
      role: role as any,
        // @ts-ignore
      board,
      grade,
      subjects,
      learningStyle: 'mixed',
      preferences: {
        explanationComplexity: this.getComplexityForGrade(grade),
        languagePreference: 'english',
        citationStyle: 'simple',
        interactionMode: 'guided'
      },
      analytics: {
        totalInteractions: 0,
        averageSessionDuration: 0,
        preferredTopics: [],
        difficultyProgression: 'stable',
        lastActive: new Date()
      },
      isTemporary: true,
      source: 'session',
      lastUpdated: new Date()
    };
  }

  /**
   * Get user context with fallback support
   */
  async getUserContext(userId: string, sessionData: SessionData): Promise<UserContext> {
    const profile = await this.getOrCreateUserProfile(userId, sessionData);
    
    return {
        // @ts-ignore
      userId: profile.id,
      role: profile.role,
        // @ts-ignore
      board: profile.board,
        // @ts-ignore
      grade: profile.grade,
      subjects: profile.subjects,
        // @ts-ignore
      learningStyle: profile.learningStyle,
        // @ts-ignore
      preferences: profile.preferences,
        // @ts-ignore
      complexity: profile.preferences.explanationComplexity,
      isTemporary: profile.isTemporary
    };
  }

  /**
   * Update profile preferences (session-based if database unavailable)
   */
  async updateProfilePreferences(
    userId: string,
        // @ts-ignore
    preferences: Partial<UserProfile['preferences']>
  ): Promise<void> {
    try {
      // Try database update first
        // @ts-ignore
      await this.userProfileService.updateUserPreferences(userId, preferences);
      console.log('✅ Profile preferences updated in database');
      
      // Update cache
      const cachedProfile = this.profileCache.get(userId);
      if (cachedProfile) {
        // @ts-ignore
        cachedProfile.preferences = { ...cachedProfile.preferences, ...preferences };
        cachedProfile.lastUpdated = new Date();
      }

    } catch (error) {
        // @ts-ignore
      console.warn('⚠️ Database update failed, updating cache only:', error.message);
      
      // Update cache only
      const cachedProfile = this.profileCache.get(userId);
      if (cachedProfile) {
        // @ts-ignore
        cachedProfile.preferences = { ...cachedProfile.preferences, ...preferences };
        cachedProfile.lastUpdated = new Date();
        console.log('📝 Profile preferences updated in cache');
      }
    }
  }

  /**
   * Track user interaction (with fallback)
   */
  async trackInteraction(
    userId: string,
    interactionData: {
      subject: string;
      topic: string;
      duration: number;
      satisfaction?: number;
    }
  ): Promise<void> {
    try {
      // Try database tracking first
        // @ts-ignore
      await this.userProfileService.trackUserInteraction(userId, interactionData);
      console.log('✅ Interaction tracked in database');

    } catch (error) {
        // @ts-ignore
      console.warn('⚠️ Database tracking failed, using local tracking:', error.message);
      
      // Update local cache analytics
      const cachedProfile = this.profileCache.get(userId);
      if (cachedProfile) {
        // @ts-ignore
        cachedProfile.analytics.totalInteractions++;
        // @ts-ignore
        cachedProfile.analytics.lastActive = new Date();
        
        // Update preferred topics
        // @ts-ignore
        if (!cachedProfile.analytics.preferredTopics.includes(interactionData.topic)) {
        // @ts-ignore
          cachedProfile.analytics.preferredTopics.push(interactionData.topic);
        }
        
        console.log('📊 Interaction tracked locally');
      }
    }
  }

  /**
   * Get cached profile if valid
   */
  private getCachedProfile(userId: string): EnhancedUserProfile | null {
    const cached = this.profileCache.get(userId);
    if (!cached)
  return null;

    // Check if cache is still valid
    const now = new Date();
    const cacheAge = now.getTime() - cached.lastUpdated.getTime();
    
    if (cacheAge > this.cacheTimeout) {
      this.profileCache.delete(userId);
      return null;
    }

    return cached;
  }

  /**
   * Cache profile with timestamp
   */
  private cacheProfile(userId: string, profile: EnhancedUserProfile): void {
    this.profileCache.set(userId, profile);
  }

  /**
   * Normalize role from session data
   */
  private normalizeRole(role: string): string {
    const roleMap: Record<string, string> = {
      'student': 'student',
      'teacher': 'teacher',
      'parent': 'parent_guardian',
      'parent_guardian': 'parent_guardian',
      'guardian': 'parent_guardian'
    };

    return roleMap[role.toLowerCase()] || 'student';
  }

  /**
   * Extract grade from class level string
   */
  private extractGrade(classLevel?: string): number | null {
    if (!classLevel)
  return null;
    
    const match = classLevel.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }

  /**
   * Extract subjects from session data
   */
  private extractSubjects(sessionData: SessionData): string[] | null {
    if (sessionData.subject) {
      // Handle CBSE Class 9 Social Science breakdown
      if (sessionData.subject === 'Social Science') {
        return ['Geography', 'History', 'Political Science', 'Economics'];
      }
      return [sessionData.subject];
    }
    return null;
  }

  /**
   * Get default subjects for grade level
   */
  private getDefaultSubjects(grade: number): string[] {
    const subjectsByGrade: Record<number, string[]> = {
      6: ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi'],
      7: ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi'],
      8: ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi'],
      9: ['Mathematics', 'Science', 'Geography', 'History', 'Political Science', 'Economics', 'English', 'Hindi'],
      10: ['Mathematics', 'Science', 'Geography', 'History', 'Political Science', 'Economics', 'English', 'Hindi']
    };

    return subjectsByGrade[grade] || ['Mathematics', 'Science', 'English'];
  }

  /**
   * Get complexity level based on grade
   */
  private getComplexityForGrade(grade: number): 'basic' | 'intermediate' | 'advanced' {
    if (grade <= 7)
  return 'basic';
    if (grade <= 9)
  return 'intermediate';
    return 'advanced';
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.profileCache.clear();
    console.log('🧹 Profile cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; profiles: string[] } {
    return {
      size: this.profileCache.size,
      profiles: Array.from(this.profileCache.keys())
    };
  }
}
