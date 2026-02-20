# Rhubarb Lip Sync Setup Guide

## What is Rhubarb?

Rhubarb Lip Sync is a command-line tool that automatically creates 2D mouth animation from voice recordings. It analyzes audio files and produces appropriate mouth shapes (visemes) for accurate lip-sync.

**GitHub**: https://github.com/DanielSWolf/rhubarb-lip-sync
**License**: Open Source (MIT)

## Download Instructions

### Windows

1. **Navigate to Releases**:
   - Visit: https://github.com/DanielSWolf/rhubarb-lip-sync/releases
   - Find the latest release (e.g., v1.13.0)

2. **Download Windows Binary**:
   - Download: `Rhubarb-Lip-Sync-1.13.0-Windows.zip`
   - File size: ~20MB

3. **Extract**:
   - Unzip the archive
   - Find `rhubarb.exe` in the extracted folder

4. **Install in Project**:
   ```bash
   mkdir -p lib/rhubarb
   # Copy rhubarb.exe to lib/rhubarb/rhubarb.exe
   ```

### Linux

1. **Download Linux Binary**:
   - Visit: https://github.com/DanielSWolf/rhubarb-lip-sync/releases
   - Download: `Rhubarb-Lip-Sync-1.13.0-Linux.zip`

2. **Extract and Install**:

   ```bash
   unzip Rhubarb-Lip-Sync-1.13.0-Linux.zip
   mkdir -p lib/rhubarb
   cp rhubarb lib/rhubarb/rhubarb
   chmod +x lib/rhubarb/rhubarb
   ```

3. **Verify Installation**:
   ```bash
   ./lib/rhubarb/rhubarb --version
   ```

### macOS

1. **Download macOS Binary**:
   - Visit: https://github.com/DanielSWolf/rhubarb-lip-sync/releases
   - Download: `Rhubarb-Lip-Sync-1.13.0-macOS.zip`

2. **Extract and Install**:

   ```bash
   unzip Rhubarb-Lip-Sync-1.13.0-macOS.zip
   mkdir -p lib/rhubarb
   cp rhubarb lib/rhubarb/rhubarb
   chmod +x lib/rhubarb/rhubarb
   ```

3. **macOS Security Note**:
   - First run may require: System Preferences → Security & Privacy → Allow
   - Or run: `xattr -d com.apple.quarantine lib/rhubarb/rhubarb`

## Directory Structure

After installation, your project should have:

```
lip-sync/
├── lib/
│   └── rhubarb/
│       └── rhubarb       # (Linux/Mac) or rhubarb.exe (Windows)
└── ...
```

## Testing Rhubarb

### Manual Test (Optional)

1. **Create test audio** (save as `test.wav`):

   ```bash
   # Or download any WAV file
   ```

2. **Run Rhubarb**:

   ```bash
   # Windows
   lib/rhubarb/rhubarb.exe -f json test.wav

   # Linux/Mac
   ./lib/rhubarb/rhubarb -f json test.wav
   ```

3. **Expected Output**:
   ```json
   {
     "metadata": {
       "soundFile": "test.wav",
       "duration": 3.5
     },
     "mouthCues": [
       {"start": 0.00, "end": 0.15, "value": "X"},
       {"start": 0.15, "end": 0.30, "value": "A"},
       {"start": 0.30, "end": 0.45, "value": "B"},
       ...
     ]
   }
   ```

## Usage in Application

The application automatically calls Rhubarb via Node.js `child_process`:

```typescript
import { spawn } from "child_process";

const rhubarb = spawn("lib/rhubarb/rhubarb.exe", [
  "-f",
  "json",
  "--extendedShapes",
  "GHX",
  "audio.wav",
  "-d",
  "transcript text", // Optional but improves accuracy
]);
```

## Command-Line Options

### Basic Usage

```bash
rhubarb [options] <input-file>
```

### Common Options

