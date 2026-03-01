# Real-Time Conversational Lip-Sync Avatar

A real-time, voice-driven conversational AI avatar with accurate lip-sync, powered by the Web Speech API, OpenAI Chat + streaming TTS, and React Three Fiber.

![Status](https://img.shields.io/badge/status-production--ready-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Three.js](https://img.shields.io/badge/Three.js-0.170-orange)
![React](https://img.shields.io/badge/React-19-61dafb)

## ¯ Features

- **Real-Time Voice Conversation** â€” speak to the avatar using your microphone; it listens, thinks, and replies with synced speech
- **Streaming TTS** â€” OpenAI `gpt-4o-mini-tts` streams PCM audio for minimal latency
- **Amplitude-Driven Lip Sync** â€” RMS energy extracted from the PCM waveform modulates jaw opening in real time, so silence gaps close the mouth and stressed vowels open it wider
- **Stress-Aware Phoneme Timing** â€” CMU Pronouncing Dictionary + rule-based G2P assigns correct viseme durations based on syllable stress (primary/secondary/unstressed)
- **Two-Pass Refinement** â€” immediate text-estimated phonemes for instant playback; background Rhubarb analysis refines accuracy mid-speech
- **Ready Player Me Avatar** â€” full-body GLB rendered in Three.js with `mouthOpen` / `mouthSmile` blend-shape animation
- **Look-Ahead Blending** â€” next queued viseme bleeds 20 % into the current frame for organic transition feel
- **Interrupt & Continue** â€” tap the mic button mid-response to interrupt the avatar and speak immediately
- **Conversation History** â€” rolling 10-message context sent to GPT for coherent multi-turn dialogue
- **Zero Python** â€” pure Node.js / TypeScript stack, no native add-ons required

## —ï¸ Architecture

```
Mic â†’ Web Speech API (interim + final transcript)
         â”‚
         â–¼
      /api/chat  (GPT-4o-mini, streaming-safe JSON)
         â”‚
         â”œâ”€â”€â”€ /api/phonemes/estimate  â”€â”€â”  parallel
         â””â”€â”€â”€ /api/tts/stream â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  requests
                   â”‚
                   â–¼
         PCM chunks collected in memory
                   â”‚
                   â”œâ”€â”€ extractAmplitudeEnvelope()  â†’  mouthAmplitude [0â€“1] per 10 ms
                   â””â”€â”€ stress-weighted CMU cues    â†’  viseme timeline
                            â”‚
                            onReady() â† text bubble + audio start are synchronised
                            â”‚
                            â–¼
                  AudioManager.playPCM()  +  rAF viseme loop
                            â”‚
                            â–¼
               Avatar.tsx  (mouthOpen Ã— amplitude, mouthSmile Ã— shape)
                            â”‚
                  Background Rhubarb refinement (if binary present)
```

## “‹ Prerequisites

- **Node.js 18+**
- **OpenAI API key** with access to `gpt-4o-mini` and `gpt-4o-mini-tts`
- **Chrome or Edge** browser (Web Speech API for microphone input)
- _(Optional)_ Rhubarb Lip Sync binary for higher-accuracy phoneme refinement

## € Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```env
OPENAI_API_KEY=sk-...your-key-here...
```

Get your key from: https://platform.openai.com/api-keys

### 3. (Optional) Install Rhubarb for higher-accuracy lip-sync

Without Rhubarb the system uses the built-in CMU phoneme estimator â€” accuracy is good for most use cases. With Rhubarb it is excellent.

**Windows:**

1. Download latest release from https://github.com/DanielSWolf/rhubarb-lip-sync/releases
2. Extract `rhubarb.exe`
3. Place it at `lib/rhubarb/rhubarb.exe`

**Linux / macOS:**

1. Download the appropriate release
2. Place binary at `lib/rhubarb/rhubarb`
3. `chmod +x lib/rhubarb/rhubarb`

### 4. Add a Ready Player Me avatar

1. Visit https://readyplayer.me/avatar and create an avatar
2. Export as `.glb` with **Morph Targets** enabled
3. Save as `public/avatar.glb`

A fallback procedural head is shown if the file is missing.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000 â€” use **Chrome** or **Edge** for microphone support.

---

## “ Project Structure

```
lip-sync/
â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â”œâ”€â”€ chat/
â”‚   â”‚   â”‚   â””â”€â”€ route.ts              # GPT-4o-mini chat endpoint
â”‚   â”‚   â”œâ”€â”€ tts/
â”‚   â”‚   â”‚   â””â”€â”€ stream/
â”‚   â”‚   â”‚       â””â”€â”€ route.ts          # OpenAI streaming TTS (PCM)
â”‚   â”‚   â””â”€â”€ phonemes/
â”‚   â”‚       â”œâ”€â”€ route.ts              # Rhubarb phoneme extraction
â”‚   â”‚       â””â”€â”€ estimate/
â”‚   â”‚           â””â”€â”€ route.ts          # CMU text-based estimation
â”‚   â”œâ”€â”€ debug/
â”‚   â”‚   â””â”€â”€ avatar/
â”‚   â”‚       â””â”€â”€ page.tsx              # Avatar debug/test page
â”‚   â”œâ”€â”€ globals.css
â”‚   â”œâ”€â”€ layout.tsx
â”‚   â””â”€â”€ page.tsx                      # Main conversational UI
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ Avatar.tsx                    # Three.js avatar with blend-shape animation
â”‚   â””â”€â”€ AvatarScene.tsx               # R3F canvas, lighting, error boundary
â”œâ”€â”€ hooks/
â”‚   â”œâ”€â”€ useConversation.ts            # Full pipeline: mic â†’ chat â†’ TTS â†’ lip-sync
â”‚   â”œâ”€â”€ useLipSync.ts                 # TTS stream + amplitude envelope + viseme rAF loop
â”‚   â””â”€â”€ useSpeechRecognition.ts       # Web Speech API wrapper (standalone util)
â”œâ”€â”€ lib/
â”‚   â”œâ”€â”€ audio/
â”‚   â”‚   â””â”€â”€ audio-manager.ts          # Web Audio API: PCM playback + amplitude envelope
â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”œâ”€â”€ phoneme-cmu.ts            # CMU dict + G2P + stress-aware timing
â”‚   â”‚   â””â”€â”€ phoneme-service.ts        # Rhubarb integration + estimation fallback
â”‚   â””â”€â”€ rhubarb/
â”‚       â””â”€â”€ rhubarb(.exe)             # Rhubarb binary (download separately)
â”œâ”€â”€ public/
â”‚   â””â”€â”€ avatar.glb                    # Ready Player Me avatar (add your own)
â”œâ”€â”€ .env.local                        # OPENAI_API_KEY (create this)
â”œâ”€â”€ next.config.mjs
â”œâ”€â”€ package.json
â”œâ”€â”€ tailwind.config.ts
â”œâ”€â”€ tsconfig.json
â””â”€â”€ vercel.json
```

## ”§ Configuration

### Environment variables

```env
# Required
OPENAI_API_KEY=sk-...
```

### OpenAI models

| Usage          | Model             | File                          |
| -------------- | ----------------- | ----------------------------- |
| Chat replies   | `gpt-4o-mini`     | `app/api/chat/route.ts`       |
| Text-to-speech | `gpt-4o-mini-tts` | `app/api/tts/stream/route.ts` |

### TTS voice

()Default voice is `coral`. Change it in `hooks/useConversation.ts`:

```typescript
await speak(reply, "coral", 1.0);
```

Available voices: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`, `coral`, `sage`

### AI personality

Edit the system prompt in `app/api/chat/route.ts`:

```typescript
{
  role: 'system',
  content: 'You are a friendly AI avatar assistant. Keep responses conversational, concise (2-3 sentences), and natural.'
}
```

`max_tokens: 150` keeps replies short for natural conversational pacing.

---

## ¨ Lip-Sync Pipeline Detail

### Viseme map (Rhubarb alphabet)

| Letter | Phonemes                  | `mouthOpen` | `mouthSmile` |
| ------ | ------------------------- | ----------- | ------------ |
| X      | silence / rest            | 0.00        | 0.00         |
| A      | "ah" â€” most open        | 1.00        | 0.05         |
| B      | m / b / p â€” lips closed | 0.00        | 0.00         |
| C      | "oh" â€” round open       | 0.65        | 0.00         |
| D      | th / d / n                | 0.35        | 0.12         |
| E      | "oo" â€” tight round      | 0.20        | 0.00         |
| F      | f / v                     | 0.15        | 0.05         |
| G      | k / g â€” velar           | 0.45        | 0.00         |
| H      | s / z / sh / "ee"         | 0.22        | 0.48         |

### Amplitude modulation

`mouthOpen` is scaled by the live RMS amplitude from the PCM waveform:

```
gated_open = viseme_weight Ã— smooth_ramp(amplitude)
```

- Below silence threshold (0.07) â†’ jaw closes regardless of phoneme
- Stressed vowels â†’ amplitude peaks â†’ jaw opens wider
- `mouthSmile` is a shape signal, not gated by amplitude

### CMU stress-aware timing

Vowel duration multipliers from ARPAbet stress markers:

| Stress         | Multiplier | Example        |
| -------------- | ---------- | -------------- |
| Primary (1)    | 1.45Ã—     | **Ëˆsp**eaking |
| Secondary (2)  | 1.15Ã—     | underËŒstand   |
| Unstressed (0) | 0.65Ã—     | schwa /É™/     |
| Consonant      | 1.00Ã—     | â€”            |

---

## –¥ï¸ UI Behaviour

| Status       | Mic button                | Glow colour   |
| ------------ | ------------------------- | ------------- |
| `idle`       | Press to speak            | â€”           |
| `listening`  | Pulse ring Â· tap to stop | Emerald green |
| `thinking`   | Disabled (dots)           | Amber         |
| `responding` | Tap to interrupt          | Indigo        |

- Live interim transcript appears as the user speaks (italic bubble)
- Assistant text bubble appears **exactly when audio starts** (no gap)
- Last 6 messages visible; `âœ•` clears history when idle

---

## € Deployment

### Vercel

```bash
npm i -g vercel
vercel env add OPENAI_API_KEY
vercel --prod
```

`vercel.json` is pre-configured with a 30-second function timeout for TTS streaming.

> **Rhubarb on Vercel**: Download the **Linux** binary, commit it as `lib/rhubarb/rhubarb`. Without it the system falls back to the CMU estimator automatically.

---

## › Troubleshooting

| Symptom                         | Fix                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| "OpenAI API key not configured" | Check `.env.local` and restart dev server                                                       |
| Mic button does nothing         | Use Chrome or Edge; grant microphone permission                                                 |
| Avatar not loading              | Add `public/avatar.glb` (Ready Player Me export with Morph Targets)                             |
| Mouth stays closed              | Open browser DevTools â†’ verify `mouthOpen`/`mouthSmile` morph targets are present in your GLB |
| Rhubarb not running             | Check binary path `lib/rhubarb/rhubarb(.exe)` and execute permission                            |
| No audio                        | HTTPS required in production; click mic to initialise AudioContext                              |

---

## “š Tech Stack

| Layer        | Technology                                              |
| ------------ | ------------------------------------------------------- |
| Framework    | Next.js 16, React 19                                    |
| 3D rendering | Three.js 0.170, React Three Fiber 9, Drei 10            |
| AI / Speech  | OpenAI `gpt-4o-mini`, `gpt-4o-mini-tts`, Web Speech API |
| Lip-sync     | Rhubarb Lip Sync (optional binary) + CMU G2P estimator  |
| Audio        | Web Audio API (PCM playback + RMS envelope)             |
| Styling      | Tailwind CSS 4                                          |
| Deployment   | Vercel                                                  |

---

## “„ License

MIT â€” free to use in personal and commercial projects.

## ™ Acknowledgments

- [OpenAI](https://openai.com) for streaming TTS and chat APIs
- [Daniel Wolf](https://github.com/DanielSWolf/rhubarb-lip-sync) for Rhubarb Lip Sync
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber) and [Drei](https://github.com/pmndrs/drei) communities
- [Ready Player Me](https://readyplayer.me) for the avatar format
- [CMU Pronouncing Dictionary](http://www.speech.cs.cmu.edu/cgi-bin/cmudict) for phoneme data
