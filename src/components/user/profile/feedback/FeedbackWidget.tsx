'use client'

/**
 * DigiClassroom Pro - Simplified Feedback Widget Component
 * Streamlined single-line feedback with auto-submit
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSession } from '@/auth/client';
import { ThumbsUp, ThumbsDown, Star, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotification } from '@/lib/store';

// ============================================================================
// Types
// ============================================================================

export interface FeedbackWidgetProps {
  // Required props
  questionText: string;
  answerText: string;
  board: 'CBSE' | 'ICSE' | 'STATE_BOARD';
  classLevel: number;
  subject: string;

  // Optional props
  answerId?: string;
  commandWord?: string;
  marksAllocated?: number;

  // Performance metrics (optional)
  responseTimeMs?: number;
  cacheHit?: boolean;
  cacheType?: 'semantic' | 'openai' | 'pre-generated' | 'none';
  faithfulnessScore?: number;
  relevanceScore?: number;
  contextPrecisionScore?: number;
  contextRecallScore?: number;

  // Routing information (optional)
  routeType?: string;
  complexity?: string;
  intentType?: string;

  // Session info (optional)
  sessionId?: string;

  // Styling
  className?: string;
}

// ============================================================================
// FeedbackWidget Component
// ============================================================================

export function FeedbackWidget(props: FeedbackWidgetProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const { addNotification } = useNotification();

  // State
  const [thumbsRating, setThumbsRating] = useState<'up' | 'down' | null>(null);
  const [starRating, setStarRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // ============================================================================
  // Auto-submit Handler
  // ============================================================================

  const submitFeedback = async (thumbs?: 'up' | 'down', stars?: number) => {
    if (!user) {
      addNotification({
        type: 'error',
        title: 'Authentication Required',
        message: 'Please sign in to submit feedback'
      });
      return;
    }

    try {
      // Convert board to uppercase to match API schema (CBSE, ICSE, STATE_BOARD)
      const boardUppercase = props.board ? props.board.toUpperCase().replace(/-/g, '_') : 'CBSE';

      const payload: Record<string, any> = {
        questionText: props.questionText || 'No question provided',
        answerText: props.answerText || 'No answer provided',
        board: boardUppercase,
        classLevel: props.classLevel || 10,
        subject: props.subject || 'General',
        answerId: props.answerId,
        thumbsRating: thumbs,
        starRating: stars,
        userId: user.id,
        clerkId: user.id,
      };

      // Only include optional metrics if they have actual values
      if (props.responseTimeMs != null) payload.responseTimeMs = props.responseTimeMs;
      if (props.cacheHit != null) payload.cacheHit = props.cacheHit;
      if (props.cacheType) payload.cacheType = props.cacheType;
      if (props.faithfulnessScore != null) payload.faithfulnessScore = props.faithfulnessScore;
      if (props.relevanceScore != null) payload.relevanceScore = props.relevanceScore;
      if (props.contextPrecisionScore != null) payload.contextPrecisionScore = props.contextPrecisionScore;
      if (props.contextRecallScore != null) payload.contextRecallScore = props.contextRecallScore;
      if (props.routeType) payload.routeType = props.routeType;
      if (props.complexity) payload.complexity = props.complexity;
      if (props.intentType) payload.intentType = props.intentType;
      if (props.sessionId) payload.sessionId = props.sessionId;

      console.log('📤 Submitting feedback:', payload);
      console.log('📤 Payload JSON:', JSON.stringify(payload, null, 2));

      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('📥 Response status:', response.status, response.statusText);

      const data = await response.json();
      console.log('📥 Response data:', data);

      if (data.success) {
        console.log('✅ Feedback submitted successfully:', data.feedbackId);
        setIsSubmitted(true);
        setShowSuccess(true);

        // Hide success indicator after 2 seconds
        setTimeout(() => setShowSuccess(false), 2000);
      } else {
        console.error('❌ Feedback submission failed:', data);
        console.error('❌ Error details:', data.error);
        console.error('❌ Validation details:', data.details);
        throw new Error(data.error || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('❌ Feedback submission error:', error);
      addNotification({
        type: 'error',
        title: 'Submission Failed',
        message: 'Failed to submit feedback. Please try again.'
      });
    }
  };

  // ============================================================================
  // Click Handlers with Auto-submit
  // ============================================================================

  const handleThumbsClick = async (rating: 'up' | 'down') => {
    if (isSubmitted) return;

    const newRating = thumbsRating === rating ? null : rating;
    setThumbsRating(newRating);

    if (newRating) {
      await submitFeedback(newRating, starRating || undefined);
    }
  };

  const handleStarClick = async (rating: number) => {
    if (isSubmitted) return;

    setStarRating(rating);
    await submitFeedback(thumbsRating || undefined, rating);
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex items-center gap-3 py-2',
        props.className
      )}
    >
      {/* Thumbs Up/Down */}
      <div className="flex items-center gap-1.5">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleThumbsClick('up')}
          disabled={isSubmitted}
          className={cn(
            'p-1.5 rounded-lg transition-all duration-200',
            'hover:bg-green-50 dark:hover:bg-green-900/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            thumbsRating === 'up'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : 'text-gray-400 hover:text-green-600'
          )}
          aria-label="Like this answer"
        >
          <ThumbsUp className="h-4 w-4" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleThumbsClick('down')}
          disabled={isSubmitted}
          className={cn(
            'p-1.5 rounded-lg transition-all duration-200',
            'hover:bg-red-50 dark:hover:bg-red-900/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            thumbsRating === 'down'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'text-gray-400 hover:text-red-600'
          )}
          aria-label="Dislike this answer"
        >
          <ThumbsDown className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Success Indicator */}
      {showSuccess && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="flex items-center gap-1.5 text-green-600 dark:text-green-400"
        >
          <Check className="h-4 w-4" />
          <span className="text-xs font-medium">Thanks!</span>
        </motion.div>
      )}
    </motion.div>
  );
}
