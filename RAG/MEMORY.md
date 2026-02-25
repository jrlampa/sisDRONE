# sisDRONE – RAG / Memória de Trabalho

> Última atualização: 2026-02-25 (Phase 45/46/48-backend) | Responsável: Copilot (Tech Lead / Dev Fullstack Sênior)

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
│   │   │   ├── Sidebar/  # PoleDetails, BimStructureEditor, InspectionHistory, EngineeringTools
│   │   │   ├── Dashboard/  # AnalyticsDashboard, DroneLiveView
│   │   │   ├── VideoCapture/  # VideoCapturePanel
│   │   │   ├── WorkOrders/  # KanbanBoard, WorkOrderModal
│   │   │   ├── AneelSearchPanel.tsx  # ANEEL agent search floating panel
│   │   │   └── ...
│   │   ├── hooks/        # Lógica de estado (useNetwork, useAppHandlers, useVideoCapture)
│   │   ├── services/     # api.ts – chamadas HTTP
│   │   ├── types/        # Tipagem compartilhada
│   │   └── utils/        # geo.ts, eng.ts, math.ts, offlineQueue.ts
│   └── e2e/         # Testes Playwright
└── server/          # Backend Express (smart backend)
    └── src/
        ├── routes/       # Endpoints REST
        ├── services/     # Lógica de negócio
        ├── middleware/   # auth.ts (RBAC JWT + mock fallback), rateLimit.ts
        ├── utils/        # geo.ts
        ├── db.ts         # SQLite – schema + seeds + migrations
        ├── seeds.ts      # Dados iniciais (tenants, usuários, materiais)
        └── types.ts      # Tipos TypeScript do servidor
