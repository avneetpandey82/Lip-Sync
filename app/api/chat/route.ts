export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message, conversationHistory = [], botName = 'Avneet' } = await req.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid message parameter' },
        { status: 400 }
      );
    }
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }
    
    console.log(`Chat request: "${message.slice(0, 50)}..."`);
    
    // Build messages array with conversation history
    const messages: any[] = [
      {
        role: 'system',
        content: `You are a warm, engaging AI companion named ${botName}. Keep responses conversational, concise (2-3 sentences), and natural. Refer to yourself as ${botName} when introducing yourself. Be helpful and engaging.`
      },
      ...conversationHistory,
      {
        role: 'user',
        content: message
      }
    ];
    
    // Get AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 150, // Keep responses short for speech
    });
    
    const reply = completion.choices[0]?.message?.content || 'I apologize, I did not understand that.';
    
    console.log(`AI response: "${reply.slice(0, 50)}..."`);
    
    return NextResponse.json({ reply });
    
  } catch (error: any) {
    console.error('Chat error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate response',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
