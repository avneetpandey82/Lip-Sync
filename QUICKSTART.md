# Quick Start Guide

Get your lip-sync avatar running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

Wait for all packages to download (~1-2 minutes).

## Step 2: Get OpenAI API Key

1. Visit: https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-...`)

## Step 3: Configure Environment

Create `.env.local` in the project root:

```env
OPENAI_API_KEY=sk-your-key-here
```

**Important**: Replace `sk-your-key-here` with your actual API key!

## Step 4: Download Rhubarb

### Windows:

1. Download: https://github.com/DanielSWolf/rhubarb-lip-sync/releases/latest
2. Get `Rhubarb-Lip-Sync-X.X.X-Windows.zip`
3. Extract `rhubarb.exe`
4. Create folder: `lib/rhubarb/`
5. Place file at: `lib/rhubarb/rhubarb.exe`

### Linux/Mac:

```bash
# Download from: https://github.com/DanielSWolf/rhubarb-lip-sync/releases/latest
mkdir -p lib/rhubarb
# Move downloaded binary to lib/rhubarb/rhubarb
chmod +x lib/rhubarb/rhubarb
```

## Step 5: Run Development Server

```bash
npm run dev
```

Open your browser to: **http://localhost:3000**

## Step 6: Test It!

1. You'll see a 3D avatar on the left
2. Text input on the right (pre-filled with example text)
3. Click the **"🎙️ Speak"** button
4. Watch the avatar speak with lip-sync!

## Troubleshooting

### ❌ "OpenAI API key not configured"

- Check `.env.local` exists in project root
- Verify key starts with `sk-`
- Restart dev server: `Ctrl+C` then `npm run dev`

### ❌ "Rhubarb spawn error"

- Verify file exists: `lib/rhubarb/rhubarb.exe` (Windows) or `lib/rhubarb/rhubarb` (Linux/Mac)
- Check permissions: `chmod +x lib/rhubarb/rhubarb` (Linux/Mac)
- See full setup guide: `RHUBARB_SETUP.md`

### ❌ "Cannot find module"

- Run: `npm install` again
- Delete `node_modules` and `.next`, then `npm install`

### ❌ No audio playing

- Check browser console (F12)
- Try a different browser (Chrome/Edge recommended)
- Click button again (audio context needs user interaction)

## Next Steps

- ✅ Try different voices (dropdown menu)
- ✅ Adjust speech speed (slider)
- ✅ Enter your own text
- ✅ Watch the debug panel for viseme changes

## Customization

Want to use your own 3D model? See `README.md` section "Replace Placeholder Avatar".

## Need Help?

- Full documentation: `README.md`
- Rhubarb setup: `RHUBARB_SETUP.md`
- Check browser console for errors (F12)

---

Enjoy your real-time lip-sync avatar! 🎤