```

---

## 3. Domínios (DDD)

| Domínio | Entidades | Rotas |
|---------|-----------|-------|
| **Infraestrutura** | Pole, Tenant | `/api/poles` (filtros: ahi_min, ahi_max, status, paginação), `/api/poles/:id` (GET/PUT/DELETE cascade), `/api/poles/:id/summary`, `/api/poles/:id/images`, `/api/poles/:id/history`, `/api/poles/:id/work-orders`, `/api/poles/heatmap`, `/api/poles/alerts`, `/api/tenants` |
| **Inspeção** | Inspection (Label), Image | `/api/inspections` (paginado + filtros: pole_id, source), `/api/inspections/:id` (GET/DELETE), `/api/analyze`, `/api/feedback`, `/:id/history` |
| **Vídeo / Captura** | VideoSession, Frame | `/api/video/session/:id` (**GET** — Phase 27), `/api/video/session/start` (POST), `/api/video/sessions` (**GET paginado** — Phase 28), `/api/video/sessions/:poleId` (GET), `/api/video/session/:id/complete` (POST), `/api/video/frame` (POST), `/api/video/upload` (POST) |
| **IA / Manutenção** | MaintenancePlan | `/api/ai/*`, `/api/maintenance/:poleId` (GET lista), `/api/maintenance/plan/:planId` (**GET individual** — Phase 28), `/api/maintenance/:planId/status` (PATCH), `/api/maintenance/:planId` (DELETE) |
| **GIS** | GeoJSON | `/api/gis/*` |
| **Operações** | WorkOrder | `/api/work-orders` (paginado + filtros: status, assignee_id, **pole_id**), `/api/work-orders/stats`, `/api/work-orders/:id` (GET/PUT/DELETE) |
| **Usuários** | User | `/api/users` (**filtro tenant_id**), `/api/users/:id` (GET/PUT/DELETE) |
| **Auth** | JWT | `/api/auth/login`, `/api/auth/register`, `/api/auth/change-password` |
| **ANEEL** | Agents, Datasets | `/api/aneel/agents`, `/api/aneel/datasets` |
| **BIM** | StructureData (IFC-lite) | `/api/bim/:poleId` (GET/PUT) |
| **Relatório** | PdfReport, CroquiSVG | `/api/report/pole/:id`, `/api/report/croqui/:tenantId` (GET SVG — Phase 31) |
| **Condutores** | Conductor (span elétrico MT/BT/Ramal) | `/api/conductors` (GET list, POST), `/api/conductors/:id` (GET/PUT/DELETE) — PUT Phase 32, computed_length_m auto Haversine |
| **Rede** | NetworkGraph, NetworkSegment, IsolatedPole, VoltageDrop | `/api/network/graph`, `/api/network/segments`, `/api/network/isolated` (Phase 30), `/api/network/voltage-drop` (Phase 33) |
| **AHI History** | AhiSnapshot | `/api/poles/:id/ahi-history?limit=` (Phase 34) — série temporal de AHI; snapshot gravado em cada plano de IA |
| **Circuitos** | Circuit | `/api/circuits` (GET/POST), `/api/circuits/:id` (GET/PUT/DELETE), `/api/circuits/:id/stats` (Phase 41) — agrupamento de postes e condutores em alimentadores |
| **Importação** | CSV Bulk | `POST /api/poles/import/csv` (Phase 36) — CSV com validação, transação atômica, max 1000 linhas |
| **Validação Topológica** | ValidationReport | `GET /api/network/validate` (Phase 42) — loops (DFS), dead_ends, isolados, duplicate_spans; is_valid flag |
| **Simulação de Falha** | FailureSimulationResult | `GET /api/network/simulate-failure?pole_id=|conductor_id=` (Phase 47) — BFS sem nó/aresta; partições + postes afetados + estimativa clientes |
| **Admin Overview** | AdminOverviewData | `GET /api/admin/overview` + `GET /api/admin/tenants/stats` (Phase 43) — ADMIN-only; visão cross-tenant |
| **KPIs Executivos** | KpiData | `GET /api/kpis?tenant_id=&period_days=30` (Phase 49) — MTTR, taxa inspeção, custo, AHI delta, postes recuperados |

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
- JWT Bearer token (Auth header) ou `x-user-role` (fallback mock para testes)

### 4.4 Custo Zero
- Todas as APIs externas são gratuitas ou públicas
- Groq API: modelo `meta-llama/llama-4-scout-17b-16e-instruct` (visão) e `llama-3.3-70b-versatile` (texto)
- Mapas: OpenStreetMap via Leaflet
- ANEEL: dados.gov.br / CKAN API pública

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
| 16 | `/api/poles/export` inacessível pois `/:id` registrado antes | ✅ Corrigido | `routes/poles.ts` (Phase 6) |
| 17 | `GET /api/poles/:id/history` rota inexistente — client chamava URL errada | ✅ Corrigido | `routes/poles.ts` (Phase 8) |
| 18 | `useAppHandlers.ts` `setActiveTab` type faltava 'bim' | ✅ Corrigido | `hooks/useAppHandlers.ts` (Phase 8) |
| 19 | `rateLimit.ts` store compartilhado entre todos os handlers (mesmo IP = mesma contagem) | ✅ Corrigido | `middleware/rateLimit.ts` (Phase 10) |
| 20 | `workOrders.ts` GET/POST/PUT sem rateLimit | ✅ Corrigido | `routes/workOrders.ts` (Phase 10) |
| 21 | `poles.ts` POST sem rateLimit | ✅ Corrigido | `routes/poles.ts` (Phase 10) |
| 22 | `aiRoutes.ts` /plan: poleId não validado | ✅ Corrigido | `routes/aiRoutes.ts` (Phase 10) |
| 23 | `groqService.ts` GROQ_API_KEY capturada no módulo (não testável) | ✅ Corrigido | `services/groqService.ts` (Phase 10) |
| 24 | `Sidebar.tsx` typo "Sáude" → "Saúde" | ✅ Corrigido | `components/Sidebar/Sidebar.tsx` (Phase 10) |
| 25 | `GET /api/poles/stats` e `/export` sem rateLimit | ✅ Corrigido | `routes/poles.ts` (Phase 11) |
| 26 | `GET /api/users` sem rateLimit — exposição de dados | ✅ Corrigido | `routes/users.ts` (Phase 12) |
| 27 | `GET/POST /api/gis` sem rateLimit | ✅ Corrigido | `routes/gis.ts` (Phase 12) |
| 28 | `GET /api/users` retornava `password_hash` | ✅ Corrigido | `routes/users.ts` (Phase 12) |
| 29 | `POST /api/gis/import` sem validação de features (OOB, tipo errado) | ✅ Corrigido | `routes/gis.ts` (Phase 12) |
| 30 | "Unassigned" em inglês no KanbanBoard | ✅ Corrigido | `KanbanBoard.tsx` (Phase 12) |
| 31 | `GET /api/ai/predict/:id` sem validação de id — passava string ao DB | ✅ Corrigido | `routes/aiRoutes.ts` (Phase 13) |
| 32 | `WorkOrderModal.tsx` usava `alert()` nativo (UX ruim) | ✅ Corrigido | `WorkOrderModal.tsx` (Phase 13) |
| 33 | `docker-compose.yml` sem JWT_SECRET e sem healthcheck | ✅ Corrigido | `docker-compose.yml` (Phase 13) |
| 34 | `server/Dockerfile` rodava como root | ✅ Corrigido | `server/Dockerfile` (Phase 13) |
| 35 | `client/nginx.conf` sem headers de segurança e sem X-Forwarded-For | ✅ Corrigido | `nginx.conf` (Phase 13) |
| 36 | `app.ts` legacy `/api` mount intercept `/api/tenants`, `/api/users`, `/api/work-orders` com /:id do inspections router (novo em Phase 22) | ✅ Corrigido | `app.ts` (Phase 22) |

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

**Situação atual** (Phase 45/46/48-backend): 534 server + 11 client = **545 testes no total** ✅ | Coverage: **100% stmts + 100% branches** 🎯

**Coverage Threshold** configurado em `server/vitest.config.ts`:
- Lines/Functions/Statements: ≥ 80%
- Branches: ≥ 70% (atual: 88.75% — muito acima da meta!)

**Coverage por módulo (Phase 15)**:
- `middleware/auth.ts`: 100%
- `middleware/rateLimit.ts`: 100%
- `services/authService.ts`: 100% stmts, 83.33% branches (line 7: module-level console.warn, side-effect de init)
- `services/chatService.ts`: 100%
- `services/groqService.ts`: 100%
- `services/healthService.ts`: 100%
- `services/predictionService.ts`: **100% branches** (era 92.85%)
- `services/costService.ts`: 100%
- `utils/geo.ts`: 100%
- **Total servidor**: **100% statements, 98.75% branches** ✅

Testes existentes (Phase 9):
- `predictionService.test.ts` – 8 (+6 edge cases: no date, unknown material, age≤2, age≤5, above failure, clamped years)
- `healthService.test.ts` – 5
- `costService.test.ts` – 4
- `authService.test.ts` – 5
- `chatService.test.ts` – 5 (+3 validation: missing msg, non-string, Groq unavailable)
- `groqService.plan.test.ts` – 2
- `tests/groq.test.ts` – 2
- `tests/geo.test.ts` – 8
- `tests/api.test.ts` – 27
- `tests/auth.test.ts` – 7
- `tests/authJwt.test.ts` – 6
- `tests/nearby.test.ts` – 9
- `tests/rateLimit.test.ts` – 3
- `tests/video.test.ts` – 18
- `tests/bim.test.ts` – 10
- `tests/aneel.test.ts` – 7
- `tests/report.test.ts` – 5
- `tests/polesCrud.test.ts` – 14
- `tests/polesHistory.test.ts` – 4
- `tests/aiValidation.test.ts` – 6
- `tests/health.test.ts` – 5 (novo Phase 9: GET /health com DB status)
- `tests/maintenancePlans.test.ts` – 6 (novo Phase 9: GET /:poleId, PATCH /:planId/status)
- `tests/polesAlerts.test.ts` – 8 (novo Phase 11: GET /alerts + paginação de poles)
- `tests/workOrders.test.ts` – 20 (novo Phase 12: CRUD completo incl. DELETE)
- `tests/gis.test.ts` – 8 (novo Phase 12: export + import com validações)
- `tests/users.test.ts` – 4 (novo Phase 12: GET /api/users, verifica sem password_hash)
- `services/costServiceError.test.ts` – 1 (novo Phase 13: cobertura do catch branch)
- `tests/tenants.test.ts` – 6 (novo Phase 13: GET /api/tenants e /:id)
- `tests/predict.test.ts` – 5 (novo Phase 13: GET /api/ai/predict/:id com validação)
- `tests/polesSummary.test.ts` – 5 (novo Phase 14: GET /api/poles/:id/summary)
- `tests/maintenance.test.ts` – 13 (novo Phase 18: CRUD completo GET/PATCH/DELETE com 404, 400 e happy path)
- `services/authServiceBranch.test.ts` – 2 (novo Phase 17: branch JWT_SECRET set via vi.resetModules → 100% branches)
- `tests/users.test.ts` – 19 (4 GET / + 4 GET /:id + 6 PUT /:id + 5 DELETE /:id — Phase 16)
- `client/utils/eng.test.ts` – 3
- `client/utils/geo.test.ts` – 2
- `client/utils/math.test.ts` – 6

---

## 10. Próximas Evoluções (Backlog Técnico)

- [x] ~~Autenticação JWT real~~ — Phase 3
- [x] ~~WebSocket telemetria drone~~ — Phase 3
- [x] ~~Busca por raio (nearby)~~ — Phase 3
- [x] ~~Análise de vídeo em tempo real + fallback offline~~ — Phase 4
- [x] ~~Integração ANEEL OpenData~~ — Phase 5
- [x] ~~Relatório PDF automático por poste~~ — Phase 5
- [x] ~~BIM Half-way: IFC-lite para estruturas de poste~~ — Phase 5
- [x] ~~Modularização App.tsx~~ — Phase 5
- [x] ~~BIM Half-way UI: formulário de edição de estrutura no PoleDetails~~ — Phase 6
- [x] ~~ANEEL UI: componente de busca de agentes por UF no header~~ — Phase 6
- [x] ~~GET/PUT/DELETE /api/poles/:id CRUD completo~~ — Phase 6
- [x] ~~PDF download button em PoleDetails~~ — Phase 6
- [x] ~~Nearby Poles search UI no Sidebar (campo lat/lng/radius + geolocalização)~~ — Phase 7
- [x] ~~Context API para activeTenantId/currentUser/isOnline (TenantContext)~~ — Phase 7
- [x] ~~Pipeline CI/CD com Docker build validation~~ — Phase 7
- [x] ~~Login page com formulário real usando JWT~~ — Phase 8
- [x] ~~Code splitting / lazy loading para reduzir bundle > 2MB~~ — Phase 8
- [x] ~~Bug: GET /api/poles/:id/history rota inexistente nos poles router~~ — Phase 8
- [x] ~~Rate limiting nos endpoints AI~~ — Phase 8
- [x] ~~KanbanBoard coluna BLOCKED~~ — Phase 8
- [x] ~~Endpoint GET /health com informações detalhadas (DB, uptime, poles count, version)~~ — Phase 9
- [x] ~~Rate limiting em inspections.ts e maintenance.ts (todos os endpoints)~~ — Phase 9
- [x] ~~PoleDetails: formulário inline de edição (PUT /api/poles/:id)~~ — Phase 9
- [x] ~~PoleDetails: botão de exclusão com confirmação (DELETE /api/poles/:id)~~ — Phase 9
- [x] ~~Branch coverage ≥ 80% (81.25% atingido)~~ — Phase 9
- [x] ~~chatService.ts 100% coverage (era 75%/33%)~~ — Phase 10
- [x] ~~groqService.ts 100% stmts / 90% branches (era 90%/70%)~~ — Phase 10
- [x] ~~rateLimit.ts: bug critical: shared store entre handlers (corrigido: handlerId + ip)~~ — Phase 10
- [x] ~~workOrders.ts: todos os 3 handlers sem rateLimit (GET/POST/PUT) — adicionados~~ — Phase 10
- [x] ~~poles.ts POST sem rateLimit — adicionado rateLimit(30/min)~~ — Phase 10
- [x] ~~GET /api/work-orders/:id endpoint ausente — adicionado~~ — Phase 10
- [x] ~~aiRoutes.ts /plan: poleId sem validação de inteiro — corrigido~~ — Phase 10
- [x] ~~groqService.ts: GROQ_API_KEY lida no módulo (não testável) → movida para dentro das funções~~ — Phase 10
- [x] ~~Sidebar.tsx: typo "Sáude" → "Saúde"~~ — Phase 10
- [x] ~~GET /api/poles/stats e /export sem rateLimit — adicionados~~ — Phase 11
- [x] ~~GET /api/poles/alerts: endpoint de alertas críticos (AHI < 30)~~ — Phase 11
- [x] ~~Paginação em GET /api/poles (page + limit, max 200)~~ — Phase 11
- [x] ~~AlertBanner component: banner de alertas críticos no mapa~~ — Phase 11
- [x] ~~api.getAlerts() + useNetwork.fetchAlerts() integrados ao App.tsx~~ — Phase 11
- [x] ~~GET /api/users sem rateLimit + expondo password_hash — corrigidos~~ — Phase 12
- [x] ~~GET/POST /api/gis sem rateLimit + import sem validação — corrigidos~~ — Phase 12
- [x] ~~DELETE /api/work-orders/:id endpoint ausente — adicionado~~ — Phase 12
- [x] ~~KanbanBoard "Unassigned" → "Não atribuído" (pt-BR) + botão excluir OS~~ — Phase 12
- [x] ~~api.deleteWorkOrder() + KanbanBoard refatorado com TaskCard + useCallback~~ — Phase 12
- [x] ~~GET /api/ai/predict/:id: sem validação de id — retornava 404 em vez de 400 para string~~ — Phase 13
- [x] ~~WorkOrderModal.tsx: alert() → notificação inline com ícones e auto-close~~ — Phase 13
- [x] ~~docker-compose.yml: JWT_SECRET + JWT_EXPIRES_IN + healthcheck com node native~~ — Phase 13
- [x] ~~server/Dockerfile: usuário não-root sisdrone com chown correto~~ — Phase 13
- [x] ~~client/nginx.conf: headers de segurança + X-Forwarded-For + gzip + proxy /uploads~~ — Phase 13
- [x] ~~costService.ts: cobertura de catch branch (100% statements + branches)~~ — Phase 13
- [x] ~~tests/tenants.test.ts + tests/predict.test.ts: 11 novos testes~~ — Phase 13
- [x] ~~GET /api/poles/:id/summary: AHI + last_inspection + active_plan + inspection_count~~ — Phase 14
- [x] ~~groqService.ts: branch linha 63 (rawContent object) — 90% → 100% branches~~ — Phase 14
- [x] ~~rateLimit.ts: branch socket.remoteAddress + unknown fallback — 77.77% → 100% branches~~ — Phase 14
- [x] ~~healthService.ts: branch 'Boa' condition (else sem deduções) — 84.21% → 100% branches~~ — Phase 14
- [x] ~~PoleDetails.tsx: summary card com inspeção count, última inspeção e plano ativo~~ — Phase 14
- [x] ~~PoleSummary type extraído para types.ts (single source of truth)~~ — Phase 14
- [x] ~~inspections.ts + poles.ts: mensagens English → pt-BR (Pole ID required, DB Error, etc.)~~ — Phase 15
- [x] ~~POST /api/auth/register: registo com validação completa + JWT response~~ — Phase 15
- [x] ~~GET /api/users/:id: endpoint REST completo para usuário individual~~ — Phase 15
- [x] ~~predictionService.ts: branch `?? 100` e `currentScore >= 100` — 92.85% → 100% branches~~ — Phase 15
- [x] ~~PoleDetails.tsx: todas as alert() → useToast (showToast + ToastBanner)~~ — Phase 15
- [x] ~~Sidebar.tsx: alert() no export CSV → useToast~~ — Phase 15
- [x] ~~useToast hook + ToastBanner component criados~~ — Phase 15
- [x] ~~PUT /api/users/:id: atualizar username/role (validação + rateLimit)~~ — Phase 16
- [x] ~~DELETE /api/users/:id: excluir usuário (self-delete prevention + rateLimit)~~ — Phase 16
- [x] ~~users.test.ts: 11 novos testes (GET /:id mantidos + 6 PUT + 5 DELETE)~~ — Phase 16
- [x] ~~PoleAnalysisResult.tsx: extraído de PoleDetails (analysis card + maintenance) — 472→387 linhas~~ — Phase 16
- [x] ~~useConfirm hook + ConfirmDialog component (substitui window.confirm)~~ — Phase 16
- [x] ~~PoleDetails.tsx: handleDeletePole usa useConfirm em vez de window.confirm~~ — Phase 16
- [x] ~~KanbanBoard.tsx: handleDelete usa useConfirm em vez de window.confirm~~ — Phase 16
- [x] ~~LoginPage.tsx: tab "Registrar" com formulário + validação + api.register()~~ — Phase 16
- [x] ~~api.updateUser() + api.deleteUser() adicionados em api.ts~~ — Phase 16
- [x] ~~authService.ts: branch JWT_SECRET set coberto com vi.resetModules → 83.33% → 100% branches~~ — Phase 17
- [x] ~~workOrders.ts: 4 "Failed to..." → pt-BR; poles.ts: 2 mensagens → pt-BR; inspections.ts: 1 → pt-BR~~ — Phase 17
- [x] ~~GET /api/inspections: nova rota listagem paginada (pole_id opcional, limit max 200)~~ — Phase 17
- [x] ~~inspectionsList.test.ts: 6 testes (paginação, filtro, NaN, limit max, campos)~~ — Phase 17
- [x] ~~PoleEditForm.tsx: extraído de PoleDetails (edit form + status labels pt-BR) — 472→368 linhas~~ — Phase 17
- [x] ~~api.getInspections(poleId?, page?, limit?) adicionado em api.ts~~ — Phase 17
- [x] ~~Coverage: 100% stmts + 100% branches~~ — Phase 17 🎯
- [x] ~~DB: 8 novos índices (idx_poles_ahi, idx_labels_pole, idx_labels_created, idx_images_pole, idx_users_tenant, idx_users_username, idx_maintenance_status, idx_wo_pole)~~ — Phase 18
- [x] ~~aiRoutes.ts: 3 mensagens English → pt-BR ("Dados de análise são obrigatórios", "Falha ao gerar plano", "Falha ao processar chat")~~ — Phase 18
- [x] ~~maintenance.ts: 2 "Failed to..." → pt-BR + 404 guard no PATCH + DELETE /api/maintenance/:planId adicionado~~ — Phase 18
- [x] ~~tests/maintenance.test.ts: 13 testes CRUD completo (GET, PATCH status, DELETE com 400/404/200)~~ — Phase 18
- [x] ~~usePoleSearch hook extraído de App.tsx (SRP) — App.tsx remove useMemo import~~ — Phase 18
- [x] ~~AnalyticsDashboard.tsx: console.error English → pt-BR~~ — Phase 18
- [x] ~~api.deleteMaintenancePlan(planId) adicionado em api.ts~~ — Phase 18
- [x] ~~BUGFIX CRÍTICO: loadPrediction useCallback declaration ausente em PoleDetails.tsx (ReferenceError em runtime)~~ — Phase 19
- [x] ~~PoleDetails.tsx: 3 console.error em inglês → pt-BR ('Falha ao carregar previsão', 'Falha ao carregar histórico', 'Erro ao gerar plano')~~ — Phase 19
- [x] ~~poles.ts: 3 console.error em inglês → pt-BR ('Erro de estatísticas', 'Erro de exportação', 'Erro de resumo')~~ — Phase 19
- [x] ~~GET /api/work-orders/stats: novo endpoint de KPIs agregados por status (OPEN/IN_PROGRESS/BLOCKED/COMPLETED/total)~~ — Phase 19
- [x] ~~POST /api/auth/change-password: troca de senha com validação bcrypt, rateLimit 10/min, 400/401/200~~ — Phase 19
- [x] ~~KanbanBoard.tsx: stats bar com contadores por status usando api.getWorkOrderStats()~~ — Phase 19
- [x] ~~KanbanBoard.tsx: 3 console.error em inglês → pt-BR~~ — Phase 19
- [x] ~~api.getWorkOrderStats() + api.changePassword() adicionados em api.ts~~ — Phase 19
- [x] ~~tests/workOrderStats.test.ts: 4 testes (200, inteiro, soma=total, OPEN≥2)~~ — Phase 19
- [x] ~~tests/changePassword.test.ts: 7 testes (400 ausente, 400 curto, 400 igual, 401 errado, 200 sucesso, login nova, login antiga)~~ — Phase 19
- [x] ~~GET /api/poles — filtros ahi_min, ahi_max, status query params adicionados (query builder dinâmico com conditions[])~~ — Phase 20
- [x] ~~GET /api/poles/heatmap — endpoint leve (id, lat, lng, ahi_score, name) para mapa de calor sem sobrecarga~~ — Phase 20
- [x] ~~poles.ts: "Stats error" → "Erro interno nas estatísticas" (pt-BR total)~~ — Phase 20
- [x] ~~tests/polesFilter.test.ts: 9 testes (ahi_min, ahi_max, combinado, status, tenant+ahi_min, lista vazia, heatmap 3 testes)~~ — Phase 20
- [x] ~~Map.tsx: centro do mapa corrigido de São Paulo (-23.5505, -46.6333) → Nova Friburgo (-22.15018, -42.92185, zoom 14)~~ — Phase 20
- [x] ~~useDashboard hook criado (client/src/hooks/useDashboard.ts) — loading/error states + reload()~~ — Phase 20
- [x] ~~AnalyticsDashboard.tsx: refatorado para usar useDashboard (SRP — extrai data fetching do componente)~~ — Phase 20
- [x] ~~api.getHeatmapData(tenantId?) adicionado em api.ts~~ — Phase 20
- [x] ~~api.getPoles() atualizado para aceitar filters?: \{ ahi_min?, ahi_max?, status? \} em api.ts~~ — Phase 20
- [x] ~~workOrders.ts: 5 console.error English → pt-BR ('Erro ao buscar/criar/atualizar/remover ordem de serviço')~~ — Phase 21
- [x] ~~inspections.ts: console.error 'Analysis error' → 'Erro de análise'; 'Feedback saved' → 'Feedback salvo'~~ — Phase 21
- [x] ~~db.ts: 'Failed to initialize database' → 'Falha ao inicializar banco de dados' (pt-BR 100%)~~ — Phase 21
- [x] ~~DELETE /api/poles/:id: cascade delete — labels, images, maintenance_plans, work_orders, video_sessions (integridade referencial)~~ — Phase 21
- [x] ~~GET /api/poles/:id/images: novo endpoint lista imagens por poste (count + id + file_path + captured_at)~~ — Phase 21
- [x] ~~poles.ts GET /:id/images: console.error adicionado no catch (consistente com workOrders.ts)~~ — Phase 21
- [x] ~~Map.tsx: marcadores coloridos por AHI via L.divIcon (verde ≥80, amarelo 50–79, vermelho <50, cinza=sem AHI)~~ — Phase 21
- [x] ~~Map.tsx popup: AHI null exibe 'N/A' em vez de 100 (comportamento correto)~~ — Phase 21
- [x] ~~MobileFab.tsx: 'Scan IA' → 'Analisar IA'; 'Add Poste' → 'Adicionar Poste' (pt-BR)~~ — Phase 21
- [x] ~~api.getPoleImages(id) adicionado em api.ts com tipo completo~~ — Phase 21
- [x] ~~tests/polesCascade.test.ts: 5 testes (DELETE cascadeia work_orders + images + pole → 404)~~ — Phase 21
- [x] ~~tests/polesImages.test.ts: 4 testes (400/404/200 + campos corretos)~~ — Phase 21
- [x] ~~Total: 309 server + 11 client = 320 testes ✅ | Coverage: 100% stmts + 100% branches 🎯 (mantido)~~ — Phase 21
- [x] ~~GET /api/inspections/:id + DELETE /api/inspections/:id — REST completeness do domínio Inspeção~~ — Phase 22
- [x] ~~GET /api/work-orders paginado (page, limit, pages, total) — paridade com /poles e /inspections~~ — Phase 22
- [x] ~~GET /api/poles/:id/work-orders — endpoint de conveniência (lista OS por poste, 400/404/200)~~ — Phase 22
- [x] ~~authRoutes.ts: 'Login error:' + 'Register error:' → pt-BR total~~ — Phase 22
- [x] ~~app.ts: legacy '/api' mount movido para depois das rotas específicas (bug crítico de shadowing!)~~ — Phase 22
- [x] ~~api.ts: getInspection(id) + deleteInspection(id) + getPoleWorkOrders(poleId) adicionados~~ — Phase 22
- [x] ~~api.ts: getWorkOrders() atualizado para retornar tipo paginado { work_orders, total, page, limit, pages }~~ — Phase 22
- [x] ~~KanbanBoard.tsx: fetchTasks usa res.data.work_orders (novo paginated response)~~ — Phase 22
- [x] ~~Map.tsx: marcador selecionado com anel visual (20px, borda branca, shadow dupla) vs não-selecionado (14px)~~ — Phase 22
- [x] ~~E2E: terceiro teste preenchido com asserção real (hasMap || hasLogin = true)~~ — Phase 22
- [x] ~~tests/inspectionsCrud.test.ts: 8 testes (GET/:id 400/404/200 + DELETE/:id 400/404/200 + verify gone)~~ — Phase 22
- [x] ~~tests/polesWorkOrders.test.ts: 8 testes (GET/:id/work-orders 400/404/200/campos + GET paginação 3 testes)~~ — Phase 22
- [x] ~~workOrders.test.ts: 2 testes atualizados (GET retorna objeto paginado, não array direto)~~ — Phase 22
- [x] ~~api.test.ts: teste GET /api/work-orders atualizado para esperar objeto paginado~~ — Phase 22
- [x] ~~Total: 316 server + 11 client = 327 testes ✅ | Coverage: 100% stmts + 100% branches 🎯 (mantido)~~ — Phase 22
- [x] ~~poles.ts modularizado: /stats, /export, /alerts, /heatmap → polesAnalytics.ts (436→305 linhas, SRP/modularidade)~~ — Phase 23
- [x] ~~app.ts: polesAnalyticsRouter montado ANTES de polesRouter (named routes resolvidas primeiro)~~ — Phase 23
- [x] ~~db.ts: PRAGMA foreign_keys = ON (integridade FK enforcement no SQLite)~~ — Phase 23
- [x] ~~inspections.ts: filtro `source` (ai/user/manual) em GET /api/inspections (query builder dinâmico)~~ — Phase 23
- [x] ~~tests/inspectionSource.test.ts: 6 novos testes (source=ai/user/manual, inválido ignorado, combinado com pole_id)~~ — Phase 23
- [x] ~~HeatmapLayer.tsx: React.FC → FC com import correto (jsx: react-jsx transform — sem namespace React)~~ — Phase 23
- [x] ~~usePoleSummary hook criado (hooks/usePoleSummary.ts) — extrai loadSummary + loadPrediction + loadHistory de PoleDetails (SRP)~~ — Phase 23
- [x] ~~PoleDetails.tsx: usa usePoleSummary (370→324 linhas) — remove MaintenancePlan interface local, Prediction import, loadSummary/loadPrediction/loadHistory callbacks~~ — Phase 23
- [x] ~~api.ts: source filter param documentado em getInspections() signature~~ — Phase 23
- [x] ~~GET /api/work-orders: filtro pole_id adicionado (400 para inválido, combinável com status)~~ — Phase 24
- [x] ~~GET /api/users: filtro tenant_id adicionado (400 para inválido, backward compat mantida)~~ — Phase 24
- [x] ~~PoleImages.tsx: componente galeria de imagens colapsável (MAX_DISPLAYED=6, lazy-load, thumbnails, pt-BR, link para imagem completa)~~ — Phase 24
- [x] ~~PoleDetails.tsx: seção "Imagens Capturadas" integrada com PoleImages (acima do AHI gauge)~~ — Phase 24
- [x] ~~Sidebar.tsx: console.error 'Failed to export CSV' → 'Falha ao exportar CSV:' (pt-BR 100%)~~ — Phase 24
- [x] ~~api.ts: getWorkOrders() aceita pole_id param; getUsers() aceita tenantId param~~ — Phase 24
- [x] ~~tests/workOrdersPoleFilter.test.ts: 5 testes (filter, abc, 0, empty, combined status+pole_id)~~ — Phase 24
- [x] ~~tests/usersTenantFilter.test.ts: 5 testes (all, tenant=1, abc, 0, sem password_hash)~~ — Phase 24
- [x] ~~Total: 332 server + 11 client = 343 testes ✅ | Coverage: 100% stmts + 100% branches 🎯~~ — Phase 24
- [x] ~~PUT /api/inspections/:id: atualizar label/confidence/source (CRUD completo do domínio Inspeção — apenas GET/DELETE existiam)~~ — Phase 25
- [x] ~~tests/inspectionsPut.test.ts: 8 novos testes (abc/0/404/no-fields/conf-OOB/source-inválido/200 label+confidence+source)~~ — Phase 25
- [x] ~~tests/workOrdersAssigneeFilter.test.ts: 6 novos testes (GET?assignee_id=X: filtro/abc/0/empty/combinado+status/WO seeded presente)~~ — Phase 25
- [x] ~~useWorkOrders hook criado (hooks/useWorkOrders.ts): extrai tasks/stats/loading/fetchTasks/fetchStats/handleStatusChange/handleDeleteTask de KanbanBoard~~ — Phase 25
- [x] ~~KanbanBoard.tsx refatorado com useWorkOrders (remove useState/useEffect/api inline — SRP)~~ — Phase 25
- [x] ~~api.updateInspection(id, {label?, confidence?, source?}) adicionado em api.ts~~ — Phase 25
- [x] ~~Total: 346 server + 11 client = 357 testes ✅ | Coverage: 100% stmts + 100% branches 🎯~~ — Phase 25
- [x] ~~polesAnalytics.ts: fix NULL ahi_score → 'Sem Dados' (não 'Saudável') + healthy/warning/critical/unknown/averageAhi direto na resposta~~ — Phase 26
- [x] ~~poles.ts: parâmetro sort em GET /api/poles (name_asc/desc, ahi_asc/desc, created_asc/desc; whitelist; default id DESC)~~ — Phase 26
- [x] ~~tests/polesSort.test.ts: 5 testes (ahi_asc, ahi_desc, name_asc, sort inválido→default, created_asc)~~ — Phase 26
- [x] ~~tests/polesStats.test.ts: 5 testes (200, direct counts, averageAhi, soma=totalPoles, conditionStats validCategories)~~ — Phase 26
- [x] ~~FilterChips.tsx: componente extraído de Sidebar.tsx (SRP) com CONDITION_LABELS constante pt-BR~~ — Phase 26
- [x] ~~Sidebar.tsx: usa FilterChips; stats-mini-grid expandido para 4 contadores (Postes/Saudáveis/Atenção/Críticos)~~ — Phase 26
- [x] ~~types.ts: warning adicionado à interface Stats~~ — Phase 26
- [x] ~~useNetwork.ts: usa campos diretos da API (healthy/warning/critical); pt-BR em todos console.error/log~~ — Phase 26
- [x] ~~api.ts: console.log '[Offline] Queuing request:' → '[Offline] Enfileirando requisição:'~~ — Phase 26
- [x] ~~Total: 356 server + 11 client = 367 testes ✅ | Coverage: 100% stmts + 100% branches 🎯~~ — Phase 26
- [x] ~~videoRoutes.ts: 3 console.errors English → pt-BR (Erro ao iniciar sessão, Erro na análise do frame, Erro no upload)~~ — Phase 27
- [x] ~~bimRoutes.ts: 2 console.errors English → pt-BR (Erro ao buscar/atualizar dados BIM)~~ — Phase 27
- [x] ~~aneelRoutes.ts: 2 console.errors English → pt-BR ([ANEEL] Erro na API, [ANEEL] Erro nos datasets)~~ — Phase 27
- [x] ~~aiRoutes.ts: 3 console messages English → pt-BR (Erro na previsão, Falha ao gerar plano, Erro no chat) + console.log [AI] → [IA] pt-BR~~ — Phase 27
- [x] ~~reportRoutes.ts: 1 console.error English → pt-BR (Erro ao gerar relatório PDF) — servidor 100% pt-BR~~ — Phase 27
- [x] ~~WorkOrderModal.tsx: console.error 'Error creating WO' → 'Erro ao criar OS:' — cliente 100% pt-BR~~ — Phase 27
- [x] ~~GET /api/video/session/:id: novo endpoint REST para buscar sessão individual por ID (400/404/200; rateLimit 60/min)~~ — Phase 27
- [x] ~~tests/videoSessionGet.test.ts: 6 novos testes (pole creation, session creation, 400 abc/0, 404, 200 + campos)~~ — Phase 27
- [x] ~~Total: 362 server + 11 client = 373 testes ✅ | Coverage: 100% stmts + 100% branches 🎯 (mantido)~~ — Phase 27
- [x] ~~GET /api/maintenance/plan/:planId: buscar plano de manutenção por ID (REST gap — apenas /:poleId lista existia; 400/404/200, rateLimit 60/min)~~ — Phase 28
- [x] ~~GET /api/video/sessions: listar TODAS as sessões paginado (admin view, filtro status=recording/completed, 400 inválido; rateLimit 60/min)~~ — Phase 28
- [x] ~~useChat hook criado (hooks/useChat.ts): extrai messages/input/loading/handleSend/clearChat de ChatAssistant.tsx (SRP); IDs com useRef counter (anti-colisão)~~ — Phase 28
- [x] ~~ChatAssistant.tsx refatorado: usa useChat; botão clearChat (Trash2); useCallback para scrollToBottom — 141→97 linhas~~ — Phase 28
- [x] ~~api.getMaintenancePlan(planId) + api.getAllVideoSessions() adicionados em api.ts~~ — Phase 28
- [x] ~~tests/maintenancePlanById.test.ts: 5 novos testes (400 abc/0, 404, 200+campos) — insere plano via getDb() direto (sem Groq)~~ — Phase 28
- [x] ~~tests/videoSessionsList.test.ts: 5 novos testes (200 paginado, limit, status=recording/completed, status inválido 400)~~ — Phase 28
- [x] ~~Segurança: 2 alertas CodeQL = falsos positivos (rateLimit() aplicado em maintenance.ts:10 e videoRoutes.ts:251 — CodeQL não reconhece custom middleware)~~ — Phase 28
- [x] ~~Total: 372 server + 11 client = **383 testes** ✅ | Coverage: **100% stmts + 100% branches** 🎯 (mantido)~~ — Phase 28
- [x] ~~`conductors` table: spans elétricos entre postes (MT/BT/Ramal) com CASCADE DELETE, índices e FK enforcement~~ — Phase 29
- [x] ~~GET/POST /api/conductors: listar (filtros tenant_id, pole_id) e criar condutor (validação completa, rateLimit)~~ — Phase 29
- [x] ~~GET/DELETE /api/conductors/:id: buscar e remover condutor (400/404/200)~~ — Phase 29
- [x] ~~Map.tsx: renderiza condutores como Polyline coloridas (MT=laranja, BT=azul, Ramal=verde tracejado) com Tooltip~~ — Phase 29
- [x] ~~ConductorPanel.tsx: novo componente Sidebar para gerenciar condutores do poste selecionado (CRUD inline)~~ — Phase 29
- [x] ~~Sidebar.tsx: aba "Condutores" (Cable icon) visível para todos os roles~~ — Phase 29
- [x] ~~App.tsx: fetchConductors() ao login e ao trocar tenant; conductors passados ao Map; onPoleDeleted filtra condutores localmente~~ — Phase 29
- [x] ~~api.ts: getConductors/getConductor/createConductor/deleteConductor adicionados~~ — Phase 29
- [x] ~~types.ts client: interface Conductor exportada~~ — Phase 29
- [x] ~~tests/conductors.test.ts: 17 novos testes (GET list/filter/400, POST validações/404/201, GET/:id 400/404/200, filtro pole_id, DELETE 400/404/200)~~ — Phase 29
- [x] ~~Total: 389 server + 11 client = **400 testes** ✅ | Coverage: **100% stmts + 100% branches** 🎯 (mantido)~~ — Phase 29
- [x] ~~preventiveService.ts: getPriority/getActivities/generatePreventivePlans/getPreventiveSchedule (determinístico, sem IA; DEFAULT_COST_BY_PRIORITY constantes)~~ — Phase 38
- [x] ~~POST /api/maintenance/generate-preventive?tenant_id: gera planos para postes AHI<50 sem plano PENDING; insere em maintenance_plans; evita duplicatas~~ — Phase 38
- [x] ~~GET /api/maintenance/preventive-schedule?tenant_id: cronograma PENDING dos últimos 90 dias ordenado por AHI asc~~ — Phase 38
- [x] ~~tests/preventiveMaintenance.test.ts: 14 testes (6 unit getPriority/getActivities + 8 integration 400/generate/priority/noSaudável/noDuplicata/schedule)~~ — Phase 38
- [x] ~~permissions table: (user_id, resource, action) UNIQUE constraint, INDEX idx_permissions_user, FK CASCADE DELETE (migration-safe, Phase 37)~~ — Phase 37
- [x] ~~GET /api/users/:id/permissions: lista permissões granulares do usuário (ADMIN-only, 400/403/404/200)~~ — Phase 37
- [x] ~~PUT /api/users/:id/permissions: substitui permissões (ADMIN-only; whitelist resources/actions; idempotente — DELETE+INSERT OR IGNORE)~~ — Phase 37
- [x] ~~checkGranularPermission(resource, action): middleware que combina role (ADMIN bypass), DB permissions, e DEFAULT_ROLE_PERMISSIONS por role como fallback~~ — Phase 37
- [x] ~~tests/permissions.test.ts: 12 testes (GET 400/403/404/200, PUT 400/403/array/resource/200/getAfterPut/idempotente, middleware ADMIN)~~ — Phase 37
- [x] ~~GET /api/report/circuit/:circuitId: PDF técnico de circuito via PDFKit (capa, tabela de postes, tabela de condutores, planos de manutenção)~~ — Phase 44
- [x] ~~DEFAULT_AHI_SCORE = 100 constante para cálculo de média no relatório (Phase 44)~~ — Phase 44
- [x] ~~tests/circuitReport.test.ts: 5 testes (400 abc, 400/0, 404, content-type pdf, content-disposition filename)~~ — Phase 44
- [x] ~~CodeQL: 3 alertas = falsos positivos (rateLimit aplicado em reportRoutes:/circuit/:circuitId e users:/:id/permissions GET+PUT)~~ — Phase 38/37/44
- [x] ~~Total: 516 server + 11 client = **527 testes** ✅ | Coverage: **100% stmts + 100% branches** 🎯 (mantido)~~ — Phase 38/37/44
- [x] ~~`geocodeService.ts`: reverseGeocode (Nominatim, throttle 1req/s, retry exponencial até MAX_RETRIES=2, exported _resetThrottleForTest)~~ — Phase 46
- [x] ~~`address_cache TEXT`: migration segura em db.ts (ALTER TABLE poles ADD COLUMN, try/catch)~~ — Phase 46
- [x] ~~GET /api/poles/:id/address: retorna endereço do cache ou chama Nominatim → persiste cache; 400/404/502~~ — Phase 46
- [x] ~~GET /api/poles/:id/timeline: merge de labels (inspeção) + ahi_history (snapshot), sorted by date DESC, delta_ahi calculado por par consecutivo~~ — Phase 45
- [x] ~~`InspectionTimeline.tsx`: componente vertical com dot + linha guia, inspection em roxo-dinâmico, ahi_snapshot em azul, TrendingUp/Down badge~~ — Phase 45
- [x] ~~PoleDetails.tsx: seção "Timeline de Eventos" com InspectionTimeline abaixo do AhiHistoryChart~~ — Phase 45
- [x] ~~`offlineBundle.ts`: GET /api/offline-bundle?tenant_id= retorna snapshot JSON comprimido gzip (postes + condutores + circuitos, MAX 5000 cada)~~ — Phase 48
- [x] ~~types.ts client: TimelineInspectionEntry, TimelineAhiEntry, TimelineEntry (union), GeoAddress adicionados~~ — Phase 45/46
- [x] ~~api.ts client: getPoleTimeline, getPoleAddress, getOfflineBundle adicionados~~ — Phase 45/46/48
- [x] ~~tests/poleTimeline.test.ts: 7 testes (400 abc/0, 404, 200+count, campos inspection, delta_ahi, vazio)~~ — Phase 45
- [x] ~~tests/geocoding.test.ts: 6 testes (3 unit geocodeService mock axios + 3 HTTP cache hit/400/404)~~ — Phase 46
- [x] ~~tests/offlineBundle.test.ts: 5 testes (400 string/0, 200+gzip header, campos JSON, sem tenant_id)~~ — Phase 48
- [x] ~~Total: 534 server + 11 client = **545 testes** ✅ | Coverage: **100% stmts + 100% branches** 🎯 (mantido)~~ — Phase 45/46/48

## 11. Modos de Captura de Vídeo (Phase 4)

### Modo Foto (`frame`)
- Ativo quando: conexão disponível E usuário seleciona "Modo Foto"
- Comportamento: captura frame JPEG a cada 2.5s da câmera do dispositivo
- Envia para `POST /api/video/frame` — análise Groq AI imediata
- Resultado exibido em tempo real no painel Vídeo da Sidebar
- Fallback: se envio falhar por rede, frame enfileirado no IndexedDB

### Modo Gravação (`recording`)
- Ativo quando: offline OU usuário seleciona "Gravar"
- Comportamento: MediaRecorder WebM a 800kbps, chunks a cada 2s
- Ao parar: upload sequencial de chunks para `POST /api/video/upload`
- Quando `isLast=true`: servidor monta `recording.webm` final
- Se offline: chunks enfileirados no IndexedDB para upload ao reconectar

### DB: `video_sessions`
- Campos: `id, pole_id, tenant_id, mode, status, frame_count, blob_path, started_at, completed_at`
- Status: `recording → completed`

---

## 12. Segurança

- JWT HS256, secret em variável de ambiente (`JWT_SECRET`)
- bcrypt hash de senhas (rounds=10)
- Rate limiting em todos os endpoints (custom middleware `rateLimit.ts`)
- Input sanitization: enum whitelists, length caps, parseInt/parseFloat guards
- Nota: CodeQL `js/missing-rate-limiting` detecta falsos positivos pois não reconhece o custom middleware. Todos os alertas de Phase 9–11 são falsos positivos — `rateLimit()` é aplicado em todos os handlers indicados.
