'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLipSync } from './useLipSync';

export type ConversationStatus = 'idle' | 'listening' | 'thinking' | 'responding';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface UseConversationReturn {
  messages: Message[];
  status: ConversationStatus;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  currentViseme: string;
  nextViseme: string;
  mouthAmplitude: number;
  startListening: () => void;
  stopListening: () => void;
  interrupt: () => void;
  clearHistory: () => void;
}

/**
 * useConversation Hook
 *
 * Full real-time conversational pipeline:
 *   mic → Web Speech API transcript
 *     → /api/chat  (GPT response)
 *       → useLipSync (TTS stream + phoneme-based visemes)
 *
 * Status machine:
 *   idle → listening → thinking → responding → idle
 */
export function useConversation(botName: string = 'Avneet', language: string = 'English'): UseConversationReturn {
  const [messages, setMessages]             = useState<Message[]>([]);
  const [status, setStatus]                 = useState<ConversationStatus>('idle');
  const [interimTranscript, setInterim]     = useState('');
  const [error, setError]                   = useState<string | null>(null);
  const [isSupported, setIsSupported]       = useState(false);

  // Stable ref copies ─ safe to read inside callbacks without stale closures
  const statusRef   = useRef<ConversationStatus>('idle');
  const messagesRef = useRef<Message[]>([]);
  const languageRef = useRef<string>(language);

  // BCP-47 locale map — used to set recognition.lang before each session
  const LANG_LOCALE: Record<string, string> = {
    English:  'en-US',
    French:   'fr-FR',
    Spanish:  'es-ES',
    Hindi:    'hi-IN',
    Hinglish: 'hi-IN', // Hindi recogniser handles code-switched Hindi+English well
    Slang:    'en-US',
  };

  // Keep languageRef in sync whenever the prop changes
  useEffect(() => { languageRef.current = language; }, [language]);

  // Pipeline handle ref so speech-recognition callback can always call latest version
  const handleFinalRef = useRef<(text: string) => void>(() => {});

  const recognitionRef = useRef<any>(null);

  const {
    currentViseme, nextViseme, mouthAmplitude,
    isPlaying, isFetching,
    speak,
    stop: stopSpeaking,
  } = useLipSync();

  // ── Keep refs in sync ─────────────────────────────────────────────────────
  useEffect(() => { statusRef.current = status; }, [status]);

  // ── Transition responding → idle when TTS finishes ───────────────────────
  useEffect(() => {
    if (statusRef.current === 'responding' && !isPlaying && !isFetching) {
      // Small guard: only flip to idle if we haven't already moved to another state
      const timer = setTimeout(() => {
        if (statusRef.current === 'responding') setStatus('idle');
      }, 120); // 120 ms debounce avoids flicker on the isFetching→isPlaying handoff
      return () => clearTimeout(timer);
    }
  }, [isPlaying, isFetching]);

  // ── Speech recognition setup ──────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous      = false;
    recognition.interimResults  = true;
    recognition.lang            = 'en-US'; // overridden per-session in startListening
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus('listening');
      statusRef.current = 'listening';
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final   = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final   += t;
        else                          interim += t;
      }

      if (interim) setInterim(interim);

      if (final.trim()) {
        setInterim('');
        handleFinalRef.current(final.trim());
      }
    };

    recognition.onerror = (event: any) => {
      // 'no-speech' is not a real error — just silence timeout
      if (event.error !== 'no-speech') {
        setError(`Mic error: ${event.error}`);
      }
      setStatus('idle');
      statusRef.current = 'idle';
      setInterim('');
    };

    recognition.onend = () => {
      setInterim('');
      // If still in listening state (no result came), go back to idle
      if (statusRef.current === 'listening') {
        setStatus('idle');
        statusRef.current = 'idle';
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.abort(); } catch (_) {}
    };
  }, []); // only once

  // ── Main pipeline: final transcript → chat → TTS ─────────────────────────
  const handleFinalTranscript = useCallback(async (text: string) => {
    if (!text) return;

    // If avatar is mid-speech, interrupt it
    stopSpeaking();

    // Add user message
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const updatedMsgs = [...messagesRef.current, userMsg];
    messagesRef.current = updatedMsgs;
    setMessages([...updatedMsgs]);

    setStatus('thinking');
    statusRef.current = 'thinking';
    setError(null);

    try {
      // Build history (exclude the just-added user message — API route appends it)
      const history = messagesRef.current
        .slice(0, -1)           // all except last (user msg)
        .slice(-10)             // keep last 10 for context window
        .map(({ role, content }) => ({ role, content }));

      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, conversationHistory: history, botName, language }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Chat failed (${res.status})`);
      }

      // ── Stream tokens from SSE ─────────────────────────────────────────
      // Uses a line-buffer so SSE events split across read() chunks are
      // reassembled correctly before JSON parsing.
      const assistantId = `a-${Date.now()}`;
      let fullText      = '';
      let bubbleAdded   = false;

      // ── TTS pre-fetch helper ────────────────────────────────────────────
      // Fetches and buffers PCM audio for a sentence in the background.
      // Returns a Promise<ArrayBuffer> that resolves once the audio is fully
      // downloaded — speak() consumes it via the preFetchedBuffer shortcut,
      // skipping the network round-trip and eliminating inter-sentence gaps.
      const prefetchTTS = (sentence: string): Promise<ArrayBuffer> =>
        fetch('/api/tts/stream', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ text: sentence, voice: 'marin', speed: 0.85 }),
        }).then(async (res) => {
          if (!res.ok || !res.body) throw new Error('TTS prefetch failed');
          const reader = res.body.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          // Inline concatenation so we don't need to import AudioManager here
          const total  = chunks.reduce((s, c) => s + c.length, 0);
          const merged = new Uint8Array(total);
          let   offset = 0;
          for (const c of chunks) { merged.set(c, offset); offset += c.length; }
          return merged.buffer as ArrayBuffer;
        });

      // Sentence pipeline — each entry holds the text AND a pre-fetch Promise
      // that starts the moment the sentence is complete (not when we play it).
      type QueuedSentence = { text: string; audioProm: Promise<ArrayBuffer> };
      let sentenceQueue: QueuedSentence[] = [];
      let ttsActive                       = false;
      let streamDone                      = false;

      // Drain: plays each sentence back-to-back.
      // Because each audioProm starts fetching the moment the sentence is
      // enqueued, by the time the previous sentence finishes playing the next
      // buffer is almost always already in memory → gap ≈ 0 ms.
      const drainQueue = async () => {
        if (ttsActive) return;
        ttsActive = true;
        while (sentenceQueue.length > 0) {
          const { text: sentence, audioProm } = sentenceQueue.shift()!;
          if (statusRef.current !== 'responding') {
            setStatus('responding');
            statusRef.current = 'responding';
          }
          try {
            const buffer = await audioProm; // already buffered ─ near-instant
            await speak(sentence, 'marin', 0.85, undefined, buffer);
            // speak() now AWAITS audio end (playPCM resolves on onended)
            // so the next iteration only starts once this sentence finishes.
          } catch (e) {
            console.warn('[drainQueue] sentence TTS failed, skipping:', e);
          }
        }
        if (!streamDone) { ttsActive = false; return; }
        ttsActive = false;
      };

      // Helper: find newly-completed sentences, immediately kick off TTS pre-fetch
      let spokenUpTo = 0;
      const flushSentences = (force = false) => {
        const unspoken    = fullText.slice(spokenUpTo);
        const sentenceRe  = /[^.!?]*[.!?]+(?:\s|$)/g;
        let match: RegExpExecArray | null;
        let lastMatchEnd  = 0;
        while ((match = sentenceRe.exec(unspoken)) !== null) {
          const sentence = match[0].trim();
          if (sentence) {
            // Start TTS network fetch NOW — while previous sentence still plays
            sentenceQueue.push({ text: sentence, audioProm: prefetchTTS(sentence) });
          }
          lastMatchEnd = match.index + match[0].length;
        }
        spokenUpTo += lastMatchEnd;
        if (force) {
          const trailing = fullText.slice(spokenUpTo).trim();
          if (trailing) {
            sentenceQueue.push({ text: trailing, audioProm: prefetchTTS(trailing) });
          }
          spokenUpTo = fullText.length;
        }
        drainQueue();
      };

      const reader     = res.body.getReader();
      const decoder    = new TextDecoder();
      let   lineBuffer = ''; // accumulates incomplete SSE lines across read() calls

      const processLine = (line: string) => {
        if (!line.startsWith('data: ')) return false; // false = not done
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') return true; // true = stream ended

        try {
          const { token, error: streamErr } = JSON.parse(payload);
          if (streamErr) throw new Error(streamErr as string);
          if (!token) return false;

          fullText += token;

          // Show bubble on first token — update in-place on subsequent tokens
          if (!bubbleAdded) {
            bubbleAdded = true;
            const assistantMsg: Message = { id: assistantId, role: 'assistant', content: fullText };
            messagesRef.current = [...messagesRef.current, assistantMsg];
            setMessages([...messagesRef.current]);
          } else {
            messagesRef.current = messagesRef.current.map(m =>
              m.id === assistantId ? { ...m, content: fullText } : m
            );
            setMessages([...messagesRef.current]);
          }

          // Flush full sentences to TTS queue as they arrive
          flushSentences();
        } catch (_) { /* malformed SSE line — skip */ }
        return false;
      };

      // Read until stream is exhausted
      let readerDone = false;
      while (!readerDone) {
        const { done, value } = await reader.read();
        if (done) { readerDone = true; break; }

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer  = lines.pop() ?? ''; // keep incomplete trailing fragment

        let finished = false;
        for (const line of lines) {
          if (processLine(line)) { finished = true; break; }
        }
        if (finished) break;
      }

      // Process any leftover buffered data
      if (lineBuffer) processLine(lineBuffer);

      // ── Stream done — flush remaining text and wait for TTS to finish ───
      streamDone = true;
      flushSentences(true); // force-flush any trailing fragment

      // Ensure responding status is set even if no sentences were queued
      if (!bubbleAdded) {
        setStatus('idle');
        statusRef.current = 'idle';
      }

      // Wait for the TTS drain to fully finish (in case it's still running)
      // by yielding — the drain loop checks streamDone and will complete.
      await new Promise<void>(resolve => {
        const check = () => {
          if (!ttsActive && sentenceQueue.length === 0) { resolve(); }
          else setTimeout(check, 50);
        };
        check();
      });

    } catch (err) {
      console.error('[useConversation] pipeline error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('idle');
      statusRef.current = 'idle';
    }
  }, [speak, stopSpeaking]);

  // Keep the ref always pointing to the latest callback version
  useEffect(() => {
    handleFinalRef.current = handleFinalTranscript;
  }, [handleFinalTranscript]);

  // ── Public controls ───────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (statusRef.current === 'listening') return;

    // Interrupt ongoing reply so user can talk immediately
    stopSpeaking();
    setError(null);
    setInterim('');

    // Set the correct recognition language for the active selection
    const locale = LANG_LOCALE[languageRef.current] ?? 'en-US';
    recognitionRef.current.lang = locale;

    try {
      recognitionRef.current.start();
    } catch (e: any) {
      // InvalidStateError = recognition already started; ignore silently
      if (!e?.message?.includes('already started')) {
        setError(e?.message ?? 'Failed to start mic');
      }
    }
  }, [stopSpeaking]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && statusRef.current === 'listening') {
      recognitionRef.current.stop(); // triggers onresult + onend
    }
  }, []);

  const interrupt = useCallback(() => {
    stopSpeaking();
    if (statusRef.current === 'listening') {
      try { recognitionRef.current?.stop(); } catch (_) {}
    }
    setStatus('idle');
    statusRef.current = 'idle';
    setInterim('');
  }, [stopSpeaking]);

  const clearHistory = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
  }, []);

  return {
    messages,
    status,
    interimTranscript,
    error,
    isSupported,
    currentViseme,
    nextViseme,
    mouthAmplitude,
    startListening,
    stopListening,
    interrupt,
    clearHistory,
  };
}
