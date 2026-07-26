/**
 * Statistical Analysis Tools for A/B Testing
 * Provides t-test, p-value calculation, and confidence intervals
 * 
 * Features:
 * - Two-sample t-test (Welch's t-test)
 * - P-value calculation
 * - Confidence intervals (95%)
 * - Effect size calculation (Cohen's d)
 * - Sample size recommendations
 */

export interface ExperimentData {
  variantA: number[]
  variantB: number[]
}

export interface TTestResult {
  tStatistic: number
  pValue: number
  degreesOfFreedom: number
  isSignificant: boolean
  confidenceLevel: number
}

export interface StatisticalSummary {
  mean: number
  std: number
  variance: number
  min: number
  max: number
  median: number
  sampleSize: number
}

export interface ComparisonResult {
  variantA: StatisticalSummary
  variantB: StatisticalSummary
  tTest: TTestResult
  effectSize: number
  confidenceInterval: {
    lower: number
    upper: number
  }
  recommendation: string
  percentChange: number
}

/**
 * Calculate two-sample t-test (Welch's t-test)
 * Does not assume equal variances
 */
export function calculateTTest(
  data: ExperimentData,
  confidenceLevel: number = 0.95
): TTestResult {
  const { variantA, variantB } = data
  
  if (variantA.length === 0 || variantB.length === 0) {
    throw new Error('Both variants must have at least one sample')
  }
  
  // Calculate means
  const meanA = calculateMean(variantA)
  const meanB = calculateMean(variantB)
  
  // Calculate standard deviations
  const stdA = calculateStd(variantA)
  const stdB = calculateStd(variantB)
  
  // Calculate standard error
  const seA = Math.pow(stdA, 2) / variantA.length
  const seB = Math.pow(stdB, 2) / variantB.length
  const standardError = Math.sqrt(seA + seB)
  
  // Calculate t-statistic
  const tStatistic = (meanB - meanA) / standardError
  
  // Calculate degrees of freedom (Welch-Satterthwaite equation)
  const dfNumerator = Math.pow(seA + seB, 2)
  const dfDenominator = 
    Math.pow(seA, 2) / (variantA.length - 1) +
    Math.pow(seB, 2) / (variantB.length - 1)
  const degreesOfFreedom = dfNumerator / dfDenominator
  
  // Calculate p-value (two-tailed)
  const pValue = calculatePValue(Math.abs(tStatistic), degreesOfFreedom)
  
  // Determine significance
  const alpha = 1 - confidenceLevel
  const isSignificant = pValue < alpha
  
  return {
    tStatistic,
    pValue,
    degreesOfFreedom,
    isSignificant,
    confidenceLevel
  }
}

/**
 * Calculate p-value from t-statistic and degrees of freedom
 * Uses approximation for Student's t-distribution
 */
function calculatePValue(tStat: number, df: number): number {
  // For large df (> 30), t-distribution approximates normal distribution
  if (df > 30) {
    return 2 * (1 - normalCDF(tStat))
  }
  
  // For smaller df, use t-distribution approximation
  return 2 * (1 - tCDF(tStat, df))
}

/**
 * Cumulative distribution function for standard normal distribution
 * Uses error function approximation
 */
function normalCDF(x: number): number {
  // Approximation using error function
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp(-x * x / 2)
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  
  return x > 0 ? 1 - prob : prob
}

/**
 * Cumulative distribution function for Student's t-distribution
 * Uses approximation for small degrees of freedom
 */
function tCDF(t: number, df: number): number {
  // Approximation using beta function
  const x = df / (df + t * t)
  const a = df / 2
  const b = 0.5
  
  // Incomplete beta function approximation
  const betaApprox = incompleteBeta(x, a, b)
  
  return t > 0 ? 1 - betaApprox / 2 : betaApprox / 2
}

/**
 * Incomplete beta function approximation
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x === 0)
  return 0
  if (x === 1)
  return 1
  
  // Simple approximation for our use case
  // For more accuracy, would use continued fractions
  return Math.pow(x, a) * Math.pow(1 - x, b) / (a * beta(a, b))
}

/**
 * Beta function
 */
function beta(a: number, b: number): number {
  return (gamma(a) * gamma(b)) / gamma(a + b)
}

/**
 * Gamma function approximation (Stirling's approximation)
 */
function gamma(n: number): number {
  if (n === 1)
  return 1
  if (n === 0.5)
  return Math.sqrt(Math.PI)
  
  // Stirling's approximation
  return Math.sqrt(2 * Math.PI / n) * Math.pow(n / Math.E, n)
}

