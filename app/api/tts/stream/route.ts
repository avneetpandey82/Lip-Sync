export const runtime = 'nodejs'; // Required for streaming and full Node.js APIs

import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { text, voice = 'coral', speed = 1.0 } = await req.json();
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid text parameter' },
        { status: 400 }
      );
    }
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }
    
    console.log(`TTS request: "${text.slice(0, 50)}..." (voice: ${voice}, speed: ${speed})`);
    
    // Request streaming TTS from OpenAI
    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: voice as any, // alloy, echo, fable, onyx, nova, shimmer, coral, sage
      input: text,
      response_format: "pcm", // Fastest format - raw 16-bit PCM at 24kHz
      speed: speed
    });
    
    // Stream audio chunks directly to client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/pcm',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'X-Sample-Rate': '24000',
        'X-Bit-Depth': '16',
        'X-Channels': '1'
      }
    });
    
  } catch (error: any) {
    console.error('TTS streaming error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate speech',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
