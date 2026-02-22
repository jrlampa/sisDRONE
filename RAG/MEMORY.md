# sisDRONE – RAG / Memória de Trabalho

> Última atualização: 2026-02-22 (Phase 3) | Responsável: Copilot (Tech Lead / Dev Fullstack Sênior)

---

## 1. Visão Geral do Projeto

**sisDRONE** é um sistema de inspeção automatizada de redes de distribuição elétrica apoiado por drones e IA.
Permite que concessionárias de energia (multi-tenant) registrem postes, analisem imagens via IA (Groq/LLaMA),
gerem planos de manutenção, emitam ordens de serviço e exportem dados GIS – tudo sem custo monetário de APIs.

### Tecnologias Principais
| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Vite + Leaflet (mapa 2.5D) |
| Backend | Node.js + Express 5 + TypeScript |
| Banco | SQLite (via `sqlite` + `sqlite3`) |
| IA | Groq API (LLaMA – gratuita) |
| Mapas | OpenStreetMap (gratuito) |
| Testes | Vitest (unit) + Playwright (E2E) |
| Infra | Docker + Docker Compose |

---

## 2. Arquitetura (DDD / SoA)

```
sisDRONE/
├── client/          # Frontend React (thin client)
│   ├── src/
│   │   ├── components/   # UI modular
│   │   ├── hooks/        # Lógica de estado (useNetwork, etc.)
│   │   ├── services/     # api.ts – chamadas HTTP
│   │   ├── types/        # Tipagem compartilhada
│   │   └── utils/        # geo.ts, eng.ts, math.ts, offlineQueue.ts
│   └── e2e/         # Testes Playwright
└── server/          # Backend Express (smart backend)
    └── src/
        ├── routes/       # Endpoints REST (poles, gis, ai, workOrders, maintenance)
        ├── services/     # Lógica de negócio (groq, health, prediction, cost, chat)
        ├── middleware/   # auth.ts (RBAC via header x-user-role)
        ├── utils/        # geo.ts
        ├── db.ts         # SQLite – schema + seeds + migrations
        ├── seeds.ts      # Dados iniciais (tenants, usuários, materiais)
        └── types.ts      # Tipos TypeScript do servidor
```

---

## 3. Domínios (DDD)

| Domínio | Entidades | Rotas |
|---------|-----------|-------|
| **Infraestrutura** | Pole, Tenant | `/api/poles`, `/api/tenants` |
| **Inspeção** | Inspection (Label), Image | `/api/analyze`, `/api/feedback`, `/:id/history` |
| **IA / Manutenção** | MaintenancePlan | `/api/ai/plan`, `/api/ai/chat`, `/api/ai/predict/:id` |
| **GIS** | GeoJSON | `/api/gis/export/geojson`, `/api/gis/import/geojson` |
| **Operações** | WorkOrder | `/api/work-orders` |
| **Usuários** | User | `/api/users` |

---

## 4. Regras de Negócio Críticas

### 4.1 AHI Score (Asset Health Index)
- Escala 0–100 (100 = perfeito, <50 = crítico)
- Calculado em `healthService.ts`:
  - `-1 ponto/ano` de idade
  - `-40` se condição crítica (IA)
  - `-15` se atenção
  - `-5` se localização costeira (ID par – heurística)
- Threshold de falha: **AHI < 30**

### 4.2 Previsão de Vida Útil (EOL)
- Serviço: `predictionService.ts`
- Lifespans por material: Concreto 40 anos, Madeira 25, Metal/Aço 35
- Taxa de decaimento = (100 - score_atual) / idade
- Projeção futura para AHI = 30

### 4.3 Multi-Tenant
- Dados isolados por `tenant_id`
- RBAC: ADMIN > ENGINEER > VIEWER
- Header `x-user-role` (mock – deve evoluir para JWT)

### 4.4 Custo Zero
- Todas as APIs externas são gratuitas ou públicas
- Groq API: modelo `meta-llama/llama-4-scout-17b-16e-instruct` (visão) e `llama-3.3-70b-versatile` (texto)
- Mapas: OpenStreetMap via Leaflet

---

## 5. Coordenadas de Teste (Região Nova Friburgo/RJ)

| Formato | Valor |
|---------|-------|
| UTM (Google Earth Pro) | Zona 23K, E: 788547, N: 7634925 |
| Decimal | Lat: -22.15018, Lng: -42.92185 |

**Raios de teste**: 100 m, 500 m, 1 km

---

## 6. Bugs Conhecidos / Corrigidos

