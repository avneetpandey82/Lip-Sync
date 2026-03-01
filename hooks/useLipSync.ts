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
  const [nextViseme,    setNextViseme]    = useState<string>('X');
  const [isPlaying,     setIsPlaying]     = useState(false);
  // isFetching: true while TTS + phoneme data is being prepared (before audio starts)
  const [isFetching,    setIsFetching]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [progress,      setProgress]      = useState<string>('');
  // Reactive hasAudio so the Replay button renders as soon as audio is ready
  const [hasAudio,      setHasAudio]      = useState(false);

  const audioManagerRef = useRef<AudioManager | null>(null);
  const phonemeDataRef  = useRef<MouthCue[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const audioBufferRef  = useRef<ArrayBuffer | null>(null);

  // Refs that mirror state — read inside the rAF callback to avoid stale closures.
  const isPlayingRef     = useRef(false);
  const currentVisemeRef = useRef('X');
  const nextVisemeRef    = useRef('X');

  // Keep refs in sync with state
  useEffect(() => { isPlayingRef.current  = isPlaying;     }, [isPlaying]);
  useEffect(() => { currentVisemeRef.current = currentViseme; }, [currentViseme]);
  useEffect(() => { nextVisemeRef.current    = nextViseme;    }, [nextViseme]);
  
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
   * Update viseme based on current audio playback time.
   *
   * IMPORTANT: This callback has NO state dependencies — it reads live values
   * from refs. This prevents the classic React rAF race condition where each
   * state change creates a new callback reference, triggering the useEffect to
   * cancel + restart the loop while the old callback also queues a new frame,
   * resulting in multiple competing animation loops.
   */
  const updateViseme = useCallback(() => {
    // Stop loop if no longer playing (checked via ref, not stale state)
    if (!audioManagerRef.current || !isPlayingRef.current) return;
    
    const currentTime = audioManagerRef.current.getCurrentTime();
    
    // Find the mouth cue that matches current time
    const currentCue = phonemeDataRef.current.find(
      cue => currentTime >= cue.start && currentTime < cue.end
    );
    
    if (currentCue) {
      if (currentCue.value !== currentVisemeRef.current) {
        console.log(`[Lip Sync] Time: ${currentTime.toFixed(3)}s -> Viseme: ${currentCue.value} (${currentCue.start.toFixed(3)}s - ${currentCue.end.toFixed(3)}s)`);
        currentVisemeRef.current = currentCue.value;
        setCurrentViseme(currentCue.value);
      }
    } else if (currentTime > 0) {
      if (currentVisemeRef.current !== 'X') {
        currentVisemeRef.current = 'X';
        setCurrentViseme('X');
      }
    }

    // Look-ahead: find the next cue starting within 50 ms
    // Smaller window avoids anticipating visemes too early at natural speech rate.
    const LOOK_AHEAD_S = 0.05;
    const nextCue = phonemeDataRef.current.find(
      (cue) => cue.start > currentTime && cue.start <= currentTime + LOOK_AHEAD_S
    );
    const nextVal = nextCue?.value ?? 'X';
    if (nextVal !== nextVisemeRef.current) {
      nextVisemeRef.current = nextVal;
      setNextViseme(nextVal);
    }
    
    // Continue animation loop (only if still playing)
    if (isPlayingRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateViseme);
    }
  }, []); // Stable — no deps, reads live values from refs
  
  // Start/stop animation loop when playing state changes
  useEffect(() => {
    if (isPlaying) {
      // Cancel any stale frame before starting fresh
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateViseme);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      currentVisemeRef.current = 'X';
      setCurrentViseme('X'); // Reset to rest position
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
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
    // isFetching = true blocks the UI (disables textarea/button) while we prepare audio,
    // but does NOT start the rAF viseme loop — that only starts when isPlaying = true.
    setIsFetching(true);
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
      
      // Step 2: Collect all audio chunks first
      setProgress('Collecting audio...');
      const reader = ttsResponse.body?.getReader();
      if (!reader) throw new Error('No response body');
      
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      // Concatenate all chunks
      const fullAudioBuffer = AudioManager.concatenateChunks(chunks);
      audioBufferRef.current = fullAudioBuffer;
      setHasAudio(true);
      
      // Step 3: Get phoneme estimate using the ACTUAL audio duration.
      // Only one estimate call — with the real duration so timing is accurate.
      const actualDuration = AudioManager.estimateDuration(fullAudioBuffer);
      await getEstimatedPhonemes(text, actualDuration);
      
      // Step 4: Transition from fetching → playing.
      // isPlaying = true kicks off the rAF viseme loop, which is now perfectly
      // aligned because audio starts immediately below.
      setIsFetching(false);
      setIsPlaying(true);
      setProgress('Playing...');
      
      // Start playback — onEnded fires when audio source actually finishes.
      await audioManagerRef.current.playPCM(fullAudioBuffer, () => {
        setIsPlaying(false);
        setProgress('');
      });
      
      // Step 5: Background refinement with Rhubarb (non-blocking, updates mid-play if fast)
      refinePhonemes(fullAudioBuffer, text);
      
    } catch (err) {
      console.error('Speak error:', err);
      setError(err instanceof Error ? err.message : 'Failed to speak');
      setIsFetching(false);
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
      // Convert ArrayBuffer to base64 using chunked encoding to avoid
      // V8's maximum-call-stack error for audio buffers larger than ~100 KB.
      const uint8Array = new Uint8Array(audioBuffer);
      let base64Audio = '';
      const CHUNK = 8192;
      for (let i = 0; i < uint8Array.length; i += CHUNK) {
        base64Audio += btoa(
          String.fromCharCode(...uint8Array.subarray(i, i + CHUNK))
        );
      }
      
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
        const cues = refinedData.mouthCues;

        // Validate Rhubarb coverage: cues must span ≥70% of the audio duration.
        // If Rhubarb produced sparse/truncated output (e.g. due to a bad dialog
        // file path), keep the estimated cues that already cover the full audio.
        const audioDuration = AudioManager.estimateDuration(audioBuffer);
        const lastCueEnd = cues.length > 0 ? cues[cues.length - 1].end : 0;
        const coverage = audioDuration > 0 ? lastCueEnd / audioDuration : 0;

        if (coverage < 0.7) {
          console.warn(
            `[Rhubarb] Cues only cover ${(coverage * 100).toFixed(0)}% of audio ` +
            `(${lastCueEnd.toFixed(2)}s / ${audioDuration.toFixed(2)}s) — keeping estimated cues`
          );
          return;
        }

        phonemeDataRef.current = cues;
        console.log(`Phonemes refined with Rhubarb: ${cues.length} cues (${(coverage * 100).toFixed(0)}% coverage)`);
        setProgress('High-quality lip-sync active');
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
    setIsFetching(false);
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
      await audioManagerRef.current.playPCM(audioBufferRef.current, () => {
        setIsPlaying(false);
        setProgress('');
      });
    } catch (err) {
      console.error('Replay error:', err);
      setError(err instanceof Error ? err.message : 'Failed to replay');
      setIsPlaying(false);
      setProgress('');
    }
  };
  
  return {
    currentViseme,
    nextViseme,
    isPlaying,
    isFetching,
    error,
    progress,
    speak,
    stop,
    replay,
    hasAudio,
  };
}
