import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { analyzeImage } from '../services/groqService.js';

vi.mock('axios');

describe('Groq Service', () => {
  it('should process AI response correctly', async () => {
    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                pole_type: "Concreto",
                structures: ["Transformador"],
                condition: "Boa",
                confidence: 0.95,
                analysis_summary: "Poste de concreto em excelente estado."
              })
            }
          }
        ]
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {}
    };

    vi.mocked(axios.post).mockResolvedValue(mockResponse as any);

    const result = await analyzeImage('dummy_base64');
    const parsed = JSON.parse(result as string);

    expect(parsed.pole_type).toBe('Concreto');
    expect(parsed.confidence).toBe(0.95);
  });

  it('should throw error if API fails', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('API Error'));

    await expect(analyzeImage('dummy_base64')).rejects.toThrow('Failed to analyze image');
  });
});
