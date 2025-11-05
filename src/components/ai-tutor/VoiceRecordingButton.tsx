'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Square, Loader2, Send, Trash2, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export type VoiceRecordingState = 'idle' | 'recording' | 'processing' | 'recorded' | 'error'

interface VoiceRecordingButtonProps {
  onRecordingComplete: (audioBlob: Blob) => void
  onTranscriptionResult?: (text: string) => void
  onError?: (error: string) => void
  onRecordingCancel?: () => void
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showVisualizer?: boolean
  maxDuration?: number // in seconds
  longPressDelay?: number // milliseconds to trigger long press
  slideThreshold?: number // pixels to slide for cancel
}

export function VoiceRecordingButton({
  onRecordingComplete,
  onTranscriptionResult,
  onError,
  onRecordingCancel,
  disabled = false,
  className,
  size = 'md',
  showVisualizer = true,
  maxDuration = 60,
  longPressDelay = 500,
  slideThreshold = 100
}: VoiceRecordingButtonProps) {
  const [state, setState] = useState<VoiceRecordingState>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [isLongPress, setIsLongPress] = useState(false)
  const [slideDistance, setSlideDistance] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const analyzerRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const startPositionRef = useRef<{ x: number; y: number } | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
      if (timerRef.current) clearInterval(timerRef.current)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    }
  }, [])

  // WhatsApp-style long press handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || state === 'processing') return

    e.preventDefault()
    startPositionRef.current = { x: e.clientX, y: e.clientY }

    longPressTimerRef.current = setTimeout(() => {
      setIsLongPress(true)
      startRecording()
    }, longPressDelay)
  }, [disabled, state, longPressDelay])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    if (isLongPress && state === 'recording') {
      // Check if user slid away to cancel
      if (startPositionRef.current) {
        const distance = Math.sqrt(
          Math.pow(e.clientX - startPositionRef.current.x, 2) +
          Math.pow(e.clientY - startPositionRef.current.y, 2)
        )

        if (distance > slideThreshold) {
          // Cancel recording
          cancelRecording()
          return
        }
      }

      // Complete recording
      stopRecording()
    }

    setIsLongPress(false)
    setSlideDistance(0)
    startPositionRef.current = null
  }, [isLongPress, state, slideThreshold])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isLongPress && startPositionRef.current) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - startPositionRef.current.x, 2) +
        Math.pow(e.clientY - startPositionRef.current.y, 2)
      )
      setSlideDistance(distance)
    }
  }, [isLongPress])

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || state === 'processing') return

    e.preventDefault()
    const touch = e.touches[0]
    startPositionRef.current = { x: touch.clientX, y: touch.clientY }

    longPressTimerRef.current = setTimeout(() => {
      setIsLongPress(true)
      startRecording()
    }, longPressDelay)
  }, [disabled, state, longPressDelay])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    if (isLongPress && state === 'recording') {
      // Check if user slid away to cancel
      if (startPositionRef.current && e.changedTouches[0]) {
        const touch = e.changedTouches[0]
        const distance = Math.sqrt(
          Math.pow(touch.clientX - startPositionRef.current.x, 2) +
          Math.pow(touch.clientY - startPositionRef.current.y, 2)
        )

        if (distance > slideThreshold) {
          // Cancel recording
          cancelRecording()
          return
        }
      }

      // Complete recording
      stopRecording()
    }

    setIsLongPress(false)
    setSlideDistance(0)
    startPositionRef.current = null
  }, [isLongPress, state, slideThreshold])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isLongPress && startPositionRef.current && e.touches[0]) {
      const touch = e.touches[0]
      const distance = Math.sqrt(
        Math.pow(touch.clientX - startPositionRef.current.x, 2) +
        Math.pow(touch.clientY - startPositionRef.current.y, 2)
      )
      setSlideDistance(distance)
    }
  }, [isLongPress])

  const startRecording = async () => {
    try {
      setState('recording')
      setRecordingTime(0)
      audioChunksRef.current = []

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })

      streamRef.current = stream

      // Setup audio visualization
      if (showVisualizer) {
        setupAudioVisualization(stream)
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setRecordedBlob(audioBlob)
        setState('recorded')
        cleanup()
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        onError?.('Recording failed')
        setState('error')
        cleanup()
      }

      // Start recording
      mediaRecorder.start(100) // Collect data every 100ms

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          if (newTime >= maxDuration) {
            stopRecording()
          }
          return newTime
        })
      }, 1000)

    } catch (error) {
      console.error('Failed to start recording:', error)
      onError?.('Microphone access denied or not available')
      setState('error')
      setTimeout(() => setState('idle'), 2000)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    setState('idle')
    setRecordedBlob(null)
    cleanup()
    onRecordingCancel?.()
  }

  const handleSendRecording = async () => {
    if (!recordedBlob) return

    setState('processing')

    try {
      onRecordingComplete(recordedBlob)

      // Process transcription if callback provided
      if (onTranscriptionResult) {
        await processTranscription(recordedBlob)
      }
    } catch (error) {
      console.error('Recording processing failed:', error)
      onError?.('Recording processing failed')
      setState('error')
      setTimeout(() => setState('idle'), 2000)
      return
    }

    setState('idle')
    setRecordedBlob(null)
  }

  const handleDeleteRecording = () => {
    setState('idle')
    setRecordedBlob(null)
    onRecordingCancel?.()
  }

  const setupAudioVisualization = (stream: MediaStream) => {
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyzer = audioContext.createAnalyser()
    
    analyzer.fftSize = 256
    source.connect(analyzer)
    analyzerRef.current = analyzer

    const updateAudioLevel = () => {
      if (analyzer && state === 'recording') {
        const dataArray = new Uint8Array(analyzer.frequencyBinCount)
        analyzer.getByteFrequencyData(dataArray)
        
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
        setAudioLevel(average / 255) // Normalize to 0-1
        
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
      }
    }
    
    updateAudioLevel()
  }

  const processTranscription = async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('language', 'auto') // Auto-detect Hindi and English

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success && result.data?.text) {
        onTranscriptionResult?.(result.data.text)
      } else {
        throw new Error(result.error || 'No transcription result')
      }
    } catch (error) {
      console.error('Transcription error:', error)
      throw error
    }
  }

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    setAudioLevel(0)
    setRecordingTime(0)
  }

  // Prevent default click behavior for WhatsApp-style interaction
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    // Only handle clicks in recorded state for send/delete actions
    if (state !== 'recorded') return
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getButtonSize = () => {
    switch (size) {
      case 'sm': return 'h-9 w-9'
      case 'lg': return 'h-14 w-14'
      default: return 'h-11 w-11'
    }
  }

  const getIconSize = () => {
    switch (size) {
      case 'sm': return 'h-4 w-4'
      case 'lg': return 'h-6 w-6'
      default: return 'h-5 w-5'
    }
  }

  // Show post-recording options
  if (state === 'recorded') {
    return (
      <div className="flex items-center space-x-2">
        {/* Delete Recording Button */}
        <Button
          onClick={handleDeleteRecording}
          disabled={disabled}
          className={cn(
            getButtonSize(),
            'p-0 rounded-xl bg-red-500 hover:bg-red-600 border-red-400 shadow-md hover:shadow-lg transition-all duration-200',
            className
          )}
        >
          <Trash2 className={cn(getIconSize(), 'text-white')} />
        </Button>

        {/* Send Recording Button */}
        <Button
          onClick={handleSendRecording}
          disabled={disabled}
          className={cn(
            getButtonSize(),
            'p-0 rounded-xl bg-gradient-to-r from-green-500 to-green-600 border-green-400 shadow-md hover:shadow-lg transition-all duration-200',
            className
          )}
        >
          <Send className={cn(getIconSize(), 'text-white')} />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative flex items-center space-x-2">
      {/* Recording Button */}
      <Button
        ref={buttonRef}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        disabled={disabled || state === 'processing'}
        className={cn(
          getButtonSize(),
          'p-0 rounded-xl relative overflow-hidden transition-all duration-200 select-none',
          state === 'idle' && 'bg-white/90 border-orange-200/60 hover:border-blue-400 backdrop-blur-sm shadow-sm hover:shadow-md',
          state === 'recording' && 'bg-gradient-to-r from-red-500 to-red-600 border-red-400 shadow-lg',
          state === 'processing' && 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-400',
          state === 'error' && 'bg-gradient-to-r from-red-500 to-red-600 border-red-400',
          slideDistance > slideThreshold / 2 && state === 'recording' && 'bg-gray-400',
          className
        )}
        variant="outline"
      >
        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Mic className={cn(getIconSize(), 'text-gray-600')} />
            </motion.div>
          )}

          {state === 'recording' && (
            <motion.div
              key="recording"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: slideDistance > slideThreshold / 2 ? 0.9 : 1,
                opacity: slideDistance > slideThreshold / 2 ? 0.6 : 1
              }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {slideDistance > slideThreshold / 2 ? (
                <X className={cn(getIconSize(), 'text-white')} />
              ) : (
                <Mic className={cn(getIconSize(), 'text-white')} />
              )}
            </motion.div>
          )}

          {state === 'processing' && (
            <motion.div
              key="processing"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Loader2 className={cn(getIconSize(), 'text-white animate-spin')} />
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div
              key="error"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MicOff className={cn(getIconSize(), 'text-white')} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audio Level Visualizer */}
        {showVisualizer && state === 'recording' && (
          <motion.div
            className="absolute inset-0 bg-white/20 rounded-xl"
            initial={{ scale: 1 }}
            animate={{ 
              scale: 1 + (audioLevel * 0.3),
              opacity: 0.6 + (audioLevel * 0.4)
            }}
            transition={{ duration: 0.1 }}
          />
        )}
      </Button>

      {/* Recording Timer and Slide Indicator */}
      <AnimatePresence>
        {state === 'recording' && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex items-center space-x-2"
          >
            <div className="text-sm font-mono text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-200">
              {formatTime(recordingTime)}
            </div>

            {slideDistance > slideThreshold / 4 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "text-xs px-2 py-1 rounded-md transition-colors duration-200",
                  slideDistance > slideThreshold / 2
                    ? "bg-red-100 text-red-700 border border-red-300"
                    : "bg-yellow-100 text-yellow-700 border border-yellow-300"
                )}
              >
                {slideDistance > slideThreshold / 2 ? "Release to cancel" : "Slide to cancel"}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing Indicator */}
      <AnimatePresence>
        {state === 'processing' && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200"
          >
            Processing...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
