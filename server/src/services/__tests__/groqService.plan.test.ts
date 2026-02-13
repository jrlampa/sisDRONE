import { describe, it, expect, vi } from 'vitest';
import { generateMaintenancePlan } from '../groqService';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as any;

describe('groqService - generateMaintenancePlan', () => {
  const mockAnalysis = {
    pole_type: 'Concreto',
    condition: 'Danificado',
    structures: ['Cruzeta', 'Isolador'],
    confidence: 0.9,
    analysis_summary: 'Poste com fissuras.'
  };

  it('should call Groq API with correct prompt and return plan', async () => {
    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: '# Plano de Manutenção\n\n1. Diagnóstico: Crítico.'
            }
          }
        ]
      }
    };

    mockedAxios.post.mockResolvedValue(mockResponse);

    const plan = await generateMaintenancePlan(mockAnalysis);

    expect(plan).toContain('# Plano de Manutenção');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        model: 'llama-3.3-70b-versatile',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Atue como um Engenheiro Elétrico Sênior')
          })
        ])
      }),
      expect.any(Object)
    );
  });

  it('should throw error if API fails', async () => {
    mockedAxios.post.mockRejectedValue(new Error('API Error'));

    await expect(generateMaintenancePlan(mockAnalysis)).rejects.toThrow('Failed to generate maintenance plan');
  });
});
