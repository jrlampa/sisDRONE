# sisDRONE — Roadmap de Desenvolvimento

> **Baseline**: Phase 29 (Condutores Elétricos) — 400 testes | 100% stmts + branches  
> **Stack**: React 19 + TypeScript · Node/Express 5 · SQLite · Groq AI · Leaflet 2.5D · Docker  
> **Regras permanentes**: Zero custo · pt-BR · DDD · 2.5D · ≥80% cobertura · Docker first

---

## Legenda de Prioridade

| Símbolo | Significado |
|---------|-------------|
| 🔴 | Alta — bloqueante para campo / produção |
| 🟡 | Média — melhoria relevante de produto |
| 🟢 | Baixa — qualidade / experiência |

---

## Phase 30 — Topologia de Rede (Grafo Elétrico) 🔴

**Objetivo**: Modelar a rede elétrica como um grafo dirigido e expor análises topológicas.

### Backend
- `GET /api/network/graph?tenant_id=` — retorna `{ nodes: Pole[], edges: Conductor[] }` em formato JSON-Graph
- `GET /api/network/segments` — identifica segmentos contíguos (componentes conectados) usando BFS/DFS em `utils/graph.ts`
- `GET /api/network/isolated` — lista postes sem nenhum condutor conectado
- Serviço `networkService.ts` — algoritmos de grafo (BFS, componentes conectados)

### Frontend
- Painel "Topologia" no AnalyticsDashboard: contador de segmentos, postes isolados e conectividade geral
- Marcadores de postes isolados no mapa com ícone diferenciado (triângulo amarelo)

### Testes
- `tests/networkGraph.test.ts` — 8 testes (graph response, segmentos, postes isolados, filtro tenant)

---

## Phase 31 — Croqui Digital Exportável (SVG + PDF) 🔴

**Objetivo**: Gerar o "croqui digital" da rede — representação vetorial topológica de postes e condutores para uso em campo e projetos.

### Backend
- `GET /api/report/croqui/:tenantId` — gera SVG escalado da rede: postes como círculos, condutores como linhas coloridas por tipo (MT/BT/ramal), numeração, escala gráfica
- `GET /api/report/croqui/:tenantId/pdf` — converte SVG em PDF via `pdfkit` (sem dependência externa)
- Serviço `croquiService.ts` — cálculo de bounding box, normalização de coordenadas, renderização vetorial

### Frontend
- Botão "Exportar Croqui PDF" no Sidebar (role ENGINEER+)
- Preview SVG inline no modal antes do download
- `api.getCroqui(tenantId)` + `api.getCroquiPdf(tenantId)`

### Testes
- `tests/croqui.test.ts` — 6 testes (SVG válido, campos corretos, PDF buffer, sem postes = 400)

---

## Phase 32 — Comprimento de Vão Automático 🔴

**Objetivo**: Calcular automaticamente o comprimento de cada vão (condutor) a partir das coordenadas geográficas dos postes, usando Haversine.

### Backend
- `PUT /api/conductors/:id` — endpoint de atualização (missing no Phase 29); aceita `cable_type`, `voltage_kv`, `length_m`, `notes`, `network_type`
- Migration: `ALTER TABLE conductors ADD COLUMN computed_length_m REAL` — preenchido automaticamente no POST/PUT usando `utils/geo.ts haversineDistance()`
- `POST /api/conductors` — calcula e persiste `computed_length_m` automaticamente se ambos postes têm coordenadas

### Frontend
- `ConductorPanel.tsx` — exibe "Comprimento calculado: X.X m" abaixo do campo manual
- `api.updateConductor(id, data)` adicionado em `api.ts`

### Testes
- `tests/conductorsPut.test.ts` — 7 testes (PUT 400/404/200, computed_length preenchido, campos opcionais)

---

## Phase 33 — Queda de Tensão e Carregamento de Rede 🟡

**Objetivo**: Calcular queda de tensão estimada nos vãos e alertar trechos sobrecarregados.

