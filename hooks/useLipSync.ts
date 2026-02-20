'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioManager } from '@/lib/audio/audio-manager';

export interface MouthCue {
  start: number;
  end: number;
  value: string;
}

export interface PhonemeData {
  mouthCues: MouthCue[];
}

/**
 * useLipSync Hook
 * 
 * Orchestrates the complete lip-sync pipeline:
 * 1. Request streaming TTS from OpenAI
 * 2. Start playback with text-based phoneme estimates (immediate)
 * 3. Background refinement with Rhubarb (cached for replays)
 * 4. Synchronize viseme updates with audio playback
 */
export function useLipSync() {
  const [currentViseme, setCurrentViseme] = useState<string>('X');
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  
  const audioManagerRef = useRef<AudioManager | null>(null);
  const phonemeDataRef = useRef<MouthCue[]>([]);
  const animationFrameRef = useRef<number>();
  const audioBufferRef = useRef<ArrayBuffer | null>(null);
  
  // Initialize audio manager
  useEffect(() => {
    audioManagerRef.current = new AudioManager();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audioManagerRef.current?.dispose();
    };
  }, []);
  
  /**
   * Update viseme based on current audio playback time
   */
  const updateViseme = useCallback(() => {
    if (!audioManagerRef.current || !isPlaying) return;
    
    const currentTime = audioManagerRef.current.getCurrentTime();
    
    // Find the mouth cue that matches current time
    const currentCue = phonemeDataRef.current.find(
      cue => currentTime >= cue.start && currentTime < cue.end
    );
    
    if (currentCue) {
      setCurrentViseme(currentCue.value);
    } else if (currentTime > 0) {
      // Default to closed mouth if no cue found
      setCurrentViseme('X');
    }
    
    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(updateViseme);
  }, [isPlaying]);
  
  // Start/stop animation loop when playing state changes
  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateViseme);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setCurrentViseme('X'); // Reset to rest position
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updateViseme]);
  
  /**
   * Main speak function - orchestrates the entire pipeline
   */
  const speak = async (text: string, voice: string = 'coral', speed: number = 1.0) => {
    if (!audioManagerRef.current) {
      setError('Audio manager not initialized');
      return;
    }
    
    setError(null);
    setIsPlaying(true);
    setProgress('Requesting speech...');
    
    try {
      // Initialize audio context (requires user interaction)
      await audioManagerRef.current.init();
      
      // Step 1: Request TTS audio stream
      setProgress('Streaming audio from OpenAI...');
      const ttsResponse = await fetch('/api/tts/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed })
      });
      
      if (!ttsResponse.ok) {
        const errorData = await ttsResponse.json();
        throw new Error(errorData.error || 'TTS request failed');
      }
      
      // Step 2: Collect audio chunks
      setProgress('Collecting audio...');
      const reader = ttsResponse.body?.getReader();
      if (!reader) throw new Error('No response body');
      
      const chunks: Uint8Array[] = [];
      let hasStartedPlayback = false;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        
        // Start playback after buffering 3 chunks (reduces stuttering)
        if (chunks.length === 3 && !hasStartedPlayback) {
          hasStartedPlayback = true;
          const bufferSoFar = AudioManager.concatenateChunks(chunks);
          
          // Get estimated phonemes for immediate playback
          const estimatedDuration = AudioManager.estimateDuration(bufferSoFar);
          await getEstimatedPhonemes(text, estimatedDuration);
          
          setProgress('Playing...');
          await audioManagerRef.current.playPCM(bufferSoFar);
        }
      }
      
      // Concatenate all chunks
      const fullAudioBuffer = AudioManager.concatenateChunks(chunks);
      audioBufferRef.current = fullAudioBuffer;
      
      // If we didn't start playback yet (audio was very short), play now
      if (!hasStartedPlayback) {
        const duration = AudioManager.estimateDuration(fullAudioBuffer);
        await getEstimatedPhonemes(text, duration);
        setProgress('Playing...');
        await audioManagerRef.current.playPCM(fullAudioBuffer);
      }
      
      // Step 3: Background refinement with Rhubarb
      setProgress('Refining lip-sync...');
      refinePhonemes(fullAudioBuffer, text);
      
      // Calculate duration and wait for playback to finish
      const durationMs = AudioManager.estimateDuration(fullAudioBuffer) * 1000;
      setTimeout(() => {
        setIsPlaying(false);
        setProgress('');
      }, durationMs);
      
    } catch (err) {
      console.error('Speak error:', err);
      setError(err instanceof Error ? err.message : 'Failed to speak');
      setIsPlaying(false);
      setProgress('');
    }
  };
  
  /**
   * Get estimated phonemes from text (fast, for immediate playback)
   */
  const getEstimatedPhonemes = async (text: string, duration: number) => {
    try {
      const response = await fetch('/api/phonemes/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, duration })
      });
      
      if (response.ok) {
        const data: PhonemeData = await response.json();
        phonemeDataRef.current = data.mouthCues;
        console.log('Using estimated phonemes:', data.mouthCues.length, 'cues');
      }
    } catch (err) {
      console.warn('Failed to get estimated phonemes:', err);
    }
  };
  
  /**
   * Refine phonemes with Rhubarb (background process)
   */
  const refinePhonemes = async (audioBuffer: ArrayBuffer, text: string) => {
    try {
      // Convert ArrayBuffer to base64
      const uint8Array = new Uint8Array(audioBuffer);
      const base64Audio = btoa(String.fromCharCode(...uint8Array));
      
      const response = await fetch('/api/phonemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          audioBase64: base64Audio, 
          transcript: text 
        })
      });
      
      if (response.ok) {
        const refinedData: PhonemeData = await response.json();
        phonemeDataRef.current = refinedData.mouthCues;
        console.log('Phonemes refined with Rhubarb:', refinedData.mouthCues.length, 'cues');
        setProgress('High-quality lip-sync active');
        
        // Clear progress message after 2 seconds
        setTimeout(() => setProgress(''), 2000);
      }
    } catch (err) {
      console.warn('Failed to refine phonemes (continuing with estimates):', err);
    }
  };
  
  /**
   * Stop current playback
   */
  const stop = () => {
    audioManagerRef.current?.stop();
    setIsPlaying(false);
    setCurrentViseme('X');
    setProgress('');
  };
  
  /**
   * Replay last audio with cached phonemes
   */
  const replay = async () => {
    if (!audioBufferRef.current || !audioManagerRef.current) {
      setError('No audio to replay');
      return;
    }
    
    setError(null);
    setIsPlaying(true);
    setProgress('Replaying...');
    
    try {
      await audioManagerRef.current.init();
      await audioManagerRef.current.playPCM(audioBufferRef.current);
      
      const durationMs = AudioManager.estimateDuration(audioBufferRef.current) * 1000;
      setTimeout(() => {
        setIsPlaying(false);
        setProgress('');
      }, durationMs);
    } catch (err) {
      console.error('Replay error:', err);
      setError(err instanceof Error ? err.message : 'Failed to replay');
      setIsPlaying(false);
      setProgress('');
    }
  };
  
  return {
    currentViseme,
    isPlaying,
    error,
    progress,
    speak,
    stop,
    replay,
    hasAudio: audioBufferRef.current !== null
  };
}
