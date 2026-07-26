'use client'

import React, { useState } from 'react'
import { Button } from '@/components/core/ui/button'
import { BookA, BookmarkPlus, Check, Copy } from 'lucide-react'

interface AnswerActionButtonsProps {
  answer: string
  query?: string
  currentMedium?: string
  subject?: string
  classLevel?: string
  onVisualizationGenerated?: (viz: any) => void
  onButtonUsage?: (buttonType: string, metadata?: any) => void
}

export default function AnswerActionButtons({
  answer,
  query,
  currentMedium,
  subject,
  classLevel,
  onVisualizationGenerated,
  onButtonUsage
}: AnswerActionButtonsProps) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(answer)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (onButtonUsage) {
      onButtonUsage('copy', { length: answer.length })
    }
  }

  const handleWordMeaning = () => {
    if (onButtonUsage) {
      onButtonUsage('word_meaning', { query, subject })
    }
    // You can implement the actual logic here if needed or it will be handled by the parent
  }

  const handleAddToSanchika = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (onButtonUsage) {
      onButtonUsage('add_to_sanchika', { query, subject })
    }
    // Implement actual save logic if necessary
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={handleWordMeaning}
        className="text-xs bg-white/80 dark:bg-gray-800/80 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
      >
        <BookA className="h-3.5 w-3.5 mr-1.5" />
        Word Meaning
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAddToSanchika}
        className="text-xs bg-white/80 dark:bg-gray-800/80 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/30"
      >
        {saved ? (
          <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
        ) : (
          <BookmarkPlus className="h-3.5 w-3.5 mr-1.5" />
        )}
        {saved ? 'Saved!' : 'Add to Sanchika'}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="text-xs bg-white/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5 mr-1.5" />
        )}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
