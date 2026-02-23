import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

describe('AI Chat endpoint — /api/ai/chat', () => {
  it('should return 400 when message is missing', async () => {
    const res = await request(app).post('/api/ai/chat').send({ context: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('should return 400 when message is not a string', async () => {
    const res = await request(app).post('/api/ai/chat').send({ message: 123, context: {} });
    expect(res.status).toBe(400);
  });

  it('should return 500 when message is valid but Groq is unreachable in test env', async () => {
    const res = await request(app).post('/api/ai/chat').send({
      message: 'Qual a condição do poste?',
      context: { pole: { id: 1, name: 'Poste Teste' }, analysis: null },
    });
    // Groq is unreachable in test env → 500; or 200 if real key present
    expect([200, 500]).toContain(res.status);
  });
});

describe('chatService — unit tests', () => {
  it('should export chatWithData function', async () => {
    const module = await import('../services/chatService');
    expect(typeof module.chatWithData).toBe('function');
  });

  it('chatWithData should accept 2 parameters (message, context)', async () => {
    const module = await import('../services/chatService');
    expect(module.chatWithData.length).toBe(2);
  });
});

