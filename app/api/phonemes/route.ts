export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getPhonemeService } from '@/lib/services/phoneme-service';

const phonemeService = getPhonemeService();

export async function POST(req: Request) {
  try {
    const { audioBase64, transcript } = await req.json();
    
    if (!audioBase64) {
      return NextResponse.json(
        { error: 'Missing audioBase64 parameter' },
        { status: 400 }
      );
    }
    
    console.log(`[Phoneme API] Extraction request: "${transcript?.slice(0, 50)}..."`);
    
    // Decode base64 audio
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    console.log(`[Phoneme API] Audio buffer size: ${audioBuffer.length} bytes (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
    
    // Extract phonemes using Rhubarb
    const phonemes = await phonemeService.extractPhonemes(
      audioBuffer,
      transcript || ''
    );
    
    console.log(`[Phoneme API] Extracted ${phonemes.mouthCues.length} mouth cues`);
    if (phonemes.mouthCues.length > 0) {
      console.log(`[Phoneme API] First cue: ${phonemes.mouthCues[0].value} at ${phonemes.mouthCues[0].start.toFixed(3)}s`);
      console.log(`[Phoneme API] Last cue: ${phonemes.mouthCues[phonemes.mouthCues.length - 1].value} at ${phonemes.mouthCues[phonemes.mouthCues.length - 1].end.toFixed(3)}s`);
    }
    
    return NextResponse.json(phonemes);
    
  } catch (error: any) {
    console.error('[Phoneme API] Extraction error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to extract phonemes',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
