/**
 * Coverage tests for chatService.ts branches:
 * - lines 10-11: getGroqClient returns null when no GROQ_API_KEY
 * - line 35:     chatWithData throws when groq client is null
 * - line 49:     fallback string when completion.choices[0].message.content is falsy
 *
 * Uses vi.resetModules() to force re-evaluation of the module-level `groq` const.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('chatService — null groq client (no GROQ_API_KEY)', () => {
  const originalKey = process.env.GROQ_API_KEY;

  beforeEach(() => {
    delete process.env.GROQ_API_KEY;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalKey !== undefined) process.env.GROQ_API_KEY = originalKey;
    vi.resetModules();
  });

  it('chatWithData should throw "AI Service unavailable" when no API key', async () => {
    // Re-import after clearing module registry so groq const is re-evaluated as null
    const { chatWithData } = await import('./chatService.js');
    await expect(chatWithData('test', {})).rejects.toThrow('AI Service unavailable (missing API Key)');
  });
});

describe('chatService — null content fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    // Ensure GROQ_API_KEY is truthy so getGroqClient returns a mock instance
    process.env.GROQ_API_KEY = 'mock-key-for-testing';
  });

  afterEach(() => {
    delete process.env.GROQ_API_KEY;
    vi.resetModules();
  });

  it('chatWithData should return fallback string when content is null', async () => {
    // Mock the groq-sdk module BEFORE importing chatService
    vi.doMock('groq-sdk', () => {
      return {
        default: class MockGroq {
          chat = {
            completions: {
              create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: null } }],
              }),
            },
          };
        },
      };
    });

    const { chatWithData } = await import('./chatService.js');
    const result = await chatWithData('Qual o status do poste?', { pole: { id: 1 } });
    expect(result).toBe('Desculpe, não consegui processar sua pergunta.');
  });
});