| # | Bug | Status | Arquivo |
|---|-----|--------|---------|
| 1 | Coluna `name` ausente no schema de `poles` | ✅ Corrigido | `db.ts` |
| 2 | Duplicate `return config;` no interceptor axios | ✅ Corrigido | `api.ts` |
| 3 | Typo no seed de usuário `eng_eq` (sem `role`) | ✅ Corrigido | `seeds.ts` |
| 4 | `groqService.analyzeImage` retornava string, não JSON | ✅ Corrigido | `groqService.ts` |
| 5 | Filtro de condição mockado (% id) em vez de usar AHI real | ✅ Corrigido | `App.tsx` |
| 6 | POST /api/poles não salvava `tenant_id` | ✅ Corrigido | `routes/poles.ts` |
| 7 | `api.getStats()` apontava para `/api/stats` (inexistente) | ✅ Corrigido | `api.ts` |
| 8 | `Map.tsx` tinha linha duplicada de Coords no popup | ✅ Corrigido | `Map.tsx` |
| 9 | `PoleDetails.tsx` tinha useEffect duplicado chamando loadHistory 2x | ✅ Corrigido | `PoleDetails.tsx` |
| 10 | Filtro de tenant feito no cliente em vez do servidor | ✅ Corrigido | `useNetwork.ts`, `routes/poles.ts` |
| 11 | `useNetwork.fetchStats()` armazenava `DashboardData` em estado tipado como `Stats` | ✅ Corrigido | `useNetwork.ts` |
| 12 | Usuários seedados sem `password_hash` — login falhava após migração | ✅ Corrigido | `db.ts` (backfill) |
| 13 | PWA build falha por bundle > 2MiB (`maximumFileSizeToCacheInBytes`) | ✅ Corrigido | `vite.config.ts` |
| 14 | DroneLiveView com telemetria estática e hardcoded | ✅ Corrigido | `DroneLiveView.tsx` (WS) |
| 15 | E2E test seletor errado (texto não existe na UI) | ✅ Corrigido | `e2e/workflow.test.ts` |

---

## 7. Convenções de Código

- **pt-BR** obrigatório em toda UI/UX e mensagens de usuário
- **Clean Code**: funções únicas, nomes descritivos, sem comentários óbvios
- **Thin Frontend**: lógica de negócio sempre no backend
- **Sanitização**: todos os inputs de API sanitizados e validados antes de persistência
- **Modularidade**: arquivos > 500 linhas devem ser divididos
- **2.5D**: proibido qualquer renderização 3D (usar Leaflet 2D + elevação textual)

---

## 8. Docker

- `docker-compose.yml` na raiz do projeto
- `server/Dockerfile` – imagem Node 20 Alpine
- `client/Dockerfile` – multi-stage build Nginx

---

## 9. Cobertura de Testes

**Meta**: >= 80% de cobertura em código de lógica de negócio

**Situação atual** (Phase 3): 77 server + 11 client = **88 testes no total** ✅

Testes existentes:
- `predictionService.test.ts` – 2 casos
- `healthService.test.ts` – 5 casos  
- `costService.test.ts` – 4 casos
- `authService.test.ts` – 5 casos (novo Phase 3)
- `groqService.plan.test.ts` – 2 casos
- `tests/groq.test.ts` – 2 casos
- `tests/geo.test.ts` – 8 casos (5 novos haversineMeters)
- `tests/api.test.ts` – 27 casos
- `tests/auth.test.ts` – 4 casos
- `tests/authJwt.test.ts` – 6 casos (novo Phase 3)
- `tests/nearby.test.ts` – 9 casos (novo Phase 3)
- `tests/rateLimit.test.ts` – 3 casos
- `client/src/utils/eng.test.ts` – 3 casos
- `client/src/utils/geo.test.ts` – 2 casos
- `client/src/utils/math.test.ts` – 6 casos

---

## 10. Próximas Evoluções (Backlog Técnico)

- [x] ~~Autenticação JWT real (substituir header mock)~~ — Implementado Phase 3
- [x] ~~WebSocket para telemetria do drone em tempo real~~ — Implementado Phase 3
- [x] ~~Busca por raio (nearby poles)~~ — Implementado Phase 3
- [ ] Integração com ANEEL OpenData para dados de concessionárias
- [ ] Relatório PDF automático por poste
- [ ] BIM Half-way: importação IFC simplificado para estruturas de poste
- [ ] Pipeline CI/CD com GitHub Actions + Docker Hub
