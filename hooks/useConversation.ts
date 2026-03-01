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
export function useConversation(): UseConversationReturn {
  const [messages, setMessages]             = useState<Message[]>([]);
  const [status, setStatus]                 = useState<ConversationStatus>('idle');
  const [interimTranscript, setInterim]     = useState('');
  const [error, setError]                   = useState<string | null>(null);
  const [isSupported, setIsSupported]       = useState(false);

  // Stable ref copies ─ safe to read inside callbacks without stale closures
  const statusRef   = useRef<ConversationStatus>('idle');
  const messagesRef = useRef<Message[]>([]);

  // Pipeline handle ref so speech-recognition callback can always call latest version
  const handleFinalRef = useRef<(text: string) => void>(() => {});

  const recognitionRef = useRef<any>(null);

  const {
    currentViseme, nextViseme,
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
    recognition.lang            = 'en-US';
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
        body:    JSON.stringify({ message: text, conversationHistory: history }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Chat failed (${res.status})`);
      }

      const { reply } = await res.json();

      // Prepare the assistant message but DO NOT add it to state yet.
      // Instead, pass onReady to speak() so the bubble appears exactly
      // when audio begins — eliminating the text-ahead-of-audio gap.
      const assistantMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', content: reply };

      setStatus('responding');
      statusRef.current = 'responding';

      await speak(reply, 'coral', 1.0, () => {
        // onReady: fires right before first audio frame — add bubble now
        const finalMsgs = [...messagesRef.current, assistantMsg];
        messagesRef.current = finalMsgs;
        setMessages([...finalMsgs]);
      });
      // NOTE: speak() returns once audio STARTS playing.
      // The responding→idle transition is handled by the isPlaying/isFetching useEffect above.

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
    startListening,
    stopListening,
    interrupt,
    clearHistory,
  };
}
