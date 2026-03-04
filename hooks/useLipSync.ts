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
  const [currentViseme,  setCurrentViseme]  = useState<string>('X');
  const [nextViseme,     setNextViseme]      = useState<string>('X');
  // mouthAmplitude: instantaneous [0–1] RMS energy from the PCM waveform.
  // Used by Avatar to modulate how wide the jaw opens — perfectly synced
  // with actual audio rather than relying on text-estimated timing alone.
  const [mouthAmplitude, setMouthAmplitude]  = useState<number>(0);
  const [isPlaying,      setIsPlaying]       = useState(false);
  const [isFetching,     setIsFetching]      = useState(false);
  const [error,          setError]           = useState<string | null>(null);
  const [progress,       setProgress]        = useState<string>('');
  const [hasAudio,       setHasAudio]        = useState(false);

  const audioManagerRef   = useRef<AudioManager | null>(null);
  const phonemeDataRef    = useRef<MouthCue[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const audioBufferRef    = useRef<ArrayBuffer | null>(null);
  // RMS amplitude envelope extracted from PCM (fps = 100 → 10 ms windows)
  const AMPLITUDE_FPS           = 100;
  const amplitudeEnvelopeRef    = useRef<Float32Array | null>(null);
  const mouthAmplitudeRef       = useRef<number>(0);

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
    
    // ── Amplitude: read RMS from envelope at current playback time ──────────
    // This gives us the actual speech energy so the Avatar can open its jaw
    // proportionally to the loudness of each phoneme — much more lifelike
    // than a flat text-estimated weight.
    if (amplitudeEnvelopeRef.current) {
      const frameIdx = Math.min(
        Math.floor(currentTime * AMPLITUDE_FPS),
        amplitudeEnvelopeRef.current.length - 1,
      );
      const rawAmp = amplitudeEnvelopeRef.current[frameIdx] ?? 0;
      // Gamma-correct to make small values more visible (~0.6 power curve)
      const amp = Math.pow(rawAmp, 0.6);
      if (Math.abs(amp - mouthAmplitudeRef.current) > 0.01) {
        mouthAmplitudeRef.current = amp;
        setMouthAmplitude(amp);
      }
    }

    // ── Viseme: find phoneme cue matching current time ───────────────────────
    const currentCue = phonemeDataRef.current.find(
      cue => currentTime >= cue.start && currentTime < cue.end
    );
    
    if (currentCue) {
      if (currentCue.value !== currentVisemeRef.current) {
        currentVisemeRef.current = currentCue.value;
        setCurrentViseme(currentCue.value);
      }
    } else if (currentTime > 0) {
      if (currentVisemeRef.current !== 'X') {
        currentVisemeRef.current = 'X';
        setCurrentViseme('X');
      }
    }

    // Look-ahead: next cue within 40 ms (tighter window = less early blending)
    const LOOK_AHEAD_S = 0.04;
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
   * @param onReady - Optional callback fired right before audio playback starts.
   *                  Use this to sync UI updates (e.g. showing a message bubble)
   *                  with the moment audio begins, eliminating perceived latency.
   */
  const speak = async (
    text:            string,
    voice:           string = 'coral',
    speed:           number = 1.0,
    onReady?:        () => void,
    preFetchedBuffer?: ArrayBuffer,   // pre-loaded PCM — skips TTS network fetch
  ) => {
    if (!audioManagerRef.current) {
      setError('Audio manager not initialized');
      return;
    }
    
    setError(null);
    setIsFetching(true);
    setProgress('Requesting speech...');
    
    try {
      // Initialize audio context (requires user interaction)
      await audioManagerRef.current.init();
      
      // Step 1: Obtain audio buffer — either from pre-fetch or fresh TTS request.
      // When drainQueue pre-fetches the next sentence while the current plays,
      // preFetchedBuffer is already resolved, making the gap near-zero.
      let fullAudioBuffer: ArrayBuffer;

      if (preFetchedBuffer) {
        // ── Pre-fetched path: buffer already in memory, no network wait ──────
        setProgress('Using pre-fetched audio...');
        fullAudioBuffer = preFetchedBuffer;

        audioBufferRef.current = fullAudioBuffer;
        setHasAudio(true);

        amplitudeEnvelopeRef.current = AudioManager.extractAmplitudeEnvelope(
          fullAudioBuffer, AMPLITUDE_FPS,
        );

        // Estimate phonemes from actual duration of the pre-fetched buffer
        const actualDuration = AudioManager.estimateDuration(fullAudioBuffer);
        await getEstimatedPhonemes(text, actualDuration);
      } else {
        // ── Fresh fetch path: stream TTS + phonemes concurrently ─────────────
        setProgress('Streaming audio from OpenAI...');

        const wordCount     = text.trim().split(/\s+/).length;
        const roughDuration = Math.max(1, wordCount / 2.17);

        const [ttsResponse] = await Promise.all([
          fetch('/api/tts/stream', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ text, voice, speed }),
          }),
          getEstimatedPhonemes(text, roughDuration),
        ]);

        if (!ttsResponse.ok) {
          const errorData = await ttsResponse.json();
          throw new Error(errorData.error || 'TTS request failed');
        }

        setProgress('Buffering audio...');
        const reader = ttsResponse.body?.getReader();
        if (!reader) throw new Error('No response body');

        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        fullAudioBuffer = AudioManager.concatenateChunks(chunks);
        audioBufferRef.current = fullAudioBuffer;
        setHasAudio(true);

        amplitudeEnvelopeRef.current = AudioManager.extractAmplitudeEnvelope(
          fullAudioBuffer, AMPLITUDE_FPS,
        );

        // Correct phoneme timing with actual audio duration if rough estimate was off
        const actualDuration = AudioManager.estimateDuration(fullAudioBuffer);
        const durationError  = Math.abs(actualDuration - roughDuration) / actualDuration;
        if (durationError > 0.10) {
          await getEstimatedPhonemes(text, actualDuration);
        }
      }
      
      // Step 4: Fire onReady BEFORE starting playback so any caller-side UI
      // update (e.g. showing the message bubble) is synchronised with audio.
      onReady?.();

      setIsFetching(false);
      setIsPlaying(true);
      setProgress('Playing...');
      
      await audioManagerRef.current.playPCM(fullAudioBuffer, () => {
        setIsPlaying(false);
        setProgress('');
      });
      
      // Step 5: Background Rhubarb refinement (non-blocking)
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
    setMouthAmplitude(0);
    mouthAmplitudeRef.current = 0;
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
    mouthAmplitude,
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
