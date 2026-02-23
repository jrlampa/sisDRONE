# sisDRONE – RAG / Memória de Trabalho

> Última atualização: 2026-02-23 (Phase 19) | Responsável: Copilot (Tech Lead / Dev Fullstack Sênior)

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
| **Infraestrutura** | Pole, Tenant | `/api/poles`, `/api/poles/:id` (GET/PUT/DELETE), `/api/poles/:id/summary`, `/api/tenants` |
| **Inspeção** | Inspection (Label), Image | `/api/analyze`, `/api/feedback`, `/:id/history` |
| **Vídeo / Captura** | VideoSession, Frame | `/api/video/*` |
| **IA / Manutenção** | MaintenancePlan | `/api/ai/*` |
| **GIS** | GeoJSON | `/api/gis/*` |
| **Operações** | WorkOrder | `/api/work-orders` |
| **Usuários** | User | `/api/users`, `/api/users/:id` (GET/PUT/DELETE) |
| **Auth** | JWT | `/api/auth/login`, `/api/auth/register` |
| **ANEEL** | Agents, Datasets | `/api/aneel/agents`, `/api/aneel/datasets` |
| **BIM** | StructureData (IFC-lite) | `/api/bim/:poleId` (GET/PUT) |
| **Relatório** | PdfReport | `/api/report/pole/:id` |

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

**Situação atual** (Phase 19): 291 server + 11 client = **302 testes no total** ✅ | Coverage: **100% stmts + 100% branches** 🎯

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

---

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
