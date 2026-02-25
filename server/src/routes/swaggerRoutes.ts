import { Router } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const SWAGGER_ENABLED = process.env.SWAGGER_ENABLED !== 'false';

const definition: swaggerJsdoc.OAS3Definition = {
  openapi: '3.0.0',
  info: {
    title: 'sisDRONE API',
    version: '1.0.0',
    description:
      'API REST de inspeção de redes de distribuição elétrica por drones. ' +
      'Suporte a postes, condutores, circuitos, IA, topologia e relatórios.',
    contact: { name: 'sisDRONE Tech', email: 'contato@sisdrone.dev' },
    license: { name: 'MIT' },
  },
  servers: [{ url: '/api', description: 'Servidor principal' }],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Pole: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string', example: 'P-001' },
          lat: { type: 'number', example: -22.15018 },
          lng: { type: 'number', example: -42.92185 },
          material: { type: 'string', enum: ['Concreto', 'Madeira', 'Metal', 'Aço'] },
          status: { type: 'string', enum: ['good', 'attention', 'critical', 'unknown'] },
          ahi_score: { type: 'integer', minimum: 0, maximum: 100 },
          tenant_id: { type: 'integer' },
        },
      },
      Conductor: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          pole_from_id: { type: 'integer' },
          pole_to_id: { type: 'integer' },
          network_type: { type: 'string', enum: ['MT', 'BT', 'ramal'] },
          cable_type: { type: 'string' },
          voltage_kv: { type: 'number' },
          length_m: { type: 'number' },
          computed_length_m: { type: 'number' },
          tenant_id: { type: 'integer' },
        },
      },
      Circuit: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string' },
          color: { type: 'string' },
          tenant_id: { type: 'integer' },
        },
      },
      WorkOrder: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['LOW', 'MED', 'HIGH', 'CRITICAL'] },
          status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'] },
          pole_id: { type: 'integer' },
          due_date: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/poles': {
      get: {
        summary: 'Listar postes',
        tags: ['Postes'],
        parameters: [
          { in: 'query', name: 'tenant_id', schema: { type: 'integer' } },
          { in: 'query', name: 'ahi_min', schema: { type: 'integer' } },
          { in: 'query', name: 'ahi_max', schema: { type: 'integer' } },
          { in: 'query', name: 'status', schema: { type: 'string' } },
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          200: { description: 'Lista de postes', content: { 'application/json': { schema: { type: 'object', properties: { poles: { type: 'array', items: { $ref: '#/components/schemas/Pole' } }, total: { type: 'integer' }, page: { type: 'integer' }, pages: { type: 'integer' } } } } } },
          401: { description: 'Não autenticado' },
        },
      },
      post: {
        summary: 'Criar poste',
        tags: ['Postes'],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Pole' } } } },
        responses: {
          201: { description: 'Poste criado' },
          400: { description: 'Dados inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/poles/{id}': {
      get: {
        summary: 'Buscar poste por ID',
        tags: ['Postes'],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Poste encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Pole' } } } },
          404: { description: 'Não encontrado' },
        },
      },
      put: {
        summary: 'Atualizar poste',
        tags: ['Postes'],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Poste atualizado' }, 404: { description: 'Não encontrado' } },
      },
      delete: {
        summary: 'Excluir poste (cascade)',
        tags: ['Postes'],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Poste excluído' }, 404: { description: 'Não encontrado' } },
      },
    },
    '/conductors': {
      get: { summary: 'Listar condutores', tags: ['Condutores'], responses: { 200: { description: 'Lista de condutores' } } },
      post: { summary: 'Criar condutor', tags: ['Condutores'], responses: { 201: { description: 'Condutor criado' }, 400: { description: 'Dados inválidos' } } },
    },
    '/conductors/{id}': {
      get: { summary: 'Buscar condutor', tags: ['Condutores'], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Condutor' }, 404: { description: 'Não encontrado' } } },
      put: { summary: 'Atualizar condutor', tags: ['Condutores'], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Condutor atualizado' } } },
      delete: { summary: 'Excluir condutor', tags: ['Condutores'], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Condutor excluído' } } },
    },
    '/circuits': {
      get: { summary: 'Listar circuitos', tags: ['Circuitos'], responses: { 200: { description: 'Lista de circuitos' } } },
      post: { summary: 'Criar circuito', tags: ['Circuitos'], responses: { 201: { description: 'Circuito criado' } } },
    },
    '/work-orders': {
      get: { summary: 'Listar ordens de serviço (paginado)', tags: ['Ordens de Serviço'], responses: { 200: { description: 'Lista de OS' } } },
      post: { summary: 'Criar ordem de serviço', tags: ['Ordens de Serviço'], responses: { 201: { description: 'OS criada' } } },
    },
    '/network/graph': {
      get: { summary: 'Grafo de rede elétrica', tags: ['Rede'], parameters: [{ in: 'query', name: 'tenant_id', schema: { type: 'integer' } }], responses: { 200: { description: 'Nós e arestas do grafo' } } },
    },
    '/network/validate': {
      get: { summary: 'Validação topológica da rede', tags: ['Rede'], responses: { 200: { description: 'Relatório de validação (loops, dead_ends, isolated, duplicate_spans)' } } },
    },
    '/network/voltage-drop': {
      get: { summary: 'Queda de tensão por vão (NBR 5410)', tags: ['Rede'], responses: { 200: { description: 'Lista de condutores com delta_v_percent e status ok/warning/critical' } } },
    },
    '/report/croqui/{tenantId}': {
      get: { summary: 'Croqui digital SVG da rede', tags: ['Relatórios'], parameters: [{ in: 'path', name: 'tenantId', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'SVG da rede' } } },
    },
    '/kpis': {
      get: { summary: 'KPIs executivos (MTTR, inspeção, custo, AHI)', tags: ['KPIs'], parameters: [{ in: 'query', name: 'tenant_id', schema: { type: 'integer' } }, { in: 'query', name: 'period_days', schema: { type: 'integer', default: 30 } }], responses: { 200: { description: 'KPIs calculados' } } },
    },
    '/offline-bundle': {
      get: { summary: 'Bundle offline comprimido (gzip JSON)', tags: ['Offline'], parameters: [{ in: 'query', name: 'tenant_id', schema: { type: 'integer' } }], responses: { 200: { description: 'Bundle gzip com postes, condutores e circuitos' } } },
    },
  },
};

const spec = swaggerJsdoc({ definition, apis: [] });

const router = Router();

if (SWAGGER_ENABLED) {
  router.get('/json', (_req, res) => {
    res.json(spec);
  });

  router.use('/', swaggerUi.serve);
  router.get('/', swaggerUi.setup(spec, { customSiteTitle: 'sisDRONE API Docs' }));
}

export { spec };
export default router;