/**
 * Calculate statistical summary for a dataset
 */
export function calculateSummary(data: number[]): StatisticalSummary {
  if (data.length === 0) {
    throw new Error('Dataset must have at least one value')
  }
  
  const sorted = [...data].sort((a, b) => a - b)
  
  return {
    mean: calculateMean(data),
    std: calculateStd(data),
    variance: calculateVariance(data),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: calculateMedian(sorted),
    sampleSize: data.length
  }
}

/**
 * Calculate mean
 */
function calculateMean(data: number[]): number {
  return data.reduce((sum, val) => sum + val, 0) / data.length
}

/**
 * Calculate standard deviation
 */
function calculateStd(data: number[]): number {
  return Math.sqrt(calculateVariance(data))
}

/**
 * Calculate variance
 */
function calculateVariance(data: number[]): number {
  const mean = calculateMean(data)
  const squaredDiffs = data.map(val => Math.pow(val - mean, 2))
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / (data.length - 1)
}

/**
 * Calculate median
 */
function calculateMedian(sortedData: number[]): number {
  const mid = Math.floor(sortedData.length / 2)
  
  if (sortedData.length % 2 === 0) {
    return (sortedData[mid - 1] + sortedData[mid]) / 2
  } else {
    return sortedData[mid]
  }
}

/**
 * Calculate effect size (Cohen's d)
 */
export function calculateEffectSize(data: ExperimentData): number {
  const meanA = calculateMean(data.variantA)
  const meanB = calculateMean(data.variantB)
  
  const varA = calculateVariance(data.variantA)
  const varB = calculateVariance(data.variantB)
  
  // Pooled standard deviation
  const pooledStd = Math.sqrt((varA + varB) / 2)
  
  // Cohen's d
  return (meanB - meanA) / pooledStd
}

/**
 * Calculate confidence interval for difference in means
 */
export function calculateConfidenceInterval(
  data: ExperimentData,
  confidenceLevel: number = 0.95
): { lower: number; upper: number } {
  const meanA = calculateMean(data.variantA)
  const meanB = calculateMean(data.variantB)
  const meanDiff = meanB - meanA
  
  const stdA = calculateStd(data.variantA)
  const stdB = calculateStd(data.variantB)
  
  const seA = Math.pow(stdA, 2) / data.variantA.length
  const seB = Math.pow(stdB, 2) / data.variantB.length
  const standardError = Math.sqrt(seA + seB)
  
  // Critical value for 95% confidence (approximately 1.96 for large samples)
  const criticalValue = 1.96
  const marginOfError = criticalValue * standardError
  
  return {
    lower: meanDiff - marginOfError,
    upper: meanDiff + marginOfError
  }
}

/**
 * Comprehensive comparison of two variants
 */
export function compareVariants(data: ExperimentData): ComparisonResult {
  const summaryA = calculateSummary(data.variantA)
  const summaryB = calculateSummary(data.variantB)
  const tTest = calculateTTest(data)
  const effectSize = calculateEffectSize(data)
  const confidenceInterval = calculateConfidenceInterval(data)
  
  // Calculate percent change
  const percentChange = ((summaryB.mean - summaryA.mean) / summaryA.mean) * 100
  
  // Generate recommendation
  let recommendation = ''
  if (!tTest.isSignificant) {
    recommendation = 'No significant difference detected. Keep Variant A (Control).'
  } else if (summaryB.mean > summaryA.mean) {
    recommendation = `Variant B shows significant improvement (+${percentChange.toFixed(2)}%). Deploy Variant B.`
  } else {
    recommendation = `Variant B shows significant decline (${percentChange.toFixed(2)}%). Keep Variant A (Control).`
  }
  
  return {
    variantA: summaryA,
    variantB: summaryB,
    tTest,
    effectSize,
    confidenceInterval,
    recommendation,
    percentChange
  }
}

/**
 * Calculate required sample size for experiment
 */
export function calculateRequiredSampleSize(
  baselineValue: number,
  minimumDetectableEffect: number,
  power: number = 0.8,
  alpha: number = 0.05
): number {
  // Simplified calculation
  // For more accuracy, would use power analysis formulas
  
  const zAlpha = 1.96  // Z-score for alpha = 0.05 (two-tailed)
  const zBeta = 0.84   // Z-score for power = 0.8
  
  const effectSize = minimumDetectableEffect / baselineValue
  
  // Sample size per variant
  const n = Math.pow((zAlpha + zBeta) / effectSize, 2) * 2
  
  return Math.ceil(n)
}

