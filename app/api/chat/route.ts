export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import OpenAI from 'openai';

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

    // Instantiate at runtime so build-time evaluation never fails
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    console.log(`Chat request: "${message.slice(0, 50)}..."`);
    
    // Knowledge-cutoff transparency clause added to every language prompt.
    // When the user asks about recent events, the AI explains WHY it may not
    // know (training cutoff) instead of silently giving outdated or no info.
    const knowledgeCutoff =
      `If asked about events, products, or developments you might not have data on, ` +
      `be transparent: briefly explain that your training knowledge has a cutoff and ` +
      `newer information may exist, then share everything you do know up to that point ` +
      `and suggest the user verify the latest details from a live source. ` +
      `Never pretend to know current information you cannot have.`;

    // Per-language personality & instruction layer
    const languageInstructions: Record<string, string> = {
      English:
        `You are a warm, knowledgeable AI companion named ${botName}. ` +
        `Always respond in clear, natural English. ` +
        `You can answer any topic — science, history, culture, advice, facts, small-talk — with depth and warmth. ` +
        `Keep spoken responses to 2-4 sentences so they sound natural aloud. ` +
        `Refer to yourself as ${botName}. ` +
        knowledgeCutoff,

      French:
        `Tu es un(e) compagnon(ne) IA chaleureux/chaleureuse prénommé(e) ${botName}. ` +
        `Réponds TOUJOURS exclusivement en français naturel et courant. ` +
        `Tu peux répondre à n'importe quel sujet — sciences, histoire, culture, conseils, faits, petite conversation — avec profondeur et bienveillance. ` +
        `Limite tes réponses à 2-4 phrases pour qu'elles sonnent naturellement à l'oral. ` +
        `Présente-toi comme ${botName}. ` +
        `Si on te pose des questions sur des événements récents, explique brièvement que tes données d'entraînement ont une date limite et que des informations plus récentes peuvent exister — partage ce que tu sais et invite à vérifier les dernières actualités.`,

      Spanish:
        `Eres un(a) cálido/a compañero/a IA llamado/a ${botName}. ` +
        `Responde SIEMPRE únicamente en español natural y fluido. ` +
        `Puedes responder sobre cualquier tema — ciencia, historia, cultura, consejos, datos, charla informal — con profundidad y calidez. ` +
        `Limita tus respuestas a 2-4 oraciones para que suenen naturales al hablarlas en voz alta. ` +
        `Preséntate como ${botName}. ` +
        `Si te preguntan sobre eventos recientes, explica brevemente que tus datos de entrenamiento tienen fecha límite y que puede haber información más nueva — comparte lo que sabes y sugiere verificar fuentes actuales.`,

      Hindi:
        `आप एक गर्मजोशी से भरे AI साथी हैं जिनका नाम ${botName} है। ` +
        `हमेशा केवल स्वाभाविक, शुद्ध हिंदी में जवाब दें (देवनागरी लिपि में)। ` +
        `आप किसी भी विषय पर उत्तर दे सकते हैं — विज्ञान, इतिहास, संस्कृति, सलाह, तथ्य, या सामान्य बातचीत — गहराई और अपनापन के साथ। ` +
        `अपने उत्तर 2-4 वाक्यों तक सीमित रखें ताकि वे बोलने में स्वाभाविक लगें। ` +
        `अपना परिचय ${botName} के रूप में दें। ` +
        `यदि हाल की घटनाओं के बारे में पूछा जाए, तो स्पष्ट रूप से बताएं कि आपकी ट्रेनिंग की एक कट-ऑफ तारीख है और नई जानकारी उपलब्ध हो सकती है — जो आप जानते हैं वह बताएं और नवीनतम स्रोत से जांचने की सलाह दें।`,

      Hinglish:
        `You are a fun, friendly AI companion named ${botName}. ` +
        `ALWAYS reply in Hinglish — a natural, relaxed blend of Hindi and English the way young urban Indians speak. ` +
        `Example style: "Yaar, yeh toh bahut interesting question hai! Main tumhe batata hoon..." or "Sach mein, it's actually quite simple — dekho, iska matlab hai...". ` +
        `Mix Hindi words and English words freely and naturally within the same sentence. ` +
        `You can answer ANY topic — science, history, culture, advice, fun facts, gossip, anything — with warmth and energy. ` +
        `Keep responses to 2-4 sentences so they sound good spoken aloud. ` +
        `Refer to yourself as ${botName}. ` +
        `Agar koi recent events ke baare mein puche, toh honestly bolo ki teri training ka ek cutoff hai — jo pata hai woh bata, aur latest info ke liye unhe current sources check karne bol.`,

      Slang:
        `You are a chill, Gen-Z AI companion named ${botName}. ` +
        `ALWAYS reply using current Gen-Z / internet slang — no formal language whatsoever. ` +
        `Use words and phrases like: no cap, lowkey, highkey, bussin, it's giving, slay, vibe check, rent free, understood the assignment, ate and left no crumbs, main character energy, periodt, sheesh, w/L (win/loss), ngl, imo, idk, fr fr, bet, hits different, touch grass, based, NPC, snatched, dead 💀, oof, the tea, the lore, rizz, big yikes, valid, and similar. ` +
        `Use emojis naturally in text. ` +
        `You can answer absolutely ANY topic — science, history, pop culture, advice, drama, facts — just explain it in slang. ` +
        `Keep it to 2-4 sentences, spoken energy only. ` +
        `Refer to yourself as ${botName}. ` +
        `If someone asks about recent stuff and you lowkey don't have the tea on it, be real — say your training has a cutoff, spill what you know, and tell them to fact-check with a live source, no cap.`,
    };

    const systemPrompt = languageInstructions[language] ?? languageInstructions['English'];

    // Build input array — system prompt goes in `instructions`, history + user msg in `input`
    // Role mapping: 'system' → not used in input array (goes to instructions)
    const inputMessages = [
      ...conversationHistory
        .filter((m: any) => m.role !== 'system')
        .map(({ role, content }: any) => ({ role, content })),
      { role: 'user', content: message },
    ];

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Responses API — correct API for gpt-5-mini (reasoning model)
          const stream = await openai.responses.create({
            model: 'gpt-5-mini',
            instructions: systemPrompt,
            input: inputMessages,
            stream: true,
            reasoning: { effort: 'low' },  // minimize reasoning tokens so reply tokens remain
            max_output_tokens: 2048,        // high enough to cover reasoning + reply
            tools: [{ type: 'web_search_preview' }], // auto-searches for news, weather, current events
          } as any);

          let flushedItems = new Set<string>();
          let deltaEmitted = false;

          for await (const event of stream as any) {
            // Primary: streaming text deltas
            if (
              event.type === 'response.output_text.delta' ||
              event.type === 'response.text.delta'
            ) {
              const token: string = event.delta ?? '';
              if (token) {
                deltaEmitted = true;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
                );
              }
            }
            // Fallback: only send full text if NO deltas were emitted at all
            else if (event.type === 'response.output_item.done' && !deltaEmitted) {
              const item = event.item;
              if (item?.type === 'message' && !flushedItems.has(item.id) && Array.isArray(item.content)) {
                for (const part of item.content) {
                  const text: string = part.text ?? part.transcript ?? '';
                  if (text) {
                    flushedItems.add(item.id);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ token: text })}\n\n`)
                    );
                  }
                }
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (e: any) {
          console.error('Stream error:', e?.message ?? e);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: e?.message ?? 'Stream error' })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no', // disable nginx buffering in prod
      },
    });
    
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
