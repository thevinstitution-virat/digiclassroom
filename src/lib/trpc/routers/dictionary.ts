/**
 * VG Kosh Dictionary tRPC Router
 * Handles English-Hindi dictionary operations with Amarkosha semantics
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, baseProcedure } from '../server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import type { 
  DictionaryWord, 
  UserVocabProgress, 
  CommunityPhrase,
  DictionaryUserStats,
  DictionarySearchResponse,
  WordDetailResponse
} from '@/types/dictionary'

// Input validation schemas
const searchRequestSchema = z.object({
  query: z.string().min(1).max(255),
  searchType: z.enum(['exact', 'fuzzy', 'phonetic', 'semantic']).default('fuzzy'),
  limit: z.number().min(1).max(50).default(10),
  offset: z.number().min(0).default(0),
  difficultyFilter: z.array(z.enum(['beginner', 'intermediate', 'advanced'])).optional(),
  categoryFilter: z.array(z.string()).optional()
})

const wordDetailRequestSchema = z.object({
  wordId: z.number().optional(),
  word: z.string().optional(),
  includeProgress: z.boolean().default(true),
  includeCommunityPhrases: z.boolean().default(true)
}).refine(data => data.wordId || data.word, {
  message: "Either wordId or word must be provided"
})

const submitPhraseSchema = z.object({
  wordId: z.number(),
  phrase: z.string().min(1).max(500),
  context: z.string().max(1000).optional(),
  region: z.string().max(100).optional(),
  languageVariant: z.string().max(50).optional()
})

const updateProgressSchema = z.object({
  wordId: z.number(),
  action: z.enum(['correct', 'incorrect', 'skip']),
  timeSpent: z.number().min(0).optional()
})

export const dictionaryRouter = createTRPCRouter({
  /**
   * Search for words in the dictionary
   */
  searchWords: baseProcedure
    .input(searchRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const { query, searchType, limit, offset, difficultyFilter, categoryFilter } = input
      
      try {
        console.log('🔍 Dictionary search request:', { query, searchType, limit, offset })

        // Build search query based on search type
        let searchSQL = `
          SELECT
            id, word, pronunciation, part_of_speech as partOfSpeech,
            english_definition as englishDefinition, hindi_translation as hindiTranslation,
            devanagari_script as devanagariScript, amarkosha_category as amarkoshaCategory,
            semantic_cluster as semanticCluster, difficulty_level as difficultyLevel,
            frequency_rank as frequencyRank, audio_url as audioUrl,
            audio_accent as audioAccent, created_at as createdAt
          FROM dictionary_words
          WHERE 1=1
        `
        
        const params: any[] = []
        
        // Add search conditions based on type
        switch (searchType) {
          case 'exact':
            searchSQL += ` AND word = ?`
            params.push(query)
            break
          case 'fuzzy':
            searchSQL += ` AND (word LIKE ? OR hindi_translation LIKE ? OR english_definition LIKE ?)`
            params.push(`%${query}%`, `%${query}%`, `%${query}%`)
            break
          case 'phonetic':
            // Simple phonetic matching - can be enhanced with Soundex or Metaphone
            searchSQL += ` AND (SOUNDEX(word) = SOUNDEX(?) OR word LIKE ?)`
            params.push(query, `%${query}%`)
            break
          case 'semantic':
            // Semantic search using fulltext
            searchSQL += ` AND MATCH(word, english_definition, hindi_translation) AGAINST(? IN NATURAL LANGUAGE MODE)`
            params.push(query)
            break
        }
        
        // Add filters
        if (difficultyFilter && difficultyFilter.length > 0) {
          searchSQL += ` AND difficulty_level IN (${difficultyFilter.map(() => '?').join(',')})`
          params.push(...difficultyFilter)
        }
        
        if (categoryFilter && categoryFilter.length > 0) {
          searchSQL += ` AND amarkosha_category IN (${categoryFilter.map(() => '?').join(',')})`
          params.push(...categoryFilter)
        }
        
        // Add ordering and pagination
        searchSQL += ` ORDER BY 
          CASE 
            WHEN word = ? THEN 1
            WHEN word LIKE ? THEN 2
            WHEN hindi_translation LIKE ? THEN 3
            ELSE 4
          END,
          frequency_rank ASC,
          word ASC
          LIMIT ? OFFSET ?
        `
        params.push(query, `${query}%`, `${query}%`, limit, offset)

        console.log('🔍 Final search SQL:', searchSQL)
        console.log('🔍 Search parameters:', params)

        const words = await executeQuery<DictionaryWord>(searchSQL, params)
        console.log('🔍 Search results:', words.length, 'words found')
        
        // Get total count for pagination
        let countSQL = `SELECT COUNT(*) as total FROM dictionary_words WHERE 1=1`
        const countParams: any[] = []
        
        // Apply same filters for count
        switch (searchType) {
          case 'exact':
            countSQL += ` AND word = ?`
            countParams.push(query)
            break
          case 'fuzzy':
            countSQL += ` AND (word LIKE ? OR hindi_translation LIKE ? OR english_definition LIKE ?)`
            countParams.push(`%${query}%`, `%${query}%`, `%${query}%`)
            break
          case 'phonetic':
            countSQL += ` AND (SOUNDEX(word) = SOUNDEX(?) OR word LIKE ?)`
            countParams.push(query, `%${query}%`)
            break
          case 'semantic':
            countSQL += ` AND MATCH(word, english_definition, hindi_translation) AGAINST(? IN NATURAL LANGUAGE MODE)`
            countParams.push(query)
            break
        }
        
        if (difficultyFilter && difficultyFilter.length > 0) {
          countSQL += ` AND difficulty_level IN (${difficultyFilter.map(() => '?').join(',')})`
          countParams.push(...difficultyFilter)
        }
        
        if (categoryFilter && categoryFilter.length > 0) {
          countSQL += ` AND amarkosha_category IN (${categoryFilter.map(() => '?').join(',')})`
          countParams.push(...categoryFilter)
        }
        
        const countResult = await executeQuerySingle<{ total: number }>(countSQL, countParams)
        const total = countResult?.total || 0
        
        // Log search for analytics (only if user is authenticated)
        if (ctx.userId) {
          await executeQuery(
            `INSERT INTO dictionary_search_history
             (user_id, clerk_user_id, search_query, search_type, results_count, search_context)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [ctx.userId, ctx.userId, query, searchType, words.length, 'browse']
          )
        }
        
        const response: DictionarySearchResponse = {
          words,
          total,
          hasMore: offset + words.length < total,
          searchType,
          suggestions: [] // TODO: Implement search suggestions
        }
        
        return response
        
      } catch (error) {
        console.error('Dictionary search error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search dictionary'
        })
      }
    }),

  /**
   * Get detailed information about a specific word
   */
  getWordDetail: baseProcedure
    .input(wordDetailRequestSchema)
    .query(async ({ input, ctx }) => {
      const { wordId, word, includeProgress, includeCommunityPhrases } = input
      
      try {
        // Get word details
        let wordSQL = `
          SELECT 
            id, word, pronunciation, part_of_speech as partOfSpeech,
            english_definition as englishDefinition, english_synonyms as englishSynonyms,
            english_antonyms as englishAntonyms, hindi_translation as hindiTranslation,
            hindi_synonyms as hindiSynonyms, devanagari_script as devanagariScript,
            amarkosha_category as amarkoshaCategory, semantic_cluster as semanticCluster,
            etymology, examples, cultural_context as culturalContext,
            regional_usage as regionalUsage, audio_url as audioUrl,
            audio_accent as audioAccent, difficulty_level as difficultyLevel,
            frequency_rank as frequencyRank, source, is_active as isActive,
            created_at as createdAt, updated_at as updatedAt
          FROM dictionary_words 
          WHERE is_active = TRUE AND ${wordId ? 'id = ?' : 'word = ?'}
        `
        
        const wordResult = await executeQuerySingle<DictionaryWord>(
          wordSQL, 
          [wordId || word]
        )
        
        if (!wordResult) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Word not found'
          })
        }
        
        // Parse JSON fields
        if (wordResult.englishSynonyms && typeof wordResult.englishSynonyms === 'string') {
          wordResult.englishSynonyms = JSON.parse(wordResult.englishSynonyms as string)
        }
        if (wordResult.englishAntonyms && typeof wordResult.englishAntonyms === 'string') {
          wordResult.englishAntonyms = JSON.parse(wordResult.englishAntonyms as string)
        }
        if (wordResult.hindiSynonyms && typeof wordResult.hindiSynonyms === 'string') {
          wordResult.hindiSynonyms = JSON.parse(wordResult.hindiSynonyms as string)
        }
        if (wordResult.examples && typeof wordResult.examples === 'string') {
          wordResult.examples = JSON.parse(wordResult.examples as string)
        }
        if (wordResult.regionalUsage && typeof wordResult.regionalUsage === 'string') {
          wordResult.regionalUsage = JSON.parse(wordResult.regionalUsage as string)
        }
        
        const response: WordDetailResponse = {
          word: wordResult
        }
        
        // Get user progress if requested
        if (includeProgress) {
          const progressSQL = `
            SELECT 
              id, user_id as userId, clerk_user_id as clerkUserId, word_id as wordId,
              efactor, interval_days as intervalDays, repetitions, next_due_date as nextDueDate,
              last_reviewed as lastReviewed, correct_attempts as correctAttempts,
              total_attempts as totalAttempts, accuracy_percentage as accuracyPercentage,
              status, first_learned_at as firstLearnedAt, mastered_at as masteredAt,
              created_at as createdAt, updated_at as updatedAt
            FROM user_vocab_progress 
            WHERE user_id = ? AND word_id = ?
          `
          
          const progressResult = await executeQuerySingle<UserVocabProgress>(
            progressSQL,
            [ctx.userId, wordResult.id]
          )
          
          if (progressResult) {
            response.userProgress = progressResult
          }
        }
        
        // Get community phrases if requested
        if (includeCommunityPhrases) {
          const phrasesSQL = `
            SELECT 
              id, word_id as wordId, user_id as userId, clerk_user_id as clerkUserId,
              phrase, context, region, language_variant as languageVariant,
              is_approved as isApproved, approved_by as approvedBy, approved_at as approvedAt,
              upvotes, downvotes, created_at as createdAt
            FROM community_phrases 
            WHERE word_id = ? AND is_approved = TRUE
            ORDER BY upvotes DESC, created_at DESC
            LIMIT 10
          `
          
          const phrasesResult = await executeQuery<CommunityPhrase>(
            phrasesSQL,
            [wordResult.id]
          )
          
          response.communityPhrases = phrasesResult
        }
        
        // Log word access for analytics
        await executeQuery(
          `INSERT INTO dictionary_search_history 
           (user_id, clerk_user_id, search_query, search_type, results_count, selected_word_id, search_context) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ctx.userId, ctx.userId, wordResult.word, 'exact', 1, wordResult.id, 'learning']
        )
        
        return response
        
      } catch (error) {
        if (error instanceof TRPCError)
  throw error
        
        console.error('Get word detail error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get word details'
        })
      }
    }),

  /**
   * Get user's dictionary statistics
   */
  getUserStats: baseProcedure
    .query(async ({ ctx }) => {
      try {
        // For now, return default stats if no user context
        if (!ctx.userId) {
          return {
            id: 0,
            userId: 'anonymous',
            clerkUserId: 'anonymous',
            totalWordsLearned: 0,
            wordsMastered: 0,
            currentStreakDays: 0,
            longestStreakDays: 0,
            lastActivityDate: null,
            totalQuizAttempts: 0,
            correctQuizAnswers: 0,
            averageAccuracy: 0,
            totalPoints: 0,
            level: 1,
            badgesEarned: [],
            achievements: [],
            phrasesContributed: 0,
            phrasesApproved: 0,
            communityReputation: 0,
            dailyGoalWords: 5,
            preferredDifficulty: 'mixed' as const,
            notificationPreferences: {},
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }

        const statsSQL = `
          SELECT 
            id, user_id as userId, clerk_user_id as clerkUserId,
            total_words_learned as totalWordsLearned, words_mastered as wordsMastered,
            current_streak_days as currentStreakDays, longest_streak_days as longestStreakDays,
            last_activity_date as lastActivityDate, total_quiz_attempts as totalQuizAttempts,
            correct_quiz_answers as correctQuizAnswers, average_accuracy as averageAccuracy,
            total_points as totalPoints, level, badges_earned as badgesEarned,
            achievements, phrases_contributed as phrasesContributed,
            phrases_approved as phrasesApproved, community_reputation as communityReputation,
            daily_goal_words as dailyGoalWords, preferred_difficulty as preferredDifficulty,
            notification_preferences as notificationPreferences,
            created_at as createdAt, updated_at as updatedAt
          FROM dictionary_user_stats 
          WHERE user_id = ?
        `
        
        let userStats = await executeQuerySingle<DictionaryUserStats>(statsSQL, [ctx.userId])
        
        // Create default stats if user doesn't exist
        if (!userStats) {
          await executeQuery(
            `INSERT INTO dictionary_user_stats (user_id, clerk_user_id) VALUES (?, ?)`,
            [ctx.userId, ctx.userId]
          )
          
          userStats = await executeQuerySingle<DictionaryUserStats>(statsSQL, [ctx.userId])
        }
        
        // Parse JSON fields
        if (userStats) {
          if (userStats.badgesEarned && typeof userStats.badgesEarned === 'string') {
            userStats.badgesEarned = JSON.parse(userStats.badgesEarned as string)
          }
          if (userStats.achievements && typeof userStats.achievements === 'string') {
            userStats.achievements = JSON.parse(userStats.achievements as string)
          }
          if (userStats.notificationPreferences && typeof userStats.notificationPreferences === 'string') {
            userStats.notificationPreferences = JSON.parse(userStats.notificationPreferences as string)
          }
        }
        
        return userStats
        
      } catch (error) {
        console.error('Get user stats error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get user statistics'
        })
      }
    })
})

export type DictionaryRouter = typeof dictionaryRouter
