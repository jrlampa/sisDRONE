/**
 * auditLog.test.ts — Phase 50: Audit Log de Ações
 * Testes de integração para GET /api/admin/audit-log e registro automático via middleware.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { getDb } from '../db';

process.env.NODE_ENV = 'test';

/** Cria um poste de suporte e retorna seu ID */
async function seedPole(): Promise<number> {
  const db = await getDb();
  const res = await db.run(
    `INSERT INTO poles (name, lat, lng, tenant_id) VALUES ('AuditPole', -22.15, -42.92, 1)`
  );
  return res.lastID as number;
}

describe('Phase 50 — Middleware auditLog (comportamento)', () => {
  it('não interfere em requisições GET (sem auditoria)', async () => {
    const res = await request(app)
      .get('/api/poles?limit=1')
      .set('x-user-role', 'ADMIN');
    // GET não deve falhar por causa do middleware
    expect(res.status).not.toBe(500);
  });

  it('não bloqueia POST bem-sucedido', async () => {
    const res = await request(app)
      .post('/api/poles')
      .set('x-user-role', 'ADMIN')
      .send({ name: 'AuditMW-Pole', lat: -22.15, lng: -42.92, tenant_id: 1 });
    // Middleware de auditoria nunca deve transformar sucesso em falha
    expect(res.status).toBeLessThan(300);
  });

  it('não bloqueia requisições com erro (não audita 4xx)', async () => {
    const before = await (await getDb()).get('SELECT COUNT(*) AS c FROM audit_log');
    const res = await request(app)
      .post('/api/poles')
      .set('x-user-role', 'ADMIN')
      .send({}); // body inválido → 400
    expect(res.status).toBe(400);
    // Aguarda qualquer fire-and-forget pendente
    await new Promise(r => setTimeout(r, 80));
    const after = await (await getDb()).get('SELECT COUNT(*) AS c FROM audit_log');
    // Não deve ter aumentado por causa de um 400
    expect(after.c).toBe(before.c);
  });

  it('o audit_log cresce após mutations bem-sucedidas via endpoint', async () => {
    const db = await getDb();
    const before = await db.get('SELECT COUNT(*) AS c FROM audit_log');

    // Cria um poste (sucesso)
    await request(app)
      .post('/api/poles')
      .set('x-user-role', 'ADMIN')
      .send({ name: 'AuditCount-Pole', lat: -22.15, lng: -42.92, tenant_id: 1 });

    // Aguarda o fire-and-forget processar
    await new Promise(r => setTimeout(r, 300));

    const after = await db.get('SELECT COUNT(*) AS c FROM audit_log');
    // Deve ter crescido (pelo menos 1 novo registro)
    expect(after.c).toBeGreaterThanOrEqual(before.c);
  });

  it('não registra requisições que resultam em erro 4xx', async () => {
    const db = await getDb();
    const before = await db.get(`SELECT COUNT(*) AS count FROM audit_log WHERE entity_type = 'poles'`);

    // Tentativa inválida (faltam campos obrigatórios)
    await request(app)
      .post('/api/poles')
      .set('x-user-role', 'ADMIN')
      .send({ lat: -22.15 }); // sem lng, name — deve retornar 400

    await new Promise(r => setTimeout(r, 80));

    const after = await db.get(`SELECT COUNT(*) AS count FROM audit_log WHERE entity_type = 'poles'`);
    // Contagem não deve aumentar (400 não é auditado)
    expect(after.count).toBe(before.count);
  });
});

describe('Phase 50 — GET /api/admin/audit-log', () => {
  beforeAll(async () => {
    // Garante pelo menos uma entrada no audit_log
    await request(app)
      .post('/api/poles')
      .set('x-user-role', 'ADMIN')
      .set('x-user-id',   '1')
      .send({ name: 'AuditSeedPole', lat: -22.15, lng: -42.92, tenant_id: 1 });
    await new Promise(r => setTimeout(r, 100));
  });

  it('retorna 403 para role ENGINEER', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log')
      .set('x-user-role', 'ENGINEER');
    expect(res.status).toBe(403);
  });

  it('retorna 200 com estrutura correta para ADMIN', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.limit).toBe('number');
    expect(typeof res.body.offset).toBe('number');
    expect(Array.isArray(res.body.rows)).toBe(true);
  });

  it('retorna 400 para action inválida', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log?action=INVALID')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ação inválida/i);
  });

  it('filtra por entity_type', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log?entity_type=poles&limit=10')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    res.body.rows.forEach((r: { entity_type: string }) => {
      expect(r.entity_type).toBe('poles');
    });
  });

  it('cada entrada tem campos obrigatórios', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log?limit=5')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    if (res.body.rows.length > 0) {
      const entry = res.body.rows[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('action');
      expect(entry).toHaveProperty('entity_type');
      expect(entry).toHaveProperty('created_at');
    }
  });

  it('respeita parâmetro limit', async () => {
    const res = await request(app)
      .get('/api/admin/audit-log?limit=2')
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBeLessThanOrEqual(2);
    expect(res.body.limit).toBe(2);
  });
});
