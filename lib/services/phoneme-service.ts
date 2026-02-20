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
    
    const mouthCues: MouthCue[] = [];
    let currentTime = 0;
    
    // Simple phoneme mapping based on common letter combinations
    const estimateWordPhonemes = (word: string): string[] => {
      const phonemes: string[] = [];
      const lower = word.toLowerCase();
      
      for (let i = 0; i < lower.length; i++) {
        const char = lower[i];
        const nextChar = lower[i + 1] || '';
        
        // Skip if already processed as digraph
        if (i > 0 && lower[i - 1] === 't' && char === 'h') continue;
        
        // Digraphs (two-letter combinations)
        if (char === 't' && nextChar === 'h') {
          phonemes.push('G'); // Tongue between teeth
          i++; // Skip next char
          continue;
        }
        
        // Consonants
        if ('mbp'.includes(char)) {
          phonemes.push('B'); // Lips together
        } else if ('fv'.includes(char)) {
          phonemes.push('F'); // Teeth on lip
        } else if ('wd'.includes(char)) {
          phonemes.push('D'); // Wide
        } else if ('lr'.includes(char)) {
          phonemes.push('C'); // Slightly open
        } else if ('sz'.includes(char)) {
          phonemes.push('H'); // Very open
        } else if ('aeiou'.includes(char)) {
          // Vowels
          if (char === 'a' || char === 'e') {
            phonemes.push('A'); // Open (ah/eh)
          } else if (char === 'o' || char === 'u') {
            phonemes.push('E'); // Rounded (oh/oo)
          } else if (char === 'i' || char === 'y') {
            phonemes.push('H'); // Very open (ee)
          }
        } else {
          // Other consonants - slight opening
          phonemes.push('C');
        }
      }
      
      // Ensure we have at least some movement
      if (phonemes.length === 0) {
        phonemes.push('A', 'X');
      }
      
      return phonemes;
    };
    
    const timePerWord = durationSeconds / words.length;
    
    words.forEach((word) => {
      const phonemes = estimateWordPhonemes(word);
      const timePerPhoneme = (timePerWord * 0.9) / Math.max(phonemes.length, 1);
      
      phonemes.forEach((phoneme) => {
        mouthCues.push({
          start: currentTime,
          end: currentTime + timePerPhoneme,
          value: phoneme
        });
        currentTime += timePerPhoneme;
      });
      
      // Add brief rest between words
      const pauseDuration = timePerWord * 0.1;
      mouthCues.push({
        start: currentTime,
        end: currentTime + pauseDuration,
        value: 'X'
      });
      currentTime += pauseDuration;
    });
    
    console.log(`Generated ${mouthCues.length} estimated mouth cues for "${text.slice(0, 50)}..."`);
    console.log('Sample cues:', mouthCues.slice(0, 10));
    
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
