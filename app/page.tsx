"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useLipSync } from "@/hooks/useLipSync";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

// Dynamically import AvatarScene with no SSR to avoid React Three Fiber issues
const AvatarScene = dynamic(
  () => import("@/components/AvatarScene").then((mod) => mod.AvatarScene),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="text-gray-400">Loading 3D Avatar...</div>
      </div>
    )
  }
);

export default function HomePage() {
  const [mode, setMode] = useState<'text' | 'conversation'>('conversation');
  const [inputText, setInputText] = useState(
    "Hello! I am your AI avatar. You can speak to me and I'll respond!",
  );
  const [selectedVoice, setSelectedVoice] = useState("coral");
  const [speed, setSpeed] = useState(1.0);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    currentViseme,
    isPlaying,
    error: lipSyncError,
    progress,
    speak,
    stop,
    replay,
    hasAudio,
  } = useLipSync();
  
  const {
    transcript,
    isListening,
    isSupported: isSpeechSupported,
    error: speechError,
    startListening,
    stopListening
  } = useSpeechRecognition();
  
  const error = lipSyncError || speechError;

  // Handle speech recognition result
  useEffect(() => {
    if (transcript && !isListening && mode === 'conversation') {
      handleConversation(transcript);
    }
  }, [transcript, isListening, mode]);

  const handleSpeak = async () => {
    if (!inputText.trim()) return;
    await speak(inputText, selectedVoice, speed);
  };
  
  const handleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };
  
  const handleConversation = async (userMessage: string) => {
    if (isProcessing || isPlaying) return;
    
    setIsProcessing(true);
    setInputText(userMessage);
    
    try {
      // Get AI response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: conversationHistory.slice(-10) // Keep last 10 messages
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }
      
      const { reply } = await response.json();
      
      // Update conversation history
      const newHistory = [
        ...conversationHistory,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: reply }
      ];
      setConversationHistory(newHistory);
      
      // Speak the response
      setInputText(reply);
      await speak(reply, selectedVoice, speed);
      
    } catch (err: any) {
      console.error('Conversation error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const voices = [
    { id: "alloy", name: "Alloy (Neutral)" },
    { id: "echo", name: "Echo (Male)" },
    { id: "fable", name: "Fable (British Male)" },
    { id: "onyx", name: "Onyx (Deep Male)" },
    { id: "nova", name: "Nova (Female)" },
    { id: "shimmer", name: "Shimmer (Soft Female)" },
    { id: "coral", name: "Coral (Warm Female)" },
    { id: "sage", name: "Sage (Mature Male)" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            AI Conversation Avatar
          </h1>
          <p className="text-gray-400 text-lg">
            OpenAI Chat • Speech Recognition • Real-Time Lip Sync
          </p>
          
          {/* Mode Toggle */}
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => setMode('conversation')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                mode === 'conversation'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🎤 Conversation Mode
            </button>
            <button
              onClick={() => setMode('text')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                mode === 'text'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              📝 Text Mode
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Avatar Display */}
          <div className="space-y-4">
            <AvatarScene currentViseme={currentViseme} />

            {/* Status Bar */}
            <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Status:</span>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isListening 
                        ? "bg-red-500 animate-pulse" 
                        : isPlaying 
                        ? "bg-green-500 animate-pulse" 
                        : "bg-gray-600"
                    }`}
                  />
                  <span className="text-sm font-medium">
                    {isListening ? "Listening..." : isPlaying ? "Speaking" : isProcessing ? "Thinking..." : "Idle"}
                  </span>
                </div>
              </div>

              {progress && (
                <div className="text-sm text-blue-400 mb-2">{progress}</div>
              )}

              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-400">Current Viseme:</span>
                <span className="font-mono font-bold text-2xl text-white bg-gray-700 px-4 py-2 rounded">
                  {currentViseme}
                </span>
              </div>
              
              {/* Debug info */}
              <div className="text-xs text-gray-500 mt-2 border-t border-gray-700 pt-2">
                <div className="font-mono">
                  Debug: Check browser console for detailed timing logs
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Controls */}
          <div className="space-y-6">
            {/* Text Input */}
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <label className="block text-sm font-medium mb-3 text-gray-300">
                Enter text to speak:
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isPlaying}
                className="w-full h-40 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none
                         disabled:opacity-50 disabled:cursor-not-allowed text-white
                         placeholder:text-gray-500"
                placeholder="Type something for the avatar to say..."
                maxLength={1000}
              />
              <div className="mt-2 text-xs text-gray-500 text-right">
                {inputText.length} / 1000 characters
              </div>
            </div>

            {/* Voice Selection */}
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <label className="block text-sm font-medium mb-3 text-gray-300">
                Voice:
              </label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                disabled={isPlaying}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed text-white"
              >
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Speed Control */}
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <label className="block text-sm font-medium mb-3 text-gray-300">
                Speed: {speed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                disabled={isPlaying}
                className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.5x (Slow)</span>
                <span>2.0x (Fast)</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {mode === 'conversation' ? (
                <>
                  <button
                    onClick={handleListen}
                    disabled={isPlaying || isProcessing || !isSpeechSupported}
                    className={`flex-1 px-6 py-4 ${
                      isListening 
                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 animate-pulse'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                    }
                         disabled:from-gray-700 disabled:to-gray-700
                         disabled:cursor-not-allowed rounded-lg font-semibold text-lg
                         transition-all duration-200 shadow-lg hover:shadow-xl
                         transform hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    {isListening ? "🎤 Listening..." : "🎧 Start Listening"}
                  </button>
                  
                  <button
                    onClick={stop}
                    disabled={!isPlaying && !isListening}
                    className="px-6 py-4 bg-red-600 hover:bg-red-700 
                             disabled:bg-gray-700 disabled:cursor-not-allowed 
                             rounded-lg font-semibold text-lg transition-all duration-200
                             shadow-lg hover:shadow-xl"
                  >
                    ⏹️ Stop
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSpeak}
                    disabled={isPlaying || !inputText.trim()}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 
                             hover:from-blue-700 hover:to-blue-800
                             disabled:from-gray-700 disabled:to-gray-700
                             disabled:cursor-not-allowed rounded-lg font-semibold text-lg
                             transition-all duration-200 shadow-lg hover:shadow-xl
                             transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isPlaying ? "🎤 Speaking..." : "🎙️ Speak"}
                  </button>

                  <button
                    onClick={stop}
                    disabled={!isPlaying}
                    className="px-6 py-4 bg-red-600 hover:bg-red-700 
                             disabled:bg-gray-700 disabled:cursor-not-allowed 
                             rounded-lg font-semibold text-lg transition-all duration-200
                             shadow-lg hover:shadow-xl"
                  >
                    ⏹️ Stop
                  </button>

                  <button
                    onClick={replay}
                    disabled={!hasAudio || isPlaying}
                    className="px-6 py-4 bg-purple-600 hover:bg-purple-700 
                             disabled:bg-gray-700 disabled:cursor-not-allowed 
                             rounded-lg font-semibold text-lg transition-all duration-200
                             shadow-lg hover:shadow-xl"
                    title="Replay last audio"
                  >
                    🔄
                  </button>
                </>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
                <div className="font-semibold mb-1">Error</div>
                <div className="text-sm">{error}</div>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 text-blue-200 text-sm">
              <div className="font-semibold mb-2">
                💡 {mode === 'conversation' ? 'Conversation Mode' : 'Text Mode'}:
              </div>
              {mode === 'conversation' ? (
                <ul className="space-y-1 text-xs list-disc list-inside text-blue-300">
                  <li>Click "Start Listening" and speak your message</li>
                  <li>Your speech is converted to text automatically</li>
                  <li>AI processes your message and generates a response</li>
                  <li>Avatar speaks the response with lip sync</li>
                </ul>
              ) : (
                <ul className="space-y-1 text-xs list-disc list-inside text-blue-300">
                  <li>Type your message in the text box</li>
                  <li>OpenAI converts text to speech</li>
                  <li>Phonemes extracted with Rhubarb Lip Sync</li>
                  <li>Avatar mouth synchronized to speech sounds</li>
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>
            Built with Next.js • TypeScript • React Three Fiber • OpenAI •
            Rhubarb
          </p>
          <p className="mt-2">
            Production-ready real-time lip-sync streaming avatar system
          </p>
        </footer>
      </div>
    </main>
  );
}