### Backend
- `GET /api/network/voltage-drop?tenant_id=` — para cada condutor com `voltage_kv` e `length_m`, calcula `ΔV = R·I·L / (V·1000)` (simplificado); retorna lista com `conductor_id`, `delta_v_percent`, `status` (ok/warning/critical)
- Regras: ΔV > 5% = warning, > 10% = critical (limites NBR 5410)
- Serviço `voltageService.ts` — cálculo puro, testável

### Frontend
- Legenda de queda de tensão no painel de Topologia
- Condutores com ΔV crítico exibidos tracejado vermelho no mapa

### Testes
- `tests/voltageDrop.test.ts` — 6 testes (ok/warning/critical, sem length = skip, tenant filter)

---

## Phase 34 — Histórico de AHI (Série Temporal) 🟡

**Objetivo**: Registrar e visualizar a evolução do AHI de cada poste ao longo do tempo.

### Backend
- Nova tabela `ahi_history (id, pole_id, tenant_id, ahi_score, recorded_at)` — atualizada em toda inspeção que altera o AHI
- Migration segura via `CREATE TABLE IF NOT EXISTS`
- `GET /api/poles/:id/ahi-history?limit=30` — retorna série temporal de AHI
- Trigger em `POST /api/analyze` e `PUT /api/poles/:id` — grava snapshot de AHI quando score muda

### Frontend
- Gráfico de linha (Recharts `<LineChart>`) na aba "Detalhes" do PoleDetails mostrando evolução do AHI
- Componente `AhiHistoryChart.tsx` (< 150 linhas)

### Testes
- `tests/ahiHistory.test.ts` — 6 testes (criação, lista, limite, campos, sem histórico = array vazio)

---

## Phase 35 — Notificações em Tempo Real (WebSocket) 🟡

**Objetivo**: Notificar usuários conectados de eventos críticos sem polling.

### Backend
- Expandir `ws` server existente (usado em `DroneLiveView`): canal `notifications`
- Broadcast para todos os clientes do mesmo `tenant_id` quando:
  - AHI de poste cai abaixo de 30 (crítico)
  - Nova inspeção com condição "crítica" é registrada
  - Ordem de serviço é criada com prioridade CRITICAL
- Serviço `notificationService.ts` — gerencia conexões WS por tenant e emite eventos tipados

### Frontend
- Hook `useNotifications.ts` — conecta ao WS, decodifica eventos
- Banner flutuante `NotificationBanner.tsx` — aparece no canto superior direito com título, mensagem e link para o poste/OS afetado (auto-fecha em 8s)

### Testes
- `tests/notificationService.test.ts` — 5 testes de unidade (criação de canal, broadcast, filtragem por tenant)

---

## Phase 36 — Importação em Massa de Postes (CSV/GeoJSON) 🟡

**Objetivo**: Permitir importação em lote de postes via arquivo CSV ou GeoJSON.

### Backend
- `POST /api/poles/import/csv` — aceita multipart/form-data com arquivo CSV; valida cabeçalho (`name,lat,lng,material,status`); insere em transação; retorna `{ imported, errors[] }`
- Validação por linha: lat/lng numéricos e dentro de bounding box do Brasil, material whitelist, max 1000 linhas por lote
- `POST /api/gis/import/geojson` (já existe) — expandido com validação de `properties` obrigatórias

### Frontend
- Modal "Importar Postes" com drag-and-drop, preview de 5 primeiras linhas, barra de progresso
- Componente `ImportModal.tsx` (< 200 linhas)
- `api.importPolesCSV(file)` em `api.ts`

### Testes
- `tests/polesImportCSV.test.ts` — 8 testes (CSV válido, cabeçalho errado, linha inválida, transação, max 1000, 415 tipo errado)

---

## Phase 37 — RBAC Granular por Tenant 🔴

