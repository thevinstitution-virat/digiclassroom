'use client'

// Enhanced Voice Processing Service with Multi-language Support
export interface VoiceLanguage {
  code: string
  name: string
  flag: string
  whisperCode: string
  speechSynthesisCode: string
}

export interface VoiceCommand {
  command: string
  variations: string[]
  action: string
  description: string
}

export interface VoiceProcessingOptions {
  language: string
  enableNoiseReduction: boolean
  enableVolumeNormalization: boolean
  enableVoiceActivityDetection: boolean
  maxRecordingDuration: number
  chunkSize: number
}

export interface VoiceProcessingResult {
  transcript: string
  language: string
  confidence: number
  duration: number
  voiceCommand?: VoiceCommand
  audioQuality: {
    noiseLevel: number
    volumeLevel: number
    clarity: number
  }
}

export class EnhancedVoiceService {
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private microphone: MediaStreamAudioSourceNode | null = null
  private isRecording = false
  private audioChunks: Blob[] = []
  private vadThreshold = 0.01
  private silenceTimeout: NodeJS.Timeout | null = null

  // Supported languages for educational content
  public readonly supportedLanguages: VoiceLanguage[] = [
    {
      code: 'en-US',
      name: 'English (US)',
      flag: '🇺🇸',
      whisperCode: 'en',
      speechSynthesisCode: 'en-US'
    },
    {
      code: 'hi-IN',
      name: 'हिंदी (Hindi)',
      flag: '🇮🇳',
      whisperCode: 'hi',
      speechSynthesisCode: 'hi-IN'
    },
    {
      code: 'es-ES',
      name: 'Español (Spanish)',
      flag: '🇪🇸',
      whisperCode: 'es',
      speechSynthesisCode: 'es-ES'
    }
  ]

  // Educational voice commands
  public readonly voiceCommands: VoiceCommand[] = [
    {
      command: 'repeat',
      variations: ['repeat that', 'say that again', 'repeat please', 'फिर से कहो', 'repite'],
      action: 'repeat_last_response',
      description: 'Repeat the last AI response'
    },
    {
      command: 'explain',
      variations: ['explain more', 'explain in detail', 'elaborate', 'समझाओ', 'explica más'],
      action: 'explain_more',
      description: 'Get a more detailed explanation'
    },
    {
      command: 'example',
      variations: ['give example', 'show example', 'provide example', 'उदाहरण दो', 'da un ejemplo'],
      action: 'provide_example',
      description: 'Request an example'
    },
    {
      command: 'simplify',
      variations: ['make it simple', 'simplify this', 'explain simply', 'आसान भाषा में', 'simplifica'],
      action: 'simplify_explanation',
      description: 'Get a simpler explanation'
    },
    {
      command: 'next',
      variations: ['next topic', 'move on', 'continue', 'आगे बढ़ो', 'siguiente'],
      action: 'next_topic',
      description: 'Move to the next topic'
    }
  ]

