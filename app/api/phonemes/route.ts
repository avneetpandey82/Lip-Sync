export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getPhonemeService } from '@/lib/services/phoneme-service';
import { estimateWithCMU } from '@/lib/services/phoneme-cmu';
import { AudioManager } from '@/lib/audio/audio-manager';

const phonemeService = getPhonemeService();

/**
 * Whether the Rhubarb binary is available in this environment.
 * Set RHUBARB_AVAILABLE=false in Vercel env vars to skip the binary attempt
 * and go straight to the CMU fallback.
 */
const RHUBARB_AVAILABLE = process.env.RHUBARB_AVAILABLE !== 'false';

export async function POST(req: Request) {
  try {
    const { audioBase64, transcript } = await req.json();

    if (!audioBase64) {
      return NextResponse.json(
        { error: 'Missing audioBase64 parameter' },
        { status: 400 }
      );
    }

    console.log(`[Phoneme API] Request: "${transcript?.slice(0, 50)}..." | rhubarb=${RHUBARB_AVAILABLE}`);

    // ── Attempt 1: Rhubarb binary (highest accuracy, local only) ──────────
    if (RHUBARB_AVAILABLE) {
      try {
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        console.log(`[Phoneme API] Audio: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

        const phonemes = await phonemeService.extractPhonemes(audioBuffer, transcript || '');
        console.log(`[Phoneme API] Rhubarb: ${phonemes.mouthCues.length} cues`);
        return NextResponse.json(phonemes);
      } catch (rhubarbError: any) {
        console.warn('[Phoneme API] Rhubarb failed, falling back to CMU:', rhubarbError?.message);
      }
    }

    // ── Fallback: CMU dictionary + G2P (serverless-safe) ──────────────────
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    // Estimate duration from PCM byte count (24 kHz, 16-bit mono = 48 000 bytes/s)
    const durationSeconds = audioBuffer.length / 48000;
    const phonemes = estimateWithCMU(transcript || '', durationSeconds);
    console.log(`[Phoneme API] CMU: ${phonemes.mouthCues.length} cues (${durationSeconds.toFixed(2)}s)`);
    return NextResponse.json(phonemes);

  } catch (error: any) {
    console.error('[Phoneme API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to extract phonemes', details: error?.message },
      { status: 500 }
    );
  }
}
