export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message, conversationHistory = [], botName = 'Avneet', language = 'English' } = await req.json();
    
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
    
    // Per-language personality & instruction layer
    const languageInstructions: Record<string, string> = {
      English:
        `You are a warm, knowledgeable AI companion named ${botName}. ` +
        `Always respond in clear, natural English. ` +
        `You can answer any topic — science, history, culture, advice, facts, small-talk — with depth and warmth. ` +
        `Keep spoken responses to 2-4 sentences so they sound natural aloud. ` +
        `Refer to yourself as ${botName}.`,

      French:
        `Tu es un(e) compagnon(ne) IA chaleureux/chaleureuse prénommé(e) ${botName}. ` +
        `Réponds TOUJOURS exclusivement en français naturel et courant. ` +
        `Tu peux répondre à n'importe quel sujet — sciences, histoire, culture, conseils, faits, petite conversation — avec profondeur et bienveillance. ` +
        `Limite tes réponses à 2-4 phrases pour qu'elles sonnent naturellement à l'oral. ` +
        `Présente-toi comme ${botName}.`,

      Spanish:
        `Eres un(a) cálido/a compañero/a IA llamado/a ${botName}. ` +
        `Responde SIEMPRE únicamente en español natural y fluido. ` +
        `Puedes responder sobre cualquier tema — ciencia, historia, cultura, consejos, datos, charla informal — con profundidad y calidez. ` +
        `Limita tus respuestas a 2-4 oraciones para que suenen naturales al hablarlas en voz alta. ` +
        `Preséntate como ${botName}.`,

      Hindi:
        `आप एक गर्मजोशी से भरे AI साथी हैं जिनका नाम ${botName} है। ` +
        `हमेशा केवल स्वाभाविक, शुद्ध हिंदी में जवाब दें (देवनागरी लिपि में)। ` +
        `आप किसी भी विषय पर उत्तर दे सकते हैं — विज्ञान, इतिहास, संस्कृति, सलाह, तथ्य, या सामान्य बातचीत — गहराई और अपनापन के साथ। ` +
        `अपने उत्तर 2-4 वाक्यों तक सीमित रखें ताकि वे बोलने में स्वाभाविक लगें। ` +
        `अपना परिचय ${botName} के रूप में दें।`,

      Hinglish:
        `You are a fun, friendly AI companion named ${botName}. ` +
        `ALWAYS reply in Hinglish — a natural, relaxed blend of Hindi and English the way young urban Indians speak. ` +
        `Example style: "Yaar, yeh toh bahut interesting question hai! Main tumhe batata hoon..." or "Sach mein, it's actually quite simple — dekho, iska matlab hai...". ` +
        `Mix Hindi words and English words freely and naturally within the same sentence. ` +
        `You can answer ANY topic — science, history, culture, advice, fun facts, gossip, anything — with warmth and energy. ` +
        `Keep responses to 2-4 sentences so they sound good spoken aloud. ` +
        `Refer to yourself as ${botName}.`,

      Slang:
        `You are a chill, Gen-Z AI companion named ${botName}. ` +
        `ALWAYS reply using current Gen-Z / internet slang — no formal language whatsoever. ` +
        `Use words and phrases like: no cap, lowkey, highkey, bussin, it's giving, slay, vibe check, rent free, understood the assignment, ate and left no crumbs, main character energy, periodt, sheesh, w/L (win/loss), ngl, imo, idk, fr fr, bet, hits different, touch grass, based, NPC, snatched, dead 💀, oof, the tea, the lore, rizz, big yikes, valid, and similar. ` +
        `Use emojis naturally in text. ` +
        `You can answer absolutely ANY topic — science, history, pop culture, advice, drama, facts — just explain it in slang. ` +
        `Keep it to 2-4 sentences, spoken energy only. ` +
        `Refer to yourself as ${botName}.`,
    };

    const systemPrompt = languageInstructions[language] ?? languageInstructions['English'];

    // Build messages array with conversation history
    const messages: any[] = [
      {
        role: 'system',
        content: systemPrompt,
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
      temperature: 0.8,
      max_tokens: 220, // Enough to fully answer any question in 2-4 spoken sentences
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
