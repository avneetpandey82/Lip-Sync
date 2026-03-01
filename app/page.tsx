"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useConversation } from "@/hooks/useConversation";

const AvatarScene = dynamic(
  () => import("@/components/AvatarScene").then((mod) => mod.AvatarScene),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#0d1220] flex items-center justify-center">
        <div className="text-gray-500 text-sm tracking-widest uppercase animate-pulse">
          Loading avatar...
        </div>
      </div>
    ),
  },
);

/* ─── Status helpers ─────────────────────────────────────────────────── */
const STATUS_LABEL: Record<string, string> = {
  idle:       "Press mic to speak",
  listening:  "Listening...",
  thinking:   "Thinking...",
  responding: "Speaking...",
};

const STATUS_COLOR: Record<string, string> = {
  idle:       "text-gray-500",
  listening:  "text-emerald-400",
  thinking:   "text-amber-400",
  responding: "text-indigo-400",
};

/* ─── Mic icon SVG ────────────────────────────────────────────────────── */
function MicIcon({ muted }: { muted?: boolean }) {
  return muted ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 4.93" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8"  y1="22" x2="16" y2="22" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V6a3 3 0 0 0-5.94-.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8"  y1="22" x2="16" y2="22" />
    </svg>
  );
}

/* ─── Stop icon ───────────────────────────────────────────────────────── */
function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

/* ─── Thinking dots ───────────────────────────────────────────────────── */
function ThinkingDots() {
  return (
    <span className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-amber-400"
          style={{ animation: `tBounce 1s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </span>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const {
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
  } = useConversation();

  // Auto-scroll chat to latest message
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimTranscript]);

  const isListening  = status === "listening";
  const isThinking   = status === "thinking";
  const isResponding = status === "responding";
  const isIdle       = status === "idle";

  /* Mic button action */
  const handleMicClick = () => {
    if (isResponding)   { interrupt(); return; }
    if (isListening)    { stopListening(); return; }
    if (isThinking)     return; // can't interrupt thinking
    startListening();
  };

  // Show only the last 6 messages to keep UI clean
  const visibleMessages = messages.slice(-6);

  return (
    <main className="h-screen w-screen bg-[#0a0e1a] flex flex-col overflow-hidden relative">

      {/* ── Avatar fills the whole screen ─────────────────────────────── */}
      <div className="absolute inset-0">
        <AvatarScene
          currentViseme={currentViseme}
          nextViseme={nextViseme}
          isPlaying={isResponding}
          mouthAmplitude={mouthAmplitude}
        />

        {/* Ambient glow frame per status */}
        {isListening && (
          <div aria-hidden className="pointer-events-none absolute inset-0"
               style={{ boxShadow: "inset 0 0 80px 12px rgba(52,211,153,0.18)",
                        animation: "lspulse 1s ease-in-out infinite" }} />
        )}
        {isResponding && (
          <div aria-hidden className="pointer-events-none absolute inset-0"
               style={{ boxShadow: "inset 0 0 80px 12px rgba(99,102,241,0.28)",
                        animation: "lspulse 1.2s ease-in-out infinite" }} />
        )}
        {isThinking && (
          <div aria-hidden className="pointer-events-none absolute inset-0"
               style={{ boxShadow: "inset 0 0 80px 12px rgba(251,191,36,0.12)",
                        animation: "lspulse 0.8s ease-in-out infinite" }} />
        )}
      </div>

      {/* ── Bottom panel (glassmorphism) ──────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 flex flex-col items-center pb-6 pt-2"
           style={{ background: "linear-gradient(to top, #0a0e1aee 60%, transparent)" }}>

        {/* Chat messages */}
        <div className="w-full max-w-2xl px-4 mb-3 flex flex-col gap-2 max-h-52 overflow-y-auto scrollbar-hide">
          {visibleMessages.map((msg) => (
            <div key={msg.id}
                 className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`
                max-w-[82%] px-4 py-2 rounded-2xl text-sm leading-snug
                ${msg.role === "user"
                  ? "bg-indigo-600/80 text-white rounded-br-sm"
                  : "bg-white/10 text-gray-100 rounded-bl-sm backdrop-blur-sm border border-white/5"}
              `}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Live interim transcript */}
          {interimTranscript && (
            <div className="flex justify-end">
              <div className="max-w-[82%] px-4 py-2 rounded-2xl rounded-br-sm text-sm
                              leading-snug bg-indigo-600/40 text-indigo-200 italic
                              border border-indigo-500/30">
                {interimTranscript}
                <span className="ml-1 inline-block w-0.5 h-3.5 bg-indigo-300 animate-blink align-middle" />
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {isThinking && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white/10 backdrop-blur-sm border border-white/5">
                <ThinkingDots />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Status label */}
        <p className={`text-xs mb-3 tracking-widest uppercase font-medium ${STATUS_COLOR[status]}`}>
          {STATUS_LABEL[status]}
        </p>

        {/* Mic / interrupt button row */}
        <div className="flex items-center gap-6">

          {/* Clear history (only when idle + messages exist) */}
          {messages.length > 0 && isIdle ? (
            <button onClick={clearHistory} title="Clear conversation"
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10
                               text-gray-500 hover:text-gray-300 hover:bg-white/10
                               flex items-center justify-center transition-all text-sm">
              ✕
            </button>
          ) : (
            <div className="w-10" />
          )}

          {/* Main mic / stop button */}
          <button
            onClick={handleMicClick}
            disabled={isThinking}
            aria-label={isListening ? "Stop listening" : isResponding ? "Interrupt" : "Start speaking"}
            className={`
              relative rounded-full flex items-center justify-center
              transition-all duration-200 shadow-2xl
              disabled:opacity-40 disabled:cursor-not-allowed
              ${isListening
                ? "bg-emerald-500 text-white scale-110 shadow-emerald-800/60"
                : isResponding
                ? "bg-red-600/90 text-white hover:bg-red-500"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/15"}
            `}
            style={{ width: 72, height: 72 }}
          >
            {/* Listening pulse rings */}
            {isListening && (
              <>
                <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-40 animate-ping" />
                <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-20"
                      style={{ animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite 0.5s" }} />
              </>
            )}
            {isResponding ? <StopIcon /> : <MicIcon muted={isThinking} />}
          </button>

          {/* Spacer mirror */}
          <div className="w-10" />
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 bg-red-900/80 border border-red-600 text-red-200 text-xs
                          px-5 py-2 rounded-full backdrop-blur-sm max-w-sm text-center">
            {error}
          </div>
        )}

        {/* Browser support warning */}
        {!isSupported && (
          <p className="mt-3 text-yellow-500/80 text-xs text-center max-w-xs">
            Speech recognition not supported. Use Chrome or Edge for real-time conversation.
          </p>
        )}
      </div>

      {/* Debug viseme strip — top-right, subtle */}
      <div className="absolute top-3 right-4 flex items-center gap-2 pointer-events-none">
        <span className="text-[10px] text-gray-700 uppercase tracking-widest">viseme</span>
        <span className="font-mono text-xs text-indigo-400 font-bold w-4">{currentViseme}</span>
        <span className="text-[10px] text-gray-800">→</span>
        <span className="font-mono text-xs text-purple-700 w-4">{nextViseme}</span>
      </div>

      <style>{`
        @keyframes lspulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1;   }
        }
        @keyframes tBounce {
          0%, 80%, 100% { transform: translateY(0);    }
          40%           { transform: translateY(-6px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        .animate-blink { animation: blink 0.8s ease-in-out infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}

