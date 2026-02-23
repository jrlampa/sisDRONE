import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';

process.env.NODE_ENV = 'test';

let createdOrderId: number;

describe('Work Orders CRUD — /api/work-orders', () => {
  // ── POST ─────────────────────────────────────────────────────────
  it('POST /api/work-orders deve retornar 400 se título ausente', async () => {
    const res = await request(app).post('/api/work-orders').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/work-orders deve retornar 400 se assignee_id inválido', async () => {
    const res = await request(app).post('/api/work-orders').send({
      title: 'Ordem Teste',
      assignee_id: 'abc',
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/work-orders deve criar uma ordem com dados válidos', async () => {
    const res = await request(app).post('/api/work-orders').send({
      title: 'Manutenção Preventiva',
      description: 'Verificar estado do poste',
      priority: 'HIGH',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Manutenção Preventiva');
    expect(res.body.status).toBe('OPEN');
    createdOrderId = res.body.id;
  });

  // ── GET / ─────────────────────────────────────────────────────────
  it('GET /api/work-orders deve retornar objeto paginado', async () => {
    const res = await request(app).get('/api/work-orders');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('work_orders');
    expect(Array.isArray(res.body.work_orders)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 50);
  });

  it('GET /api/work-orders?status=OPEN deve filtrar por status', async () => {
    const res = await request(app).get('/api/work-orders?status=OPEN');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.work_orders)).toBe(true);
    for (const order of res.body.work_orders) {
      expect(order.status).toBe('OPEN');
    }
  });

  it('GET /api/work-orders?status=INVALID deve retornar 400', async () => {
    const res = await request(app).get('/api/work-orders?status=INVALID');
    expect(res.status).toBe(400);
  });

  it('GET /api/work-orders?assignee_id=abc deve retornar 400', async () => {
    const res = await request(app).get('/api/work-orders?assignee_id=abc');
    expect(res.status).toBe(400);
  });

  // ── GET /:id ─────────────────────────────────────────────────────
  it('GET /api/work-orders/:id deve retornar 400 para id não numérico', async () => {
    const res = await request(app).get('/api/work-orders/abc');
    expect(res.status).toBe(400);
  });

  it('GET /api/work-orders/:id deve retornar 404 para id inexistente', async () => {
    const res = await request(app).get('/api/work-orders/999999');
    expect(res.status).toBe(404);
  });

  it('GET /api/work-orders/:id deve retornar a ordem criada', async () => {
    const res = await request(app).get(`/api/work-orders/${createdOrderId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdOrderId);
    expect(res.body.title).toBe('Manutenção Preventiva');
  });

  // ── PUT /:id ─────────────────────────────────────────────────────
  it('PUT /api/work-orders/:id deve retornar 400 para id inválido', async () => {
    const res = await request(app).put('/api/work-orders/abc').send({ status: 'OPEN' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/work-orders/:id deve retornar 400 para status inválido', async () => {
    const res = await request(app).put(`/api/work-orders/${createdOrderId}`).send({ status: 'NOPE' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/work-orders/:id deve retornar 400 se nenhum campo enviado', async () => {
    const res = await request(app).put(`/api/work-orders/${createdOrderId}`).send({});
    expect(res.status).toBe(400);
  });

  it('PUT /api/work-orders/:id deve atualizar status e prioridade', async () => {
    const res = await request(app).put(`/api/work-orders/${createdOrderId}`).send({
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.priority).toBe('CRITICAL');
  });

  // ── DELETE /:id ───────────────────────────────────────────────────
  it('DELETE /api/work-orders/:id deve retornar 400 para id inválido', async () => {
    const res = await request(app).delete('/api/work-orders/abc');
    expect(res.status).toBe(400);
  });

  it('DELETE /api/work-orders/:id deve retornar 404 para id inexistente', async () => {
    const res = await request(app).delete('/api/work-orders/999999');
    expect(res.status).toBe(404);
  });

  it('DELETE /api/work-orders/:id deve remover a ordem criada', async () => {
    const res = await request(app).delete(`/api/work-orders/${createdOrderId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.id).toBe(createdOrderId);
  });

  it('GET /api/work-orders/:id deve retornar 404 após exclusão', async () => {
    const res = await request(app).get(`/api/work-orders/${createdOrderId}`);
    expect(res.status).toBe(404);
  });
});
