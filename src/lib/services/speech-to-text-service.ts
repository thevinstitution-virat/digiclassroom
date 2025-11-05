'use client'

export interface SpeechToTextResult {
  transcript: string
  confidence: number
  isFinal: boolean
  alternatives?: Array<{
    transcript: string
    confidence: number
  }>
}

export interface SpeechToTextOptions {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
  onResult?: (result: SpeechToTextResult) => void
  onError?: (error: string) => void
  onStart?: () => void
  onEnd?: () => void
}

export class SpeechToTextService {
  private static instance: SpeechToTextService
  private recognition: SpeechRecognition | null = null
  private isListening = false
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []

  private constructor() {}

  public static getInstance(): SpeechToTextService {
    if (!SpeechToTextService.instance) {
      SpeechToTextService.instance = new SpeechToTextService()
    }
    return SpeechToTextService.instance
  }

  // Check if speech recognition is supported
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 
           ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  }

  // Check if media recording is supported
  static isMediaRecorderSupported(): boolean {
    return typeof window !== 'undefined' && 'MediaRecorder' in window
  }

  // Initialize Web Speech API
  private initializeWebSpeechAPI(options: SpeechToTextOptions): SpeechRecognition {
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = options.continuous ?? true
    recognition.interimResults = options.interimResults ?? true
    recognition.lang = options.language ?? 'en-US'
    recognition.maxAlternatives = options.maxAlternatives ?? 3

    recognition.onstart = () => {
      this.isListening = true
      options.onStart?.()
    }

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        const confidence = result[0].confidence

        const alternatives = Array.from(result).map(alt => ({
          transcript: alt.transcript,
          confidence: alt.confidence
        }))

        options.onResult?.({
          transcript,
          confidence,
          isFinal: result.isFinal,
          alternatives
        })
      }
    }

    recognition.onerror = (event) => {
      let errorMessage = 'Speech recognition error'
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try speaking again.'
          break
        case 'audio-capture':
          errorMessage = 'Audio capture failed. Please check your microphone.'
          break
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone permissions.'
          break
        case 'network':
          errorMessage = 'Network error. Please check your internet connection.'
          break
        case 'service-not-allowed':
          errorMessage = 'Speech recognition service not allowed.'
          break
        default:
          errorMessage = `Speech recognition error: ${event.error}`
      }

      options.onError?.(errorMessage)
    }

    recognition.onend = () => {
      this.isListening = false
      options.onEnd?.()
    }

    return recognition
  }

  // Start real-time speech recognition
  async startListening(options: SpeechToTextOptions = {}): Promise<void> {
    if (!SpeechToTextService.isSupported()) {
      throw new Error('Speech recognition is not supported in this browser')
    }

    if (this.isListening) {
      throw new Error('Speech recognition is already active')
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true })

      this.recognition = this.initializeWebSpeechAPI(options)
      this.recognition.start()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start speech recognition'
      options.onError?.(errorMessage)
      throw new Error(errorMessage)
    }
  }

  // Stop speech recognition
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
    }
  }

  // Process audio file using server-side API
  async processAudioFile(
    audioBlob: Blob,
    options: { language?: string } = {}
  ): Promise<SpeechToTextResult> {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.wav')
      formData.append('language', options.language ?? 'en-US')

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const result = await response.json()
      return result

    } catch (error) {
      console.error('Audio processing error:', error)
      throw new Error('Failed to process audio file')
    }
  }

  // Record audio and convert to text
  async recordAndTranscribe(options: SpeechToTextOptions = {}): Promise<SpeechToTextResult> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!SpeechToTextService.isMediaRecorderSupported()) {
          throw new Error('Audio recording is not supported in this browser')
        }

        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          }
        })

        this.audioChunks = []
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        })

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data)
          }
        }

        this.mediaRecorder.onstop = async () => {
          try {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop())

            // Process the recorded audio
            const result = await this.processAudioFile(audioBlob, {
              language: options.language
            })

            resolve(result)

          } catch (error) {
            reject(error)
          }
        }

        this.mediaRecorder.onerror = (event) => {
          reject(new Error('Recording failed'))
        }

        // Start recording
        this.mediaRecorder.start()
        options.onStart?.()

        // Auto-stop after 30 seconds (configurable)
        setTimeout(() => {
          if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop()
          }
        }, 30000)

      } catch (error) {
        reject(error)
      }
    })
  }

  // Stop recording
  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop()
    }
  }

  // Get available languages
  getSupportedLanguages(): Array<{ code: string; name: string }> {
    return [
      { code: 'en-US', name: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'es-ES', name: 'Spanish (Spain)' },
      { code: 'es-MX', name: 'Spanish (Mexico)' },
      { code: 'fr-FR', name: 'French' },
      { code: 'de-DE', name: 'German' },
      { code: 'it-IT', name: 'Italian' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)' },
      { code: 'ru-RU', name: 'Russian' },
      { code: 'zh-CN', name: 'Chinese (Mandarin)' },
      { code: 'ja-JP', name: 'Japanese' },
      { code: 'ko-KR', name: 'Korean' },
      { code: 'ar-SA', name: 'Arabic' },
      { code: 'hi-IN', name: 'Hindi' },
    ]
  }

  // Check current status
  isCurrentlyListening(): boolean {
    return this.isListening
  }

  // Cleanup resources
  cleanup(): void {
    this.stopListening()
    this.stopRecording()
    this.recognition = null
    this.mediaRecorder = null
    this.audioChunks = []
  }
}

// Export singleton instance
export const speechToTextService = SpeechToTextService.getInstance()

// Type declarations for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition
    SpeechRecognition: typeof SpeechRecognition
  }
}
