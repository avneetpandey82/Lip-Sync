# 🚀 Final Setup Checklist

Use this checklist to get your lip-sync avatar running:

## Step 1: Dependencies ⏳

```bash
npm install
```

- [ ] Run the command above
- [ ] Wait for it to complete (1-2 minutes)
- [ ] Verify `node_modules` folder appears

## Step 2: OpenAI API Key 🔑

- [ ] Visit https://platform.openai.com/api-keys
- [ ] Create or copy your API key
- [ ] Open `.env.local` in the project root
- [ ] Replace `your-openai-api-key-here` with your actual key
- [ ] Save the file

Your `.env.local` should look like:

```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
```

## Step 3: Rhubarb Binary 📥

- [ ] Visit https://github.com/DanielSWolf/rhubarb-lip-sync/releases/latest
- [ ] Download the Windows version: `Rhubarb-Lip-Sync-X.X.X-Windows.zip`
- [ ] Extract the ZIP file
- [ ] Find `rhubarb.exe` in the extracted folder
- [ ] Copy `rhubarb.exe` to: `lib/rhubarb/rhubarb.exe` in your project

Check the file is in the right place:

```
lip-sync/
└── lib/
    └── rhubarb/
        └── rhubarb.exe  ← Should be here!
```

## Step 4: Start Development Server 🖥️

```bash
npm run dev
```

- [ ] Run the command above
- [ ] Wait for "Ready" message
- [ ] Open browser to http://localhost:3000

## Step 5: Test It! 🎤

- [ ] You see the 3D avatar on the left
- [ ] Text input is on the right
- [ ] Click "🎙️ Speak" button
- [ ] Audio plays and avatar mouth moves!

## ✅ Success Indicators

When working correctly, you'll see:

1. Status changes to "Speaking"
2. Progress messages: "Streaming audio...", "Playing...", "Refining lip-sync..."
3. Current Viseme changes (X → A → B → C, etc.)
4. Audio plays from your speakers
5. Avatar mouth moves in sync with speech

## ❌ Common Issues

### "Cannot find module 'next/server'"

**Cause**: Dependencies not installed
**Fix**: Run `npm install` and wait for completion

### "OpenAI API key not configured"

**Cause**: Missing or incorrect API key in `.env.local`
**Fix**:

1. Check file exists: `.env.local`
2. Check key format: `OPENAI_API_KEY=sk-...`
3. Restart server: Stop (Ctrl+C) and run `npm run dev` again

### "Rhubarb spawn error"

**Cause**: Rhubarb binary not found
**Fix**:

1. Check file exists: `lib/rhubarb/rhubarb.exe`
2. Download from GitHub releases if missing
3. Place in correct location

### TypeScript errors in VS Code

**Cause**: Dependencies still installing or VS Code needs reload
**Fix**:

1. Wait for `npm install` to complete
2. Reload VS Code: Ctrl+Shift+P → "Reload Window"

## 📄 Documentation

- **Getting Started**: `QUICKSTART.md`
- **Full Documentation**: `README.md`
- **Rhubarb Setup**: `RHUBARB_SETUP.md`
- **What's Next**: `NEXT_STEPS.md`

## 🆘 Still Stuck?

1. Check browser console: Press F12, look for errors
2. Check terminal: Look for error messages
3. Verify all 3 steps above are complete
4. Try a different browser (Chrome recommended)

---

**Estimated time to complete**: 5-10 minutes

**You're almost there! 🎉**
