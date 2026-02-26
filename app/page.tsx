"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useLipSync } from "@/hooks/useLipSync";

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

export default function HomePage() {
  const [text, setText] = useState("");

  const { currentViseme, nextViseme, isPlaying, isFetching, error, speak, stop, hasAudio, replay } =
    useLipSync();

  // busy = either loading audio OR actually playing — blocks new requests
  const busy = isFetching || isPlaying;

  const handleSpeak = async () => {
    if (!text.trim() || busy) return;
    await speak(text.trim(), "coral", 1.0);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSpeak();
    }
  };

  return (
    <main className="h-screen w-screen bg-[#0a0e1a] flex flex-col overflow-hidden">

      {/* Avatar fills all space above the input bar */}
      <div className="flex-1 min-h-0 relative">
        <AvatarScene
          currentViseme={currentViseme}
          nextViseme={nextViseme}
          isPlaying={isPlaying}
        />

        {(isPlaying || isFetching) && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow: isFetching
                ? "inset 0 0 60px 10px rgba(148,163,184,0.15)"
                : "inset 0 0 60px 10px rgba(99,102,241,0.25)",
              animation: "lspulse 1.2s ease-in-out infinite",
            }}
          />
        )}

        {error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-900/80 border border-red-600 text-red-200 text-sm px-5 py-2 rounded-full backdrop-blur-sm whitespace-nowrap">
            {error}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="flex-none bg-[#0d1220]/90 border-t border-white/5 backdrop-blur-sm px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            disabled={busy}
            rows={2}
            placeholder="Type something and press Speak... (Enter to send)"
            className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          />

          {hasAudio && !busy && (
            <button
              onClick={replay}
              title="Replay"
              className="flex-none w-11 h-11 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors text-lg"
            >
              &#8617;
            </button>
          )}

          {busy && (
            <button
              onClick={stop}
              title="Stop"
              className="flex-none w-11 h-11 rounded-xl bg-red-600/80 hover:bg-red-500 flex items-center justify-center text-white transition-colors text-xl leading-none"
            >
              &#9632;
            </button>
          )}

          <button
            onClick={handleSpeak}
            disabled={busy || !text.trim()}
            className="flex-none px-6 h-11 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-900/30"
          >
            {isFetching ? "Loading..." : isPlaying ? "Speaking..." : "Speak"}
          </button>
        </div>

        <div className="max-w-3xl mx-auto mt-2 flex items-center gap-2">
          <span className="text-[10px] text-gray-700 uppercase tracking-widest">viseme</span>
          <span className="font-mono text-xs text-indigo-400 font-bold w-4">{currentViseme}</span>
          <span className="text-[10px] text-gray-800">&#8594;</span>
          <span className="font-mono text-xs text-purple-700 w-4">{nextViseme}</span>
        </div>
      </div>

      <style>{`
        @keyframes lspulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1;   }
        }
      `}</style>
    </main>
  );
}