  // Initialize audio context and setup
  async initialize(): Promise<boolean> {
    try {
      // Check for browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported')
      }

      // Initialize Web Audio API
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      console.log('🎤 Enhanced voice service initialized')
      return true
    } catch (error) {
      console.error('❌ Failed to initialize voice service:', error)
      return false
    }
  }

  // Detect language from audio content
  async detectLanguage(audioBlob: Blob): Promise<string> {
    try {
      // For now, we'll use a simple heuristic based on audio characteristics
      // In production, this could use a language detection service
      
      // Default to English for now, but this could be enhanced with:
      // - Audio frequency analysis for language-specific patterns
      // - Integration with language detection APIs
      // - User preference learning
      
      return 'en-US'
    } catch (error) {
      console.error('❌ Language detection failed:', error)
      return 'en-US'
    }
  }

  // Setup voice activity detection
  private setupVoiceActivityDetection(stream: MediaStream): void {
    if (!this.audioContext) return

    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.8

    this.microphone = this.audioContext.createMediaStreamSource(stream)
    this.microphone.connect(this.analyser)

    console.log('🔊 Voice activity detection enabled')
  }

  // Get current voice activity level
  getVoiceActivityLevel(): number {
    if (!this.analyser)
  return 0

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteFrequencyData(dataArray)

    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i]
    }

    const average = sum / bufferLength
    return average / 255 // Normalize to 0-1
  }

  // Check if voice command is detected
  detectVoiceCommand(transcript: string): VoiceCommand | null {
    const normalizedTranscript = transcript.toLowerCase().trim()

    for (const command of this.voiceCommands) {
      for (const variation of command.variations) {
        if (normalizedTranscript.includes(variation.toLowerCase())) {
          console.log(`🎯 Voice command detected: ${command.command}`)
          return command
        }
      }
    }

    return null
  }

  // Start recording with enhanced features
  async startRecording(options: Partial<VoiceProcessingOptions> = {}): Promise<boolean> {
    try {
      const defaultOptions: VoiceProcessingOptions = {
        language: 'en-US',
        enableNoiseReduction: true,
        enableVolumeNormalization: true,
        enableVoiceActivityDetection: true,
        maxRecordingDuration: 300000, // 5 minutes
        chunkSize: 1024
      }

      const finalOptions = { ...defaultOptions, ...options }

      // Request microphone access with enhanced constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: finalOptions.enableNoiseReduction,
          autoGainControl: finalOptions.enableVolumeNormalization,
          sampleRate: 44100,
          channelCount: 1
        }
      })

      // Setup voice activity detection
      if (finalOptions.enableVoiceActivityDetection) {
        this.setupVoiceActivityDetection(stream)
      }

      // Create media recorder with optimal settings
      const mimeType = this.getBestMimeType()
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      })

      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.start(finalOptions.chunkSize)
      this.isRecording = true

      // Auto-stop after max duration
      setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording()
        }
      }, finalOptions.maxRecordingDuration)

      console.log('🎤 Enhanced recording started with options:', finalOptions)
      return true

    } catch (error) {
      console.error('❌ Failed to start recording:', error)
      return false
    }
  }

  // Stop recording and return audio blob
  async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null)
        return
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { 
          type: this.mediaRecorder?.mimeType || 'audio/webm' 
        })
        
        // Cleanup
        this.cleanup()
        
        console.log('🎤 Recording stopped, audio blob created:', audioBlob.size, 'bytes')
        resolve(audioBlob)
      }

      this.mediaRecorder.stop()
      this.isRecording = false
    })
  }

  // Get best supported MIME type for recording
  private getBestMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav'
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    return 'audio/webm' // Fallback
  }

  // Process audio with enhanced features
  async processAudio(audioBlob: Blob, options: Partial<VoiceProcessingOptions> = {}): Promise<VoiceProcessingResult> {
    try {
      console.log('🔄 Processing audio with enhanced features...')

      // Detect language if not specified
      const language = options.language || await this.detectLanguage(audioBlob)

      // Send to speech-to-text API
      const formData = new FormData()
      formData.append('audio', audioBlob)
      formData.append('language', language)
      formData.append('options', JSON.stringify(options))

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Speech-to-text API error: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Speech processing failed')
      }

      // Detect voice commands
      const voiceCommand = this.detectVoiceCommand(result.data.transcript)

      // Analyze audio quality (simulated for now)
      const audioQuality = {
        noiseLevel: Math.random() * 0.3, // 0-1, lower is better
        volumeLevel: 0.7 + Math.random() * 0.3, // 0-1, optimal around 0.8
        clarity: 0.8 + Math.random() * 0.2 // 0-1, higher is better
      }

      const processedResult: VoiceProcessingResult = {
        transcript: result.data.transcript,
        language,
        confidence: result.data.confidence,
        duration: result.data.duration,
        voiceCommand,
        audioQuality
      }

      console.log('✅ Audio processing complete:', processedResult)
      return processedResult

    } catch (error) {
      console.error('❌ Audio processing failed:', error)
      throw error
    }
  }

  // Text-to-speech functionality
  async speakText(text: string, language: string = 'en-US'): Promise<boolean> {
    try {
      if (!('speechSynthesis' in window)) {
        console.warn('⚠️ Speech synthesis not supported')
        return false
      }

      // Cancel any ongoing speech
      speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      
      // Find appropriate voice for language
      const voices = speechSynthesis.getVoices()
      const languageVoice = voices.find(voice => 
        voice.lang.startsWith(language.split('-')[0])
      )

      if (languageVoice) {
        utterance.voice = languageVoice
      }

      utterance.lang = language
      utterance.rate = 0.9
      utterance.pitch = 1.0
      utterance.volume = 0.8

      return new Promise((resolve) => {
        utterance.onend = () => {
          console.log('🔊 Text-to-speech completed')
          resolve(true)
        }

        utterance.onerror = (error) => {
          console.error('❌ Text-to-speech error:', error)
          resolve(false)
        }

        speechSynthesis.speak(utterance)
      })

    } catch (error) {
      console.error('❌ Text-to-speech failed:', error)
      return false
    }
  }

  // Cleanup resources
  private cleanup(): void {
    if (this.mediaRecorder?.stream) {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
    }

    if (this.microphone) {
      this.microphone.disconnect()
      this.microphone = null
    }

    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }

    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout)
      this.silenceTimeout = null
    }

    this.audioChunks = []
    console.log('🧹 Voice service cleanup completed')
  }

  // Check if currently recording
  isCurrentlyRecording(): boolean {
    return this.isRecording
  }

  // Get supported languages
  getSupportedLanguages(): VoiceLanguage[] {
    return this.supportedLanguages
  }

  // Get available voice commands
  getVoiceCommands(): VoiceCommand[] {
    return this.voiceCommands
  }
}

// Export singleton instance
export const enhancedVoiceService = new EnhancedVoiceService()
