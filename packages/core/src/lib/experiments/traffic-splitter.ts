/**
 * Traffic Splitter for A/B Testing
 * Provides consistent hash-based user assignment to experiment variants
 * 
 * Features:
 * - Deterministic assignment (same user always gets same variant)
 * - Configurable traffic split (default 50/50)
 * - Persistent assignment tracking in database
 * - Support for multiple concurrent experiments
 */

import crypto from 'crypto'
import { executeQuery } from '@/lib/db/connection'
import { v4 as uuidv4 } from 'uuid'

export type Variant = 'A' | 'B'

export interface ExperimentConfig {
  experimentId: string
  experimentName: string
  trafficSplitPercentage?: number  // Percentage to variant B (0-100), default 50
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
}

export interface VariantAssignment {
  variant: Variant
  experimentId: string
  assignmentId: string
  isNewAssignment: boolean
}

/**
 * Get user's variant for an experiment
 * Uses consistent hashing for deterministic assignment
 * Stores assignment in database for tracking
 */
export async function getUserVariant(
  userId: string,
  experimentId: string,
  trafficSplitPercentage: number = 50
): Promise<VariantAssignment> {
  // Check if user already has an assignment
  const existingAssignment = await getExistingAssignment(userId, experimentId)
  
  if (existingAssignment) {
    return {
      variant: existingAssignment.variant as Variant,
      experimentId,
      assignmentId: existingAssignment.assignment_id,
      isNewAssignment: false
    }
  }
  
  // Calculate variant using consistent hashing
  const variant = calculateVariant(userId, experimentId, trafficSplitPercentage)
  
  // Store assignment in database
  const assignmentId = await storeAssignment(userId, experimentId, variant)
  
  return {
    variant,
    experimentId,
    assignmentId,
    isNewAssignment: true
  }
}

/**
 * Calculate variant using consistent hashing
 * Same user + experiment always produces same variant
 */
function calculateVariant(
  userId: string,
  experimentId: string,
  trafficSplitPercentage: number
): Variant {
  // Create hash from userId + experimentId
  const hash = hashString(userId + experimentId)
  
  // Convert to percentage (0-100)
  const percentage = hash % 100
  
  // Assign to variant based on traffic split
  // If trafficSplitPercentage = 50, then 0-49 -> A, 50-99 -> B
  return percentage < trafficSplitPercentage ? 'B' : 'A'
}

/**
 * Hash string to integer using MD5
 * Provides consistent, evenly distributed hash values
 */
function hashString(input: string): number {
  const hash = crypto.createHash('md5').update(input).digest('hex')
  // Take first 8 characters and convert to integer
  return parseInt(hash.substring(0, 8), 16)
}

/**
 * Get existing assignment from database
 */
async function getExistingAssignment(
  userId: string,
  experimentId: string
): Promise<any | null> {
  try {
    const results = await executeQuery(
      `SELECT assignment_id, variant, assigned_at
       FROM experiment_assignments
       WHERE user_id = ? AND experiment_id = ?
       LIMIT 1`,
      [userId, experimentId]
    )
    
    return results.length > 0 ? results[0] : null
    
  } catch (error) {
    console.error('[Traffic Splitter] Error fetching assignment:', error)
    return null
  }
}

/**
 * Store new assignment in database
 */
async function storeAssignment(
  userId: string,
  experimentId: string,
  variant: Variant
): Promise<string> {
  const assignmentId = uuidv4()
  const hashValue = hashString(userId + experimentId)
  
  try {
    await executeQuery(
      `INSERT INTO experiment_assignments (
        assignment_id,
        experiment_id,
        user_id,
        variant,
        assignment_method,
        hash_value,
        assigned_at
      ) VALUES (?, ?, ?, ?, 'hash', ?, NOW())`,
      [assignmentId, experimentId, userId, variant, hashValue]
    )
    
    console.log(`[Traffic Splitter] Assigned user ${userId} to variant ${variant} for experiment ${experimentId}`)
    
    return assignmentId
    
  } catch (error) {
    console.error('[Traffic Splitter] Error storing assignment:', error)
    // Return generated ID even if storage fails
    return assignmentId
  }
}

