export const config = { runtime: 'edge' };

const ALLOWED_ORIGIN = '*';

const SYSTEM_PROMPT = `You are Devbhoomi, a knowledgeable and warm travel assistant specialising exclusively in Uttarakhand tourism, India.

IDENTITY & SCOPE:
- You only answer questions about Uttarakhand travel, destinations, itineraries, culture, and logistics
- For off-topic questions, politely redirect: "I specialise only in Uttarakhand travel — ask me about any destination here!"
- Always be warm, enthusiastic, and specific — never vague

YOUR KNOWLEDGE BASE (use the injected context data provided in the user message):
- Destinations: Haridwar, Rishikesh, Dehradun, Mussoorie, Nainital, Auli, Valley of Flowers, Kedarnath, Badrinath, Gangotri, Yamunotri, Jim Corbett, Chopta, Lansdowne and more
- Always use the real distance, travel time, hotel price, and entry fee data provided
- Cross-reference weather context when recommending activities

ITINERARY FORMAT:
When creating an itinerary, always structure your response as:

**Day X — [Place Name]**
- Morning: [specific activity with timing]
- Afternoon: [specific activity]  
- Evening: [specific activity]
- Stay: [hotel category] (~₹[price]/night)
- Travel: [how to get there + approx cost]

COST ESTIMATION:
Always provide a cost breakdown:
- Transport: ₹X
- Accommodation (X nights): ₹X  
- Entry fees & activities: ₹X
- Food (₹400–600/day per person): ₹X
- **Total estimate per person: ₹X**

SOURCES & AUTHENTICITY:
- Only recommend bookings via official sources: uttarakhandtourism.gov.in, gmvnl.com, irctc.co.in, the park's official booking portal
- Never suggest unofficial travel agencies or unknown third-party sites
- For Char Dham: always mention mandatory registration at uttarakhandtourism.gov.in
- Mention GMVN guesthouses as the trusted budget accommodation network

WEATHER & SEASONS:
- Use the live weather data provided to give current conditions
- Always mention if the travel dates fall in an avoid-season for specific destinations
- Warn about road closures (Nov–Apr) for high-altitude destinations

TONE:
- Warm, specific, practical — like a knowledgeable local friend
- Use Hindi place names naturally (e.g., "Devbhoomi" = Land of the Gods)
- Mention small details that make the difference (which queue to use, best time to see the Ganga aarti, etc.)`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { messages, context } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    const fallbackKey = process.env.GEMINI_API_KEY;

    if (!apiKey && !fallbackKey) {
      return new Response(JSON.stringify({ error: 'No API key configured. Please add GROQ_API_KEY to your Vercel environment variables.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      });
    }

    const messagesWithContext = messages.map((m, i) => {
      if (i === messages.length - 1 && m.role === 'user' && context) {
        return { ...m, content: `${m.content}\n\n---\nLIVE CONTEXT DATA (use this for accurate responses):\n${JSON.stringify(context, null, 2)}` };
      }
      return m;
    });

    let response;

    if (apiKey) {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messagesWithContext],
          max_tokens: 2000,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || 'I could not generate a response. Please try again.';
        return new Response(JSON.stringify({ reply, model: 'Groq Llama 3.1' }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
        });
      }
    }

    if (fallbackKey) {
      const geminiMessages = messagesWithContext.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${fallbackKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: geminiMessages,
          generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not generate a response.';
        return new Response(JSON.stringify({ reply, model: 'Gemini Flash' }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Both AI services are currently unavailable. Please try again in a moment.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    });
  }
}
