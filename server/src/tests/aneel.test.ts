import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';

// We mock axios to avoid real ANEEL HTTP calls in tests
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    default: {
      ...actual.default,
      get: vi.fn(),
    },
  };
});

import axios from 'axios';

const mockAxiosGet = vi.mocked(axios.get);

const MOCK_ANEEL_RESPONSE = {
  data: {
    result: {
      records: [
        { SigAgente: 'CELPE', NomAgente: 'CELPE Distribuidora', NomMunicipio: 'Recife', SigUFPrincipal: 'PE', SigSegmentoEmpresas: 'Distribuição' },
        { SigAgente: 'COELCE', NomAgente: 'Coelce', NomMunicipio: 'Fortaleza', SigUFPrincipal: 'CE', SigSegmentoEmpresas: 'Distribuição' },
        { SigAgente: 'CERJ', NomAgente: 'Ampla', NomMunicipio: 'Niterói', SigUFPrincipal: 'RJ', SigSegmentoEmpresas: 'Distribuição' },
      ],
    },
  },
};

describe('ANEEL OpenData Proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosGet.mockResolvedValue(MOCK_ANEEL_RESPONSE);
  });

  it('GET /api/aneel/agents should return agents list', async () => {
    const res = await request(app).get('/api/aneel/agents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('agents');
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.agents.length).toBe(3);
    expect(res.body.agents[0]).toHaveProperty('sigla');
    expect(res.body.agents[0]).toHaveProperty('nome');
    expect(res.body.agents[0]).toHaveProperty('uf');
  });

  it('GET /api/aneel/agents should return expected fields', async () => {
    const res = await request(app).get('/api/aneel/agents');
    const agent = res.body.agents[0];
    expect(agent).toHaveProperty('sigla', 'CELPE');
    expect(agent).toHaveProperty('nome', 'CELPE Distribuidora');
    expect(agent).toHaveProperty('municipio', 'Recife');
    expect(agent).toHaveProperty('uf', 'PE');
    expect(agent).toHaveProperty('segmento');
  });

  it('GET /api/aneel/agents should cap limit at 500', async () => {
    const res = await request(app).get('/api/aneel/agents?limit=9999');
    expect(res.status).toBe(200);
    // Verify the axios call used limit=500
    const callArgs = mockAxiosGet.mock.calls[0];
    expect((callArgs[1] as any).params.limit).toBe(500);
  });

  it('GET /api/aneel/agents should use uf filter', async () => {
    const res = await request(app).get('/api/aneel/agents?uf=RJ');
    expect(res.status).toBe(200);
    const callArgs = mockAxiosGet.mock.calls[0];
    expect((callArgs[1] as any).params.q).toContain('RJ');
  });

  it('GET /api/aneel/agents should return 400 for invalid UF code', async () => {
    const res = await request(app).get('/api/aneel/agents?uf=XX');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('UF inválida');
  });

  it('GET /api/aneel/agents should return 502 on ANEEL API failure', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('Network Error'));
    const res = await request(app).get('/api/aneel/agents?limit=1');
    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/aneel/datasets should return datasets list', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { result: ['distribuicao', 'geracao'] } });
    const res = await request(app).get('/api/aneel/datasets');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('datasets');
    expect(Array.isArray(res.body.datasets)).toBe(true);
  });
});
