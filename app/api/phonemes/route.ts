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
    
    console.log(`Phoneme extraction request (transcript: "${transcript?.slice(0, 30)}...")`);
    
    // Decode base64 audio
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    
    // Extract phonemes using Rhubarb
    const phonemes = await phonemeService.extractPhonemes(
      audioBuffer,
      transcript || ''
    );
    
    console.log(`Extracted ${phonemes.mouthCues.length} mouth cues`);
    
    return NextResponse.json(phonemes);
    
  } catch (error: any) {
    console.error('Phoneme extraction error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to extract phonemes',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