**Objetivo**: Controle de acesso por permissão além dos roles ADMIN/ENGINEER/VIEWER.

### Backend
- Nova tabela `permissions (id, user_id, resource, action)` — ex: `poles/create`, `work_orders/delete`, `bim/edit`
- `GET/PUT /api/users/:id/permissions` — gerenciar permissões (somente ADMIN)
- Middleware `checkGranularPermission(resource, action)` — combina role + permission table
- Migração: permissões padrão inseridas na seeding por role

### Frontend
- Painel de administração de usuários com checkboxes de permissão (somente ADMIN)
- Componente `UserPermissionsPanel.tsx`

### Testes
- `tests/permissions.test.ts` — 8 testes (GET/PUT permissões, negação de acesso, padrão por role)

---

## Phase 38 — Plano de Manutenção Preventiva Automática 🟡

**Objetivo**: Gerar automaticamente planos de manutenção baseados em AHI + EOL + custo de materiais.

### Backend
- Serviço `preventiveService.ts` — para cada poste com AHI < 50 sem plano ativo: calcula custo estimado usando `materials` table, gera `plan_text` estruturado (atividades, materiais, prioridade)
- `POST /api/maintenance/generate-preventive?tenant_id=` — executa serviço e retorna planos gerados (sem Groq — cálculo determinístico)
- `GET /api/maintenance/preventive-schedule` — agenda dos próximos 90 dias ordenado por AHI asc

### Frontend
- Botão "Gerar Plano Preventivo" no AnalyticsDashboard (ADMIN/ENGINEER)
- Lista de planos gerados com custo estimado e prioridade no KanbanBoard

### Testes
- `tests/preventiveMaintenance.test.ts` — 7 testes (geração, custo calculado, skip sem material, schedule 90 dias)

---

## Phase 39 — Documentação OpenAPI (Swagger UI) 🟢

**Objetivo**: Auto-documentar a API REST e disponibilizar Swagger UI integrado.

### Backend
- Dependência: `swagger-jsdoc` + `swagger-ui-express` (gratuitas, npm)
- Anotações JSDoc em todas as rotas (`@openapi`) — geração automática de spec
- `GET /api/docs` — Swagger UI embutido (desativável em produção via `SWAGGER_ENABLED=false`)
- `GET /api/docs/json` — OpenAPI 3.0 spec em JSON

### Testes
- `tests/swagger.test.ts` — 4 testes (GET /api/docs 200, GET /api/docs/json válido, paths contém /api/poles, info.version presente)

---

## Phase 40 — Cache de Respostas (In-Memory TTL) 🟢

**Objetivo**: Reduzir carga no SQLite em endpoints pesados com cache simples em memória.

### Backend
- Módulo `utils/cache.ts` — Map com TTL, `get(key)`, `set(key, value, ttlMs)`, `invalidate(prefix)`, `clear()`
- Aplicado em: `GET /api/poles/stats` (TTL 30s), `GET /api/poles/heatmap` (TTL 60s), `GET /api/network/graph` (TTL 30s)
- Invalidação automática: ao criar/editar/deletar poste → invalida prefix `poles.*`

### Testes
- `tests/cache.test.ts` — 6 testes de unidade (set/get, TTL expiry, invalidate prefix, clear, hit/miss counter)

---

## Phase 41 — Circuitos Elétricos (Agrupamento de Rede) 🔴

**Objetivo**: Organizar postes e condutores em "circuitos" nomeados por trecho ou alimentador.

### Backend
- Nova tabela `circuits (id, tenant_id, name, description, color, created_at)`
- `ALTER TABLE poles ADD COLUMN circuit_id INTEGER FK circuits(id)`
- `ALTER TABLE conductors ADD COLUMN circuit_id INTEGER FK circuits(id)`
- CRUD `/api/circuits` (GET list, POST, GET/:id, PUT/:id, DELETE/:id com cascade de circuit_id)
- `GET /api/circuits/:id/stats` — AHI médio, total postes, total condutores, extensão km, custo estimado