- `-f json` - Output format: JSON (we use this)
- `-d "text"` - Dialog transcript (significantly improves accuracy)
- `--extendedShapes GHX` - Use 9 visemes instead of 8
- `-o output.json` - Output file (default: stdout)
- `--machineReadable` - Progress output for machines

### Example with Transcript

```bash
rhubarb -f json -d "Hello world" audio.wav
```

The transcript helps Rhubarb align phonemes more accurately.

## Viseme Output

Rhubarb outputs 9 visemes (with `--extendedShapes GHX`):

| Viseme | Meaning              | Example Sounds   |
| ------ | -------------------- | ---------------- |
| **X**  | Rest position        | Silence          |
| **A**  | Open mouth           | "ah" in "father" |
| **B**  | Lips together        | "m", "b", "p"    |
| **C**  | Slightly open        | "eh" in "bed"    |
| **D**  | Wide open            | "ay" in "day"    |
| **E**  | Rounded              | "oh" in "go"     |
| **F**  | Teeth on lip         | "f", "v"         |
| **G**  | Tongue between teeth | "th"             |
| **H**  | Very open            | "ee" in "see"    |

## Troubleshooting

### "Command not found" or "Spawn error"

**Solution**: Verify binary location and permissions

```bash
# Check file exists
ls -la lib/rhubarb/

# Make executable (Linux/Mac)
chmod +x lib/rhubarb/rhubarb

# Test directly
./lib/rhubarb/rhubarb --version
```

### "Permission denied" (Linux/Mac)

**Solution**: Make binary executable

```bash
chmod +x lib/rhubarb/rhubarb
```

### "Cannot open shared library" (Linux)

**Solution**: Install dependencies

```bash
# Ubuntu/Debian
sudo apt-get install libstdc++6

# Fedora/RHEL
sudo dnf install libstdc++
```

### macOS "Unidentified Developer" Warning

**Solution**: Allow the app

1. System Preferences → Security & Privacy
2. Look for "rhubarb was blocked"
3. Click "Allow Anyway"

Or use command:

```bash
xattr -d com.apple.quarantine lib/rhubarb/rhubarb
```

### Wrong Platform Binary

**Error**: Binary crashes or won't run

**Solution**: Ensure you downloaded the correct version:

- Windows development → Windows binary (rhubarb.exe)
- Vercel deployment → Linux binary (rhubarb)
- Local Mac dev → macOS binary (rhubarb)

The `phoneme-service.ts` detects platform automatically:

```typescript
const isWindows = os.platform() === "win32";
const binName = isWindows ? "rhubarb.exe" : "rhubarb";
```

## Performance

- **Processing Speed**: ~5-10x faster than real-time
  - 30 seconds of audio → 3-5 seconds to process
- **Accuracy**: 95%+ with transcript, 85%+ without
- **File Size**: Binary is ~20MB

## Deployment Considerations

### Vercel (Linux)

- Use **Linux binary** in production
- Place in `lib/rhubarb/rhubarb`
- Commit to Git (not in .gitignore)

### Docker

```dockerfile
# In Dockerfile
COPY lib/rhubarb/rhubarb /app/lib/rhubarb/rhubarb
RUN chmod +x /app/lib/rhubarb/rhubarb
```

### AWS Lambda

- May need to increase timeout (default 3s)
- Use Linux binary
- Consider /tmp directory for temp files

## Alternative: Build from Source

If binaries don't work, build from source:

```bash
# Install dependencies
sudo apt-get install cmake libboost-all-dev

# Clone and build
git clone https://github.com/DanielSWolf/rhubarb-lip-sync.git
cd rhubarb-lip-sync
cmake .
make
```

## Support

- **GitHub Issues**: https://github.com/DanielSWolf/rhubarb-lip-sync/issues
- **Documentation**: https://github.com/DanielSWolf/rhubarb-lip-sync/blob/master/README.md

## License

Rhubarb Lip Sync is open source under the MIT License.

---

You're now ready to use Rhubarb for production-grade lip-sync! 🎤
