/**
 * AudioManager - Handles Web Audio API operations for real-time audio playback
 * and synchronization with lip-sync animations
 */
export class AudioManager {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private startTime: number = 0;
  private isInitialized: boolean = false;
  
  /**
   * Initialize audio context (must be called after user interaction)
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    // AudioContext must be created after user gesture (browser requirement)
    this.audioContext = new AudioContext({ sampleRate: 24000 }); // Match OpenAI PCM
    this.isInitialized = true;
    
    console.log('AudioManager initialized, sample rate:', this.audioContext.sampleRate);
  }
  
  /**
   * Play PCM audio buffer
   * @param pcmData - Raw PCM audio data
   * @param onEnded - Optional callback fired when playback actually ends
   */
  async playPCM(pcmData: ArrayBuffer, onEnded?: () => void): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call init() first.');
    }
    
    // Resume context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    // Convert PCM to AudioBuffer
    const audioBuffer = await this.pcmToAudioBuffer(pcmData);
    
    // Stop any currently playing audio
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Already stopped
      }
    }
    
    // Create and configure source
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    // Clear currentSource when audio ends and fire callback
    source.onended = () => {
      if (this.currentSource === source) {
        this.currentSource = null;
        console.log('Audio playback ended');
      }
      onEnded?.();
    };
    
    // Start audio immediately — a non-zero delay creates a window where the
    // viseme animation runs but no audio plays, causing early-viseme drift.
    const scheduleDelay = 0.0;
    const scheduledStartTime = this.audioContext.currentTime + scheduleDelay;
    
    // Track timing for lip-sync synchronization (use scheduled time, not actual)
    this.startTime = scheduledStartTime;
    this.currentSource = source;
    source.start(scheduledStartTime);
    
    console.log(`Playing audio: ${audioBuffer.duration.toFixed(2)}s, Start time: ${this.startTime.toFixed(3)}s, Current time: ${this.audioContext.currentTime.toFixed(3)}s`);
  }
  
  /**
   * Get current playback time in seconds (for lip-sync synchronization).
   * Clamped to >= 0 so the brief schedule-delay window never yields negative time.
   */
  getCurrentTime(): number {
    if (!this.audioContext || !this.currentSource) return 0;
    return Math.max(0, this.audioContext.currentTime - this.startTime);
  }
  
  /**
   * Get audio context for advanced operations
   */
  getContext(): AudioContext | null {
    return this.audioContext;
  }
  
  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return this.currentSource !== null;
  }
  
  /**
   * Stop current playback
   */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.currentSource = null;
    }
  }
  
  /**
   * Convert 16-bit PCM to Web Audio API AudioBuffer
   * OpenAI returns: 16-bit signed PCM at 24kHz, mono
   */
  private async pcmToAudioBuffer(pcmData: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    
    // Ensure byte length is multiple of 2 (16-bit = 2 bytes per sample)
    let validData = pcmData;
    if (pcmData.byteLength % 2 !== 0) {
      console.warn(`PCM data has odd byte length (${pcmData.byteLength}), trimming last byte`);
      validData = pcmData.slice(0, pcmData.byteLength - 1);
    }
    
    // Convert 16-bit PCM to float32 array
    const pcm16 = new Int16Array(validData);
    const float32 = new Float32Array(pcm16.length);
    
    // Normalize 16-bit integers to [-1, 1] float range
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }
    
    // Create AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(
      1, // mono channel
      float32.length,
      24000 // sample rate (matches OpenAI)
    );
    
    // Copy data to buffer
    audioBuffer.getChannelData(0).set(float32);
    
    return audioBuffer;
  }
  
  /**
   * Concatenate multiple Uint8Array chunks into single ArrayBuffer
   */
  static concatenateChunks(chunks: Uint8Array[]): ArrayBuffer {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result.buffer;
  }
  
  /**
   * Estimate audio duration from PCM data
   */
  static estimateDuration(pcmData: ArrayBuffer, sampleRate: number = 24000): number {
    const samples = pcmData.byteLength / 2; // 16-bit = 2 bytes per sample
    return samples / sampleRate;
  }
  
  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isInitialized = false;
  }
}
