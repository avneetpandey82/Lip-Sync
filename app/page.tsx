"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useConversation } from "@/hooks/useConversation";
import { MessageContent } from "@/components/MessageContent";

const AvatarScene = dynamic(
  () => import("@/components/AvatarScene").then((mod) => mod.AvatarScene),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#080c18] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500/40 border-t-indigo-400
                          animate-spin" />
          <span className="text-gray-500 text-sm font-medium tracking-wide">Loading avatar…</span>
        </div>
      </div>
    ),
  },
);

/* ─── Status config ───────────────────────────────────────────────── */
const STATUS_LABEL: Record<string, string> = {
  idle:       "Press mic to speak",
  listening:  "Listening…",
  thinking:   "Thinking…",
  responding: "Speaking…",
};

const STATUS_DOT: Record<string, string> = {
  idle:       "bg-gray-600",
  listening:  "bg-emerald-400 animate-pulse",
  thinking:   "bg-amber-400 animate-pulse",
  responding: "bg-indigo-400 animate-pulse",
};

const STATUS_TEXT: Record<string, string> = {
  idle:       "text-gray-500",
  listening:  "text-emerald-400",
  thinking:   "text-amber-400",
  responding: "text-indigo-400",
};

/* ─── Reusable Card wrapper ───────────────────────────────────────── */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0b0f1d]/80 backdrop-blur-2xl border border-white/[0.08]
                     rounded-2xl shadow-2xl shadow-black/60 ${className}`}>
      {children}
    </div>
  );
}

/* ─── Mic icon SVG ─────────────────────────────────────────────────── */
function MicIcon({ muted }: { muted?: boolean }) {
  return muted ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 4.93" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8"  y1="22" x2="16" y2="22" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V6a3 3 0 0 0-5.94-.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8"  y1="22" x2="16" y2="22" />
    </svg>
  );
}

/* ─── Stop icon ───────────────────────────────────────────────────── */
function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

/* ─── Thinking dots ───────────────────────────────────────────────── */
function ThinkingDots() {
  return (
    <span className="flex items-center gap-1.5 py-0.5">
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

/* ─── ChevronDown for select ──────────────────────────────────────── */
const chevronDown = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`;