### Frontend
- Filtro de circuito no mapa (select no header) — filtra postes e condutores do circuito selecionado
- Aba "Circuito" no PoleDetails — associar/desassociar poste a um circuito

### Testes
- `tests/circuits.test.ts` — 10 testes (CRUD, stats, filtro por circuit_id em /api/poles)

---

## Phase 42 — Validação de Topologia da Rede 🟡

**Objetivo**: Detectar automaticamente inconsistências topológicas (loops, postes isolados, segmentos desconexos).

### Backend
- `GET /api/network/validate` — executa conjunto de verificações e retorna relatório:
  - `loops`: condutores que formam ciclos (usando DFS)
  - `dead_ends`: postes com apenas 1 conexão (fim de linha legítimo vs. erro)
  - `isolated`: postes sem nenhuma conexão
  - `duplicate_spans`: dois condutores com mesmo par from/to
- Serviço `topologyValidator.ts` (algoritmos puros, testáveis)

### Frontend
- Painel "Validação" no AnalyticsDashboard — lista de problemas com link clicável para o poste no mapa

### Testes
- `tests/topologyValidation.test.ts` — 8 testes (loops detectados, isolados, sem problemas = listas vazias, duplicatas)

---

## Phase 43 — Dashboard Executivo Multi-Tenant (ADMIN Global) 🟡

**Objetivo**: Visão consolidada cross-tenant para administradores da plataforma.

### Backend
- `GET /api/admin/overview` — (somente role ADMIN) retorna agregados por tenant: total postes, AHI médio, postes críticos, OS abertas, última inspeção
- `GET /api/admin/tenants/stats` — tabela comparativa entre tenants
- Middleware: verificação de role ADMIN global (não apenas por tenant)

### Frontend
- View `ADMIN_OVERVIEW` no `viewMode` do App.tsx — substituindo o mapa por painel de cards por tenant
- Componente `AdminOverview.tsx` com tabela comparativa e gráfico de barras (Recharts)

### Testes
- `tests/adminOverview.test.ts` — 5 testes (200, campos por tenant, ENGINEER = 403, total correto)

---

## Phase 44 — Relatório de Circuito (PDF Completo) 🔴

**Objetivo**: Exportar PDF técnico de um circuito/trecho completo com postes, condutores, AHI e planos de manutenção.

### Backend
- `GET /api/report/circuit/:circuitId` — gera PDF com:
  - Capa com tenant, circuito, data, AHI médio
  - Tabela de postes (nome, material, AHI, status, última inspeção)
  - Tabela de condutores (vão, tipo, comprimento, tensão)
  - Mapa de calor textual (AHI histogram)
  - Planos de manutenção ativos
- Usando `pdfkit` (já no projeto), sem dependência nova

### Frontend
- Botão "Relatório de Circuito PDF" na view de circuito (ENGINEER+)
- `api.getCircuitReportUrl(circuitId)` em `api.ts`

### Testes
- `tests/circuitReport.test.ts` — 5 testes (PDF buffer, 404 circuito, 400 id inválido, content-type, disposição)

---

## Phase 45 — Timeline de Inspeções por Poste 🟢

**Objetivo**: Linha do tempo visual das inspeções de um poste, com miniaturas de imagens e variação de AHI.

### Backend
- `GET /api/poles/:id/timeline` — retorna inspeções + imagens + variações de AHI ordenadas por data, enriquecidas com `delta_ahi` (diferença entre inspeções consecutivas)

### Frontend
- Componente `InspectionTimeline.tsx` — timeline vertical com marcadores por data, ícone de condição (✅⚠️🔴), miniatura da imagem capturada e badge de AHI
- Nova aba "Timeline" no PoleDetails (substituindo ou complementando "Histórico")

### Testes
- `tests/poleTimeline.test.ts` — 6 testes (campos retornados, delta_ahi calculado, sem inspeções = array vazio, 400/404)

