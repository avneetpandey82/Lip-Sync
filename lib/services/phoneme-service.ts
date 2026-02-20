import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';

export interface MouthCue {
  start: number; // seconds
  end: number;
  value: string; // Viseme: A, B, C, D, E, F, G, H, X
}

export interface PhonemeData {
  mouthCues: MouthCue[];
  metadata?: {
    duration: number;
    soundFile: string;
  };
}

export class PhonemeService {
  private cache = new Map<string, PhonemeData>();
  private rhubarbPath: string;
  
  constructor() {
    // Detect platform and set appropriate binary path
    const isWindows = os.platform() === 'win32';
    const binName = isWindows ? 'rhubarb.exe' : 'rhubarb';
    this.rhubarbPath = path.join(process.cwd(), 'lib', 'rhubarb', binName);
  }
  
  /**
   * Extract phonemes from audio using Rhubarb Lip Sync
   * @param audioBuffer - Audio data as Buffer
   * @param transcript - Optional text transcript (improves accuracy significantly)
   * @returns PhonemeData with mouth cues
   */
  async extractPhonemes(
    audioBuffer: Buffer,
    transcript: string
  ): Promise<PhonemeData> {
    const cacheKey = this.getCacheKey(audioBuffer, transcript);
    
    if (this.cache.has(cacheKey)) {
      console.log('Phoneme cache hit');
      return this.cache.get(cacheKey)!;
    }
    
    const result = await this.runRhubarb(audioBuffer, transcript);
    this.cache.set(cacheKey, result);
    
    // Cleanup old cache entries (keep last 100)
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    return result;
  }
  
  /**
   * Run Rhubarb as child process
   */
  private async runRhubarb(audioBuffer: Buffer, transcript: string): Promise<PhonemeData> {
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `audio-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    
    try {
      // Write audio to temp file
      await writeFile(tempFile, audioBuffer);
      
      return new Promise((resolve, reject) => {
        const args = [
          '-f', 'json',
          '--extendedShapes', 'GHX', // 9 visemes (default 8 + extended)
          tempFile
        ];
        
        // Add transcript if provided (significantly improves accuracy)
        if (transcript && transcript.trim().length > 0) {
          args.push('-d', transcript);
        }
        
        console.log(`Running Rhubarb: ${this.rhubarbPath} ${args.join(' ')}`);
        const proc = spawn(this.rhubarbPath, args);
        
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', chunk => {
          stdout += chunk.toString();
        });
        
        proc.stderr.on('data', chunk => {
          stderr += chunk.toString();
        });
        
        proc.on('close', async (code) => {
          // Cleanup temp file
          try {
            await unlink(tempFile);
          } catch (err) {
            console.warn('Failed to cleanup temp file:', err);
          }
          
          if (code === 0) {
            try {
              const parsed = JSON.parse(stdout);
              resolve(parsed);
            } catch (err) {
              reject(new Error(`Failed to parse Rhubarb output: ${err}`));
            }
          } else {
            reject(new Error(`Rhubarb exited with code ${code}: ${stderr}`));
          }
        });
        
        proc.on('error', (err) => {
          reject(new Error(`Rhubarb spawn error: ${err.message}`));
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
          proc.kill();
          reject(new Error('Rhubarb timeout after 30 seconds'));
        }, 30000);
      });
    } catch (error) {
      // Cleanup on error
      try {
        await unlink(tempFile);
      } catch {}
      throw new Error(`Phoneme extraction failed: ${error}`);
    }
  }
  
  /**
   * Fallback: Estimate phonemes from text and duration
   * Used for immediate playback before Rhubarb analysis
   */
  estimateFromText(text: string, durationSeconds: number): PhonemeData {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 0) {
      return { mouthCues: [{ start: 0, end: durationSeconds, value: 'X' }] };
    }
    
    const secondsPerWord = durationSeconds / words.length;
    const mouthCues: MouthCue[] = [];
    
    // Simple alternating pattern for basic talking motion
    words.forEach((word, i) => {
      const start = i * secondsPerWord;
      const mid = start + secondsPerWord * 0.5;
      const end = (i + 1) * secondsPerWord;
      
      // Alternate between open (A) and closed (X) for visual feedback
      mouthCues.push(
        { start, end: mid, value: 'A' },
        { start: mid, end, value: 'X' }
      );
    });
    
    return { mouthCues };
  }
  
  /**
   * Generate cache key from audio and transcript
   */
  private getCacheKey(audioBuffer: Buffer, transcript: string): string {
    return createHash('md5')
      .update(audioBuffer)
      .update(transcript)
      .digest('hex');
  }
  
  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

// Singleton instance
let phonemeServiceInstance: PhonemeService | null = null;

export function getPhonemeService(): PhonemeService {
  if (!phonemeServiceInstance) {
    phonemeServiceInstance = new PhonemeService();
  }
  return phonemeServiceInstance;
}