/* ─── Page ─────────────────────────────────────────────────────────── */
export default function HomePage() {
  const [botName,   setBotName]   = useState("Avneet");
  const [language,  setLanguage]  = useState("English");
  const [roastMode, setRoastMode] = useState(false);

  const LANGUAGES = [
    { value: "English",  label: "🇬🇧 English"  },
    { value: "French",   label: "🇫🇷 French"    },
    { value: "Spanish",  label: "🇪🇸 Spanish"   },
    { value: "Hindi",    label: "🇮🇳 Hindi"     },
    { value: "Hinglish", label: "🤝 Hinglish"  },
    { value: "Slang",    label: "🔥 Slang"     },
  ];

  const {
    messages,
    status,
    interimTranscript,
    error,
    isSupported,
    currentViseme,
    nextViseme,
    mouthAmplitude,
    remaining,
    startListening,
    stopListening,
    interrupt,
    clearHistory,
  } = useConversation(botName, language, roastMode);

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimTranscript]);

  const isListening  = status === "listening";
  const isThinking   = status === "thinking";
  const isResponding = status === "responding";
  const isIdle       = status === "idle";
  const isLimited    = remaining === 0;

  const handleMicClick = () => {
    if (isLimited)    return;
    if (isResponding) { interrupt(); return; }
    if (isListening)  { stopListening(); return; }
    if (isThinking)   return;
    startListening();
  };

  const visibleMessages = messages.slice(-6);

  return (
    <main className="h-screen w-screen bg-[#080c18] flex flex-col overflow-hidden relative">

      {/* ── Full-screen avatar ──────────────────────────────────────── */}
      <div className="absolute inset-0">
        <AvatarScene
          currentViseme={currentViseme}
          nextViseme={nextViseme}
          isPlaying={isResponding}
          mouthAmplitude={mouthAmplitude}
        />

        {/* Status glow rings */}
        {isListening && (
          <div aria-hidden className="pointer-events-none absolute inset-0"
               style={{ boxShadow: "inset 0 0 100px 16px rgba(52,211,153,0.16)",
                        animation: "lspulse 1s ease-in-out infinite" }} />
        )}
        {isResponding && (
          <div aria-hidden className="pointer-events-none absolute inset-0"
               style={{ boxShadow: "inset 0 0 100px 16px rgba(99,102,241,0.22)",
                        animation: "lspulse 1.2s ease-in-out infinite" }} />
        )}
        {isThinking && (
          <div aria-hidden className="pointer-events-none absolute inset-0"
               style={{ boxShadow: "inset 0 0 100px 16px rgba(251,191,36,0.10)",
                        animation: "lspulse 0.8s ease-in-out infinite" }} />
        )}
      </div>

      {/* ── TOP CARD: controls ─────────────────────────────────────── */}
      <div className="absolute top-4 inset-x-4 md:inset-x-8 z-20 flex justify-center">
        <Card className="w-full max-w-3xl px-5 py-3.5">
          <div className="flex items-center justify-between gap-4">

            {/* Left: companion identity */}
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-400">
                Companion
              </span>
              <span className="text-white font-semibold text-base mt-0.5 truncate">
                {botName || "Avneet"}
              </span>
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-2 flex-wrap justify-end">

              {/* Name field */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="bot-name"
                       className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500 whitespace-nowrap hidden sm:block">
                  Name
                </label>
                <input
                  id="bot-name"
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  onBlur={(e) => { if (!e.target.value.trim()) setBotName("Avneet"); }}
                  maxLength={24}
                  placeholder="Avneet"
                  className="bg-white/[0.05] border border-white/10 text-white text-sm
                             rounded-xl px-3 py-1.5 w-28 placeholder-gray-600
                             focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.08]
                             transition-colors"
                />
              </div>

              {/* Separator */}
              <div className="w-px h-5 bg-white/10 hidden sm:block" />

              {/* Roast toggle */}
              <button
                onClick={() => setRoastMode((r) => !r)}
                title={roastMode ? "Roast mode ON — click to disable" : "Enable roast mode"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
                            border transition-all select-none
                            ${roastMode
                              ? "bg-orange-500/15 border-orange-500/50 text-orange-300 hover:bg-orange-500/25"
                              : "bg-white/[0.04] border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/10"}`}
              >
                🍖 <span className="hidden sm:inline">{roastMode ? "Roasting" : "Roast"}</span>
              </button>

              {/* Separator */}
              <div className="w-px h-5 bg-white/10 hidden sm:block" />

              {/* Language selector */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="bot-lang"
                       className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500 whitespace-nowrap hidden sm:block">
                  Language
                </label>
                <select
                  id="bot-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-white/[0.05] border border-white/10 text-white text-sm
                             rounded-xl px-3 py-1.5 pr-8 appearance-none cursor-pointer
                             focus:outline-none focus:border-indigo-500/50 transition-colors"
                  style={{
                    backgroundImage: chevronDown,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 10px center",
                  }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value} className="bg-[#0f1525]">
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── BOTTOM CARD: chat + controls ───────────────────────────── */}
      <div className="absolute bottom-4 inset-x-4 md:inset-x-8 z-20 flex justify-center">
        <Card className="w-full max-w-2xl overflow-hidden">

          {/* ── Messages area ──────────────────────────────────────── */}
          <div className="px-4 pt-4 pb-2 flex flex-col gap-2 max-h-64 overflow-y-auto scrollbar-hide">
            {visibleMessages.map((msg) => (
              <div key={msg.id}
                   className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`
                  px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed font-normal
                  ${msg.role === "user"
                    ? "max-w-[70%] bg-indigo-600 text-white rounded-br-md"
                    : "max-w-[90%] bg-white/[0.07] text-gray-100 rounded-bl-md border border-white/[0.07]"}
                `}>
                  <MessageContent content={msg.content} role={msg.role} />
                </div>
              </div>
            ))}

            {/* Live interim */}
            {interimTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[70%] px-4 py-2.5 rounded-2xl rounded-br-md text-[14px]
                                leading-relaxed bg-indigo-600/30 text-indigo-200 italic
                                border border-indigo-500/25">
                  {interimTranscript}
                  <span className="ml-1 inline-block w-0.5 h-3.5 bg-indigo-300
                                   animate-blink align-middle" />
                </div>
              </div>
            )}

            {/* Thinking dots */}
            {isThinking && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md
                                bg-white/[0.07] border border-white/[0.07]">
                  <ThinkingDots />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* ── Divider ────────────────────────────────────────────── */}
          <div className="mx-4 border-t border-white/[0.07]" />

          {/* ── Controls row ───────────────────────────────────────── */}
          <div className="px-5 py-4 flex items-center gap-4">

            {/* Clear button */}
            <div className="flex-1 flex justify-start">
              {messages.length > 0 && isIdle ? (
                <button
                  onClick={clearHistory}
                  title="Clear conversation"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
                             text-gray-500 hover:text-gray-300 border border-white/10
                             hover:bg-white/[0.07] transition-all bg-white/[0.03]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                       strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                  <span className="hidden sm:inline">Clear</span>
                </button>
              ) : (
                <div />
              )}
            </div>

            {/* Center: status + mic */}
            <div className="flex flex-col items-center gap-2">
              {/* Status indicator */}
              <div className={`flex items-center gap-1.5 ${STATUS_TEXT[status]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
                <span className="text-xs font-medium tracking-wide">{STATUS_LABEL[status]}</span>
              </div>

              {/* Mic / stop button */}
              <button
                onClick={handleMicClick}
                disabled={isThinking || isLimited}
                aria-label={isListening ? "Stop listening" : isResponding ? "Interrupt" : "Start speaking"}
                className={`
                  relative w-16 h-16 rounded-full flex items-center justify-center
                  transition-all duration-200 shadow-xl
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${isListening
                    ? "bg-emerald-500 text-white shadow-emerald-900/60 scale-105"
                    : isResponding
                    ? "bg-red-600 text-white hover:bg-red-500 shadow-red-900/60"
                    : "bg-indigo-600/80 text-white hover:bg-indigo-600 border border-indigo-400/30 shadow-indigo-900/50"}
                `}
              >
                {isListening && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-30 animate-ping" />
                    <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-15"
                          style={{ animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite 0.5s" }} />
                  </>
                )}
                {isResponding ? <StopIcon /> : <MicIcon muted={isThinking} />}
              </button>
            </div>

            {/* Right: usage counter */}
            <div className="flex-1 flex justify-end">
              {remaining !== null && (
                <div className={`flex flex-col items-end gap-0.5
                  ${remaining === 0 ? "text-red-400" : remaining <= 5 ? "text-orange-400" : "text-gray-600"}`}>
                  {remaining === 0 ? (
                    <span className="text-[11px] font-medium text-center leading-tight">
                      Limit reached<br />
                      <span className="text-[10px] text-red-500/70">contact developer</span>
                    </span>
                  ) : (
                    <>
                      <span className="text-xs font-semibold tabular-nums">{remaining}</span>
                      <span className="text-[10px] leading-none opacity-60">/ 20 left</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Built-by contact ───────────────────────────────────── */}
          <div className="px-5 pb-3 flex justify-center">
            <a
              href={`mailto:avneetpandey82@gmail.com?subject=${encodeURIComponent("Your AI told me to email you 🤖")}&body=${encodeURIComponent("Hey Avneet,\n\nI was chatting with your AI avatar and it was so good I had to reach out to the human behind it.\n\n[Write your message here]\n\nP.S. Your avatar has better chat skills than most people I know.")}`}
              className="flex items-center gap-1.5 text-[11px] text-gray-600
                         hover:text-indigo-400 transition-colors group select-none"
              title="Send an email to Avneet"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
                   strokeLinecap="round" strokeLinejoin="round"
                   className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polyline points="2 4 12 13 22 4" />
              </svg>
              <span className="text-gray-700">Contact</span>
              <span className="text-gray-700">·</span>
              <span className="font-medium text-gray-500 group-hover:text-indigo-400 transition-colors">
                Avneet Pandey
              </span>
              <span className="text-gray-700">·</span>
              <span className="text-gray-600 group-hover:text-indigo-400 transition-colors">
                avneetpandey82@gmail.com
              </span>
            </a>
          </div>

          {/* ── Error / warning banners ─────────────────────────────── */}
          {(error || !isSupported) && (
            <div className="px-4 pb-4 flex flex-col gap-2">
              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/25
                                text-red-300 text-xs rounded-xl px-4 py-2.5 leading-relaxed">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>{error}</span>
                </div>
              )}
              {!isSupported && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/25
                                text-amber-300 text-xs rounded-xl px-4 py-2.5 leading-relaxed">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>Speech recognition not supported. Use Chrome or Edge.</span>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ── Debug viseme badge ─────────────────────────────────────── */}
      <div className="absolute top-[4.5rem] right-5 z-10 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-black/40 border border-white/[0.06]
                        rounded-lg px-2.5 py-1.5 backdrop-blur-sm">
          <span className="text-[9px] text-gray-600 uppercase tracking-widest">viseme</span>
          <span className="font-mono text-[11px] text-indigo-400 font-bold w-4">{currentViseme}</span>
          <span className="text-gray-700 text-[9px]">→</span>
          <span className="font-mono text-[11px] text-purple-600 w-4">{nextViseme}</span>
        </div>
      </div>

      <style>{`
        @keyframes lspulse {
          0%, 100% { opacity: 0.5; }
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

