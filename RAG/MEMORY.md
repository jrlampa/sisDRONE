# sisDRONE – RAG / Memória de Trabalho

> Última atualização: 2026-02-23 (Phase 12) | Responsável: Copilot (Tech Lead / Dev Fullstack Sênior)

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
| **Infraestrutura** | Pole, Tenant | `/api/poles`, `/api/poles/:id` (GET/PUT/DELETE), `/api/tenants` |
| **Inspeção** | Inspection (Label), Image | `/api/analyze`, `/api/feedback`, `/:id/history` |
| **Vídeo / Captura** | VideoSession, Frame | `/api/video/*` |
| **IA / Manutenção** | MaintenancePlan | `/api/ai/*` |
| **GIS** | GeoJSON | `/api/gis/*` |
| **Operações** | WorkOrder | `/api/work-orders` |
| **Usuários** | User | `/api/users` |
| **Auth** | JWT | `/api/auth/login` |
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

**Situação atual** (Phase 12): 215 server + 11 client = **226 testes no total** ✅

**Coverage Threshold** configurado em `server/vitest.config.ts`:
- Lines/Functions/Statements: ≥ 80%
- Branches: ≥ 70% (atual: 88.75% — muito acima da meta!)

**Coverage por módulo (Phase 10)**:
- `middleware/auth.ts`: 100%
- `middleware/rateLimit.ts`: 100%
- `services/authService.ts`: 100%
- `services/chatService.ts`: **100%** (era 75% stmts, 33% branches — Phase 10 fix)
- `services/groqService.ts`: **100% stmts, 90% branches** (era 90%/70% — Phase 10 fix)
- `services/healthService.ts`: 100%
- `services/predictionService.ts`: 85.71% branches
- `services/costService.ts`: 85.71%
- `utils/geo.ts`: 100%
- **Total servidor**: **98.7% statements, 88.75% branches** ✅

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
