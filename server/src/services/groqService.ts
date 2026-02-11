import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function analyzeImage(imageBase64: string) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not defined');
  }

  const prompt = `
    You are an expert in electrical power distribution infrastructure.
    Analyze the provided image of a power pole or electrical network.
    Identify:
    1. The type of pole (concrete, wood, steel).
    2. The structures present (transformers, insulators, lightning arresters, bracket types).
    3. The condition (good, damaged, leaning).
    
    Respond in JSON format with the following fields:
    {
      "pole_type": String,
      "structures": [String],
      "condition": String,
      "confidence": Number (0-1),
      "analysis_summary": String
    }
  `;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return (response.data as any).choices[0].message.content;
  } catch (error: any) {
    console.error('Error analyzing image with Groq:', error.response?.data || error.message);
    throw new Error('Failed to analyze image');
  }
}