---

## Phase 46 — Geocodificação Reversa dos Postes (Endereço) 🟢

**Objetivo**: Associar endereço textual a cada poste usando Nominatim (OpenStreetMap) — gratuito, sem chave de API.

### Backend
- `GET /api/poles/:id/address` — consulta `https://nominatim.openstreetmap.org/reverse?lat=&lon=&format=json` e retorna endereço formatado; armazena em cache na coluna `address_cache TEXT` do poste (migration)
- Serviço `geocodeService.ts` com retry exponencial e User-Agent correto (respeita Nominatim TOS)
- Rate limit: 1 req/s para Nominatim (sem ultrapassar política de uso)

### Frontend
- Endereço exibido em PoleDetails abaixo das coordenadas (carregado lazy ao abrir)
- Botão "Atualizar Endereço" para forçar re-geocodificação

### Testes
- `tests/geocoding.test.ts` — 5 testes de unidade em `geocodeService.ts` (mock axios, cache hit, campos retornados, erro 404 nominatim, retry)

---

## Phase 47 — Simulação de Falha na Rede 🟡

**Objetivo**: Simular a remoção de um poste ou condutor e visualizar o impacto na conectividade da rede (segmentos afetados).

### Backend
- `GET /api/network/simulate-failure?pole_id=` — executa grafo sem o poste informado; retorna: postes desconectados, segmentos particionados, quantidade de clientes potencialmente afetados (heurística: postes * fator configurável)
- `GET /api/network/simulate-failure?conductor_id=` — mesmo para remoção de condutor
- Serviço `failureSimulator.ts` — reutiliza `networkService.ts` com nó/aresta removida temporariamente (sem persistência)

### Frontend
- Botão "Simular Falha" no PoleDetails (ENGINEER+) — abre overlay no mapa destacando postes afetados em vermelho pulsante
- Hook `useFailureSimulation.ts`

### Testes
- `tests/failureSimulation.test.ts` — 7 testes (falha de poste central, falha de folha, condutor crítico, sem impacto, 400/404)

---

## Phase 48 — PWA Offline-First Otimizado (Campo) 🔴

**Objetivo**: Tornar o sisDRONE totalmente funcional em campo sem conexão — instalável como PWA com sincronização inteligente.

### Frontend
- Resolver erros de build do `vite-plugin-pwa` (bundle splitting para < 2MiB por chunk):
  - `vite.config.ts`: `manualChunks` separando leaflet, recharts, react-pdf, lucide
  - `workbox.maximumFileSizeToCacheInBytes = 5MiB`
- Service Worker: cache estratégico — `GET /api/poles` (network-first), `GET /api/poles/heatmap` (stale-while-revalidate 5min)
- Manifest completo: nome, ícones (512px), display: standalone, theme_color
- Banner de instalação `InstallBanner.tsx` — aparece após 2 dias de uso

### Backend
- `GET /api/offline-bundle?tenant_id=` — endpoint que retorna snapshot JSON de todos os dados do tenant para cache offline inicial (postes, condutores, circuitos) — comprimido (gzip)

### Testes
- `tests/offlineBundle.test.ts` — 5 testes (200, gzip, campos obrigatórios, tenant filter, limite de registros)

---

## Phase 49 — KPIs Executivos e Indicadores de Confiabilidade 🟡

**Objetivo**: Painel de indicadores de desempenho da rede para gestores — MTTR, DEC/FEC estimados, custo de manutenção.

### Backend
- `GET /api/kpis?tenant_id=&period_days=30` — calcula e retorna:
  - **MTTR** (Mean Time to Repair): média do tempo entre criação e conclusão de OS
  - **Taxa de inspeção**: % de postes inspecionados nos últimos `period_days`
  - **Custo total de manutenção**: soma de `estimated_cost` de planos no período
  - **AHI médio da rede**: evolução vs. período anterior (delta %)
  - **Postes recuperados**: AHI saiu de crítico para atenção/bom no período
