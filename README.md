# Real-Time Conversational Lip-Sync Avatar

A real-time, voice-driven conversational AI avatar with accurate lip-sync, powered by the Web Speech API, OpenAI Chat + streaming TTS, and React Three Fiber.

![Status](https://img.shields.io/badge/status-production--ready-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Three.js](https://img.shields.io/badge/Three.js-0.170-orange)
![React](https://img.shields.io/badge/React-19-61dafb)
![Docker](https://img.shields.io/badge/Docker-Hub-2496ED?logo=docker&logoColor=white)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)

## 📑 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Links](#-quick-links)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Configuration](#-configuration)
- [Lip-Sync Pipeline Detail](#-lip-sync-pipeline-detail)
- [UI Behaviour](#-ui-behaviour)
- [Deployment](#-deployment)
  - [Local Development](#local-development)
  - [Docker (Local)](#docker-local)
  - [Docker Hub (Pre-built Image)](#docker-hub-pre-built-image)
  - [Azure App Service](#azure-app-service)
  - [Vercel](#vercel)
- [CI/CD](#-cicd)
- [Troubleshooting](#-troubleshooting)
- [Tech Stack](#-tech-stack)
- [Development](#-development)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

## ✨ Features

- **Real-Time Voice Conversation** â€” speak to the avatar using your microphone; it listens, thinks, and replies with synced speech
- **Streaming TTS** â€” OpenAI `gpt-4o-mini-tts` streams PCM audio for minimal latency
- **Amplitude-Driven Lip Sync** â€” RMS energy extracted from the PCM waveform modulates jaw opening in real time, so silence gaps close the mouth and stressed vowels open it wider
- **Stress-Aware Phoneme Timing** â€” CMU Pronouncing Dictionary + rule-based G2P assigns correct viseme durations based on syllable stress (primary/secondary/unstressed)
- **Two-Pass Refinement** â€” immediate text-estimated phonemes for instant playback; background Rhubarb analysis refines accuracy mid-speech
- **Ready Player Me Avatar** â€” full-body GLB rendered in Three.js with `mouthOpen` / `mouthSmile` blend-shape animation
- **Look-Ahead Blending** â€” next queued viseme bleeds 20 % into the current frame for organic transition feel
- **Interrupt & Continue** â€” tap the mic button mid-response to interrupt the avatar and speak immediately
- **Conversation History** â€” rolling 10-message context sent to GPT for coherent multi-turn dialogue
- **Zero Python** â€” pure Node.js / TypeScript stack, no native add-ons required- **Docker Support** — multi-stage optimized builds with automatic CI/CD via GitHub Actions
- **Production Ready** — deploy to Vercel, Azure App Service, or any Docker-compatible platform
- **Pre-built Images** — ready-to-use Docker images available on Docker Hub

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

## 🔗 Quick Links

- **GitHub Repository**: [avneetpandey82/lip-sync](https://github.com/avneetpandey82/lip-sync)
- **Docker Hub**: [avneetpandey82/lip-sync](https://hub.docker.com/r/avneetpandey82/lip-sync)
- **Quick Deploy**: Pull and run with `docker pull avneetpandey82/lip-sync:latest`

## 📋 Prerequisites

- **Node.js 18+**
- **OpenAI API key** with access to `gpt-4o-mini` and `gpt-4o-mini-tts`
- **Chrome or Edge** browser (Web Speech API for microphone input)
- _(Optional)_ Rhubarb Lip Sync binary for higher-accuracy phoneme refinement

## 🚀 Quick Start

> **Quick Deploy**: For immediate deployment, use the pre-built Docker image: `docker pull avneetpandey82/lip-sync:latest`. See [Docker Hub deployment](#docker-hub-pre-built-image) for details.

This guide covers local development with Node.js. For Docker deployment, see the [Deployment](#-deployment) section.

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

Required variables for all deployment modes:

```env
# Required
OPENAI_API_KEY=sk-...

# Optional
RHUBARB_AVAILABLE=false          # Set to "true" if Rhubarb binary is available
RHUBARB_PATH=/path/to/rhubarb    # Custom path (defaults to lib/rhubarb/rhubarb)
```

Create `.env.local` for local development or `.env` for Docker deployments. See `.env.example` for a template.

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

### Local Development

```bash
npm run dev
```

Open http://localhost:3000

---

### Docker (Local)

Build and run with Docker Compose:

```bash
# Create .env file with your OpenAI API key
echo "OPENAI_API_KEY=sk-..." > .env

# Build and start container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop container
docker-compose down
```

The app will be available at http://localhost:3000

**Optional**: To enable Rhubarb in Docker, add the Linux binary to `lib/rhubarb/rhubarb` before building, then set `RHUBARB_AVAILABLE=true` in your `.env` file.

---

### Docker Hub (Pre-built Image)

Pull and run the latest image from Docker Hub:

```bash
docker pull avneetpandey82/lip-sync:latest

docker run -d \
  -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e RHUBARB_AVAILABLE=false \
  --name lip-sync-avatar \
  avneetpandey82/lip-sync:latest
```

The image is automatically built and published on every push via GitHub Actions.

---

### Azure App Service

Deploy as a containerized web app:

#### 1. Create App Service

```bash
az group create --name lip-sync-rg --location eastus

az appservice plan create \
  --name lip-sync-plan \
  --resource-group lip-sync-rg \
  --is-linux \
  --sku B1

az webapp create \
  --name lip-sync-avatar \
  --resource-group lip-sync-rg \
  --plan lip-sync-plan \
  --deployment-container-image-name avneetpandey82/lip-sync:latest
```

#### 2. Configure Environment

```bash
az webapp config appsettings set \
  --resource-group lip-sync-rg \
  --name lip-sync-avatar \
  --settings \
    OPENAI_API_KEY=sk-... \
    RHUBARB_AVAILABLE=false \
    WEBSITES_PORT=3000
```

#### 3. Enable Continuous Deployment

Configure webhook for automatic updates when new Docker images are pushed:

```bash
az webapp deployment container config \
  --enable-cd true \
  --resource-group lip-sync-rg \
  --name lip-sync-avatar
```

Your app will be available at `https://lip-sync-avatar.azurewebsites.net`

---

### Vercel

Deploy serverless to Vercel:

```bash
npm i -g vercel
vercel env add OPENAI_API_KEY
vercel --prod
```

`vercel.json` is pre-configured with:

- 30-second function timeout for TTS streaming
- `RHUBARB_AVAILABLE=false` (Vercel serverless functions don't support binaries by default)

> **Note**: Rhubarb binary is not available in Vercel's serverless environment. The system automatically falls back to the CMU phoneme estimator.

---

## 🔄 CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/docker-publish.yml`) that:

- **Triggers** on every branch push and pull request
- **Builds** multi-stage Docker image with BuildKit cache
- **Pushes** to Docker Hub (branch name as tag + `latest` for main branch)
- **Injects** git branch and SHA into image labels
- **Caches** layers in GitHub Actions for faster rebuilds

**Required GitHub Secrets:**

- `DOCKERHUB_USERNAME` - Your Docker Hub username
- `DOCKERHUB_TOKEN` - Docker Hub access token

The workflow automatically publishes images in the format:

- `avneetpandey82/lip-sync:main` (main branch)
- `avneetpandey82/lip-sync:feature-name` (feature branches)
- `avneetpandey82/lip-sync:latest` (latest main build)

---

## 🔒 Security & Best Practices

### Environment Variables

- **Never commit** `.env.local` or `.env` files to version control
- Use `.env.example` as a template for required variables
- In production, use platform-specific secret management:
  - **Vercel**: Use Vercel environment variables
  - **Azure**: Use App Service Application Settings
  - **Docker**: Pass via `-e` flag or use secrets management

### API Key Security

- Rotate OpenAI API keys regularly
- Use separate keys for development and production
- Monitor API usage in OpenAI dashboard
- Set spending limits to prevent unexpected charges

### HTTPS & CORS

- Production deployments **require HTTPS** for:
  - Web Speech API (microphone access)
  - Web Audio API
  - Service Workers (if used)
- CORS is handled automatically by Next.js API routes

### Rate Limiting

The project includes basic rate limiting in `lib/rate-limiter.ts`. Consider implementing additional protection for production:
- API route rate limiting
- Per-user conversation limits
- OpenAI API cost caps

---

## 🛠️ Troubleshooting

| Symptom                         | Fix                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| "OpenAI API key not configured" | Check `.env.local` or `.env` and restart dev server / container                               |
| Mic button does nothing         | Use Chrome or Edge; grant microphone permission                                               |
| Avatar not loading              | Add `public/avatar.glb` (Ready Player Me export with Morph Targets)                           |
| Mouth stays closed              | Open browser DevTools → verify `mouthOpen`/`mouthSmile` morph targets are present in your GLB |
| Rhubarb not running             | Check binary path `lib/rhubarb/rhubarb(.exe)` and execute permission                          |
| No audio                        | HTTPS required in production; click mic to initialise AudioContext                            |
| Docker build fails              | Clear Docker build cache: `docker builder prune --all`                                        |
| Container exits immediately     | Check logs: `docker-compose logs` or `docker logs lip-sync-avatar`                            |
| 502 Bad Gateway (Azure)         | Check App Service logs; verify `WEBSITES_PORT=3000` is set                                    |

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
| Deployment   | Vercel, Docker, Azure App Service                       |
| CI/CD        | GitHub Actions (automated Docker Hub publishing)        |

---

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Docker Development

```bash
# Build image locally
docker build -t lip-sync-avatar .

# Run with docker-compose (recommended)
docker-compose up --build

# Run standalone container
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  lip-sync-avatar
```

### Environment Setup

1. Copy `.env.example` to `.env.local` (for local dev) or `.env` (for Docker)
2. Add your OpenAI API key
3. Optionally add Rhubarb binary to `lib/rhubarb/` for enhanced lip-sync accuracy

### Debug Route

Visit `/debug/avatar` to test avatar rendering and morph targets without the full conversation interface.

---

## 📄 License

MIT â€” free to use in personal and commercial projects.

## ™ Acknowledgments

- [OpenAI](https://openai.com) for streaming TTS and chat APIs
- [Daniel Wolf](https://github.com/DanielSWolf/rhubarb-lip-sync) for Rhubarb Lip Sync
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber) and [Drei](https://github.com/pmndrs/drei) communities
- [Ready Player Me](https://readyplayer.me) for the avatar format
- [CMU Pronouncing Dictionary](http://www.speech.cs.cmu.edu/cgi-bin/cmudict) for phoneme data
