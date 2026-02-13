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
    Você é um especialista em infraestrutura de rede de distribuição elétrica.
    Analise a imagem fornecida de um poste ou rede elétrica.
    Identifique:
    1. O tipo de poste (concreto, madeira, aço).
    2. As estruturas presentes (transformadores, isoladores, para-raios, tipos de braçadeiras).
    3. A condição (boa, danificada, inclinado).
    
    Responda em formato JSON com os seguintes campos (em Português):
    {
      "pole_type": String,
      "structures": [String],
      "condition": String,
      "confidence": Number (0-1),
      "analysis_summary": String
    }
    Importante: Todos os valores de texto devem estar em Português do Brasil (PT-BR).
  `;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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

export async function generateMaintenancePlan(analysis: any) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not defined');
  }

  const prompt = `
    Atue como um Engenheiro Elétrico Sênior especializado em manutenção de redes de distribuição.
    Com base na análise técnica abaixo, gere um Plano de Manutenção detalhado.

    DADOS DA ANÁLISE:
    ${JSON.stringify(analysis, null, 2)}

    O SEU RELATÓRIO DEVE CONTER:
    1. **Diagnóstico Técnico**: Resumo profissional da situação e riscos associados.
    2. **Ação Recomendada**: Passo-a-passo técnico para a equipe de campo (ex: "Desenergizar o circuito", "Substituir cruzeta").
    3. **Lista de Materiais Estimada**: Sugestão de materiais compatíveis com o tipo de estrutura identificado.
    4. **Prioridade sugerida**: (Alta/Média/Baixa) com justificativa baseada em risco à segurança ou continuidade do fornecimento.

    Use formatação Markdown para deixar o texto claro e legível. Seja direto e técnico.
  `;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
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
    console.error('Error generating maintenance plan:', error.response?.data || error.message);
    throw new Error('Failed to generate maintenance plan');
  }
}