/**
 * Get all active experiments
 */
export async function getActiveExperiments(): Promise<ExperimentConfig[]> {
  try {
    const results = await executeQuery(
      `SELECT experiment_id, experiment_name, traffic_split_percentage, status
       FROM experiments
       WHERE status = 'active'
       ORDER BY created_at DESC`
    )
    
    return results.map((row: any) => ({
      experimentId: row.experiment_id,
      experimentName: row.experiment_name,
      trafficSplitPercentage: row.traffic_split_percentage || 50,
      status: row.status
    }))
    
  } catch (error) {
    console.error('[Traffic Splitter] Error fetching active experiments:', error)
    return []
  }
}

/**
 * Check if experiment is active
 */
export async function isExperimentActive(experimentId: string): Promise<boolean> {
  try {
    const results = await executeQuery(
      `SELECT status FROM experiments WHERE experiment_id = ? LIMIT 1`,
      [experimentId]
    )
    
    return results.length > 0 && results[0].status === 'active'
    
  } catch (error) {
    console.error('[Traffic Splitter] Error checking experiment status:', error)
    return false
  }
}

/**
 * Get user's variants for all active experiments
 * Useful for tracking which experiments a user is part of
 */
export async function getUserExperiments(userId: string): Promise<VariantAssignment[]> {
  try {
    const results = await executeQuery(
      `SELECT 
        ea.assignment_id,
        ea.experiment_id,
        ea.variant,
        e.experiment_name
       FROM experiment_assignments ea
       JOIN experiments e ON ea.experiment_id = e.experiment_id
       WHERE ea.user_id = ? AND e.status = 'active'
       ORDER BY ea.assigned_at DESC`,
      [userId]
    )
    
    return results.map((row: any) => ({
      variant: row.variant as Variant,
      experimentId: row.experiment_id,
      assignmentId: row.assignment_id,
      isNewAssignment: false
    }))
    
  } catch (error) {
    console.error('[Traffic Splitter] Error fetching user experiments:', error)
    return []
  }
}

/**
 * Manually assign user to variant (for testing or special cases)
 */
export async function manuallyAssignVariant(
  userId: string,
  experimentId: string,
  variant: Variant
): Promise<VariantAssignment> {
  const assignmentId = uuidv4()
  
  try {
    // Delete existing assignment if any
    await executeQuery(
      `DELETE FROM experiment_assignments 
       WHERE user_id = ? AND experiment_id = ?`,
      [userId, experimentId]
    )
    
    // Insert new manual assignment
    await executeQuery(
      `INSERT INTO experiment_assignments (
        assignment_id,
        experiment_id,
        user_id,
        variant,
        assignment_method,
        assigned_at
      ) VALUES (?, ?, ?, ?, 'manual', NOW())`,
      [assignmentId, experimentId, userId, variant]
    )
    
    console.log(`[Traffic Splitter] Manually assigned user ${userId} to variant ${variant} for experiment ${experimentId}`)
    
    return {
      variant,
      experimentId,
      assignmentId,
      isNewAssignment: true
    }
    
  } catch (error) {
    console.error('[Traffic Splitter] Error with manual assignment:', error)
    throw error
  }
}

/**
 * Get experiment statistics
 */
export async function getExperimentStats(experimentId: string): Promise<{
  variantA: number
  variantB: number
  total: number
  splitPercentage: number
}> {
  try {
    const results = await executeQuery(
      `SELECT 
        variant,
        COUNT(*) as count
       FROM experiment_assignments
       WHERE experiment_id = ?
       GROUP BY variant`,
      [experimentId]
    )
    
    const variantA = results.find((r: any) => r.variant === 'A')?.count || 0
    const variantB = results.find((r: any) => r.variant === 'B')?.count || 0
    const total = variantA + variantB
    const splitPercentage = total > 0 ? (variantB / total * 100) : 0
    
    return {
      variantA,
      variantB,
      total,
      splitPercentage
    }
    
  } catch (error) {
    console.error('[Traffic Splitter] Error fetching experiment stats:', error)
    return {
      variantA: 0,
      variantB: 0,
      total: 0,
      splitPercentage: 0
    }
  }
}

