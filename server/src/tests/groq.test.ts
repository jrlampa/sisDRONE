import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { analyzeImage } from '../services/groqService.js';

vi.mock('axios');

describe('Groq Service', () => {
  it('should process AI response correctly when content is a JSON string', async () => {
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

    expect((result as any).pole_type).toBe('Concreto');
    expect((result as any).confidence).toBe(0.95);
  });

  it('should process AI response correctly when content is already an object', async () => {
    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: {
                pole_type: "Madeira",
                structures: ["Isolador"],
                condition: "Atenção",
                confidence: 0.75,
                analysis_summary: "Poste de madeira com desgaste."
              }
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

    expect((result as any).pole_type).toBe('Madeira');
    expect((result as any).condition).toBe('Atenção');
  });

  it('should throw error if API fails', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('API Error'));

    await expect(analyzeImage('dummy_base64')).rejects.toThrow('Failed to analyze image');
  });

  describe('when GROQ_API_KEY is not set', () => {
    let originalKey: string | undefined;
    beforeEach(() => {
      originalKey = process.env.GROQ_API_KEY;
      delete process.env.GROQ_API_KEY;
    });
    afterEach(() => {
      if (originalKey !== undefined) process.env.GROQ_API_KEY = originalKey;
    });

    it('analyzeImage should throw GROQ_API_KEY is not defined', async () => {
      await expect(analyzeImage('test_b64')).rejects.toThrow('GROQ_API_KEY is not defined');
    });
  });
});
