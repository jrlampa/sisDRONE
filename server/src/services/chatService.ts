import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function chatWithData(message: string, context: any): Promise<string> {
  const systemPrompt = `
    You are SisDRONE Assistant, an expert AI for electrical distribution network maintenance.
    
    Current Context:
    User is inspecting a Pole/Asset with the following data:
    ${JSON.stringify(context, null, 2)}
    
    Instructions:
    1. Answer the user's question based strictly on the provided context if possible.
    2. If the context has a maintenance plan, refer to it.
    3. If asked about costs, refer to the estimated cost in the context.
    4. Be concise, professional, and helpful.
    5. Reply in Portuguese (PT-BR).
  `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      max_tokens: 500,
    });

    return completion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua pergunta.';
  } catch (error) {
    console.error('Groq Chat Error:', error);
    throw new Error('Failed to chat with AI');
  }
}
