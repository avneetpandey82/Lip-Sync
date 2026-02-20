export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getPhonemeService } from '@/lib/services/phoneme-service';

const phonemeService = getPhonemeService();

export async function POST(req: Request) {
  try {
    const { text, duration } = await req.json();
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid text parameter' },
        { status: 400 }
      );
    }
    
    if (typeof duration !== 'number' || duration <= 0) {
      return NextResponse.json(
        { error: 'Missing or invalid duration parameter (must be positive number in seconds)' },
        { status: 400 }
      );
    }
    
    console.log(`Phoneme estimation request: "${text.slice(0, 50)}..." (${duration}s)`);
    
    // Generate estimated phonemes from text
    const phonemes = phonemeService.estimateFromText(text, duration);
    
    return NextResponse.json(phonemes);
    
  } catch (error: any) {
    console.error('Phoneme estimation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to estimate phonemes',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