- Serviço `kpiService.ts` (cálculo puro)

### Frontend
- View `EXECUTIVE_KPI` no `viewMode` — painel de 6 cards com ícone, valor, delta e sparkline (mini Recharts)
- Componente `ExecutiveDashboard.tsx` (< 300 linhas)
- Botão "KPIs" no header (somente ADMIN/ENGINEER)

### Testes
- `tests/kpis.test.ts` — 8 testes (200, MTTR calculado, taxa inspeção, custo, delta AHI, período customizado, tenant filter, sem dados = zeros)

---

## Sumário das Phases 30–49

| Phase | Domínio | Prioridade | Impacto Principal |
|-------|---------|------------|-------------------|
| 30 | Topologia de Rede (Grafo) | 🔴 | Conectividade da rede, ilhas elétricas |
| 31 | Croqui Digital SVG/PDF | 🔴 | Ferramenta de campo — representação vetorial |
| 32 | Comprimento de Vão Automático | 🔴 | Cálculo automático de vãos por Haversine |
| 33 | Queda de Tensão | 🟡 | Alerta de trechos sobrecarregados (NBR 5410) |
| 34 | Histórico de AHI (Série Temporal) | 🟡 | Rastreabilidade de degradação de ativos |
| 35 | Notificações WebSocket | 🟡 | Alertas em tempo real para equipes de campo |
| 36 | Importação em Massa CSV | 🟡 | Onboarding rápido de grandes redes |
| 37 | RBAC Granular | 🔴 | Controle de acesso por permissão/recurso |
| 38 | Manutenção Preventiva Automática | 🟡 | Redução de falhas por antecipação |
| 39 | Documentação OpenAPI (Swagger) | 🟢 | API pública documentada e integrável |
| 40 | Cache In-Memory TTL | 🟢 | Performance em endpoints de alta leitura |
| 41 | Circuitos Elétricos | 🔴 | Agrupamento de rede por alimentador |
| 42 | Validação de Topologia | 🟡 | Qualidade de dados, detecção de erros |
| 43 | Dashboard Executivo Multi-Tenant | 🟡 | Visão consolidada para administradores |
| 44 | Relatório de Circuito PDF | 🔴 | Entrega técnica completa por trecho |
| 45 | Timeline de Inspeções | 🟢 | Rastreabilidade visual por poste |
| 46 | Geocodificação Reversa (Nominatim) | 🟢 | Endereço humano para cada poste |
| 47 | Simulação de Falha | 🟡 | Análise de impacto para planos de contingência |
| 48 | PWA Offline-First Otimizado | 🔴 | Uso total em campo sem conexão |
| 49 | KPIs Executivos | 🟡 | MTTR, custo, DEC/FEC para gestão |

---

## Princípios Arquiteturais Fixos (Todas as Phases)

1. **Zero Custo** — apenas APIs públicas/gratuitas (Nominatim, dados.gov.br, Groq free tier)
2. **Smart Backend** — toda lógica de negócio no servidor; frontend thin e declarativo
3. **2.5D** — Leaflet 2D com elevação e AHI textual; proibido Three.js ou WebGL
4. **DDD modular** — cada domínio em seus próprios `routes/`, `services/`, `tests/`
5. **≥ 80% coverage** — meta obrigatória; branches ≥ 70%
6. **Arquivos ≤ 500 linhas** — modularizar ao ultrapassar
7. **pt-BR** — toda UI, mensagens, labels e erros em português do Brasil
8. **Docker First** — toda alteração de infra deve refletir em `docker-compose.yml` e Dockerfiles
9. **Sanitização** — todos os inputs de API validados antes de persistência (whitelist, parseInt, length caps)
10. **RAG atualizado** — ao final de cada phase, atualizar `RAG/MEMORY.md` com o novo estado

---

*Documento gerado em 2026-02-24 | Tech Lead: Copilot*
