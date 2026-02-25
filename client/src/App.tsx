import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar/Sidebar';
import MobileFab from './components/MobileFab';
import LoginPage from './components/LoginPage';
import AneelSearchPanel from './components/AneelSearchPanel';
import AlertBanner from './components/AlertBanner';
import NotificationBanner from './components/NotificationBanner';
import DrawConductorModal from './components/DrawConductorModal';
import MapLayerControls, { DEFAULT_LAYER_VISIBILITY, type LayerVisibility } from './components/MapLayerControls';
import { useNotifications } from './hooks/useNotifications';
import { Zap, Menu, Building, LogOut, GitBranch } from 'lucide-react';
import { api } from './services/api';
import { useNetwork } from './hooks/useNetwork';
import { useAppHandlers } from './hooks/useAppHandlers';
import { usePoleSearch } from './hooks/usePoleSearch';
import { TenantProvider } from './context/TenantContext';
import { WifiOff, RefreshCw } from 'lucide-react';
import type { Pole, Span, Inspection, AnalysisResult, Tenant, User, Conductor } from './types';

// Lazy-load heavy view components to reduce initial bundle size
const AnalyticsDashboard = lazy(() => import('./components/Dashboard/AnalyticsDashboard'));
const KanbanBoard = lazy(() => import('./components/WorkOrders/KanbanBoard'));
const DroneLiveView = lazy(() => import('./components/Dashboard/DroneLiveView'));
const ChatAssistant = lazy(() => import('./components/ChatAssistant'));

const API_BASE = 'http://localhost:3001';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('sisdrone_jwt'));

  const {
    poles, setPoles, stats, fetchStats, fetchPoles,
    alerts, fetchAlerts,
    activeTenantId, setActiveTenantId,
    currentUser, setCurrentUser,
    isOnline, isSyncing
  } = useNetwork();

  // ── UI State ──
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [selectedPole, setSelectedPole] = useState<Pole | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<Inspection[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'eng' | 'video' | 'bim' | 'conductors' | 'topology' | 'validation' | 'kpi' | 'admin' | 'equipment' | 'drone' | 'wizard'>('details');
  const [notification, setNotification] = useState<string | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementStart, setMeasurementStart] = useState<Pole | null>(null);
  const [activeSpan, setActiveSpan] = useState<Span | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCondition, setFilterCondition] = useState<'All' | 'Critical' | 'Warning' | 'Good'>('All');
  const [viewMode, setViewMode] = useState<'MAP' | 'ANALYTICS' | 'WORK_ORDERS' | 'DRONE_LIVE'>('MAP');
  const [conductorWeight, setConductorWeight] = useState(0.545);
  const [tension, setTension] = useState(250);

  const [showAneelPanel, setShowAneelPanel] = useState(false);
  const [conductors, setConductors] = useState<Conductor[]>([]);

  // ── Phase 58: Draw Conductor mode ──
  const [conductorDrawMode, setConductorDrawMode] = useState(false);
  const [drawFromPole, setDrawFromPole] = useState<Pole | null>(null);
  const [drawToPole, setDrawToPole] = useState<Pole | null>(null);
  const [showDrawModal, setShowDrawModal] = useState(false);

  // ── Phase 60: Layer visibility ──
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const [showLayerControls, setShowLayerControls] = useState(false);

  const gisInputRef = useRef<HTMLInputElement>(null!);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const fetchConductors = useCallback(async () => {
    try {
      const res = await api.getConductors(activeTenantId ? { tenant_id: activeTenantId } : undefined);
      setConductors(res.data.conductors);
    } catch {
      // fail silently – condutores não são críticos para o mapa
    }
  }, [activeTenantId]);

  const handleLogin = useCallback((user: User) => {
    setCurrentUser(user);
    setActiveTenantId(user.tenant_id);
    setIsAuthenticated(true);
    fetchPoles();
    fetchStats();
    fetchAlerts();
    fetchConductors();
  }, [setCurrentUser, setActiveTenantId, fetchPoles, fetchStats, fetchAlerts, fetchConductors]);

  /** Phase 58: handle pole click in draw conductor mode */
  const handleDrawPoleSelect = useCallback((pole: Pole) => {
    if (!drawFromPole) {
      setDrawFromPole(pole);
    } else if (pole.id !== drawFromPole.id) {
      setDrawToPole(pole);
      setShowDrawModal(true);
    }
  }, [drawFromPole]);

  const handleCancelDraw = useCallback(() => {
    setConductorDrawMode(false);
    setDrawFromPole(null);
    setDrawToPole(null);
    setShowDrawModal(false);
  }, []);

  const handleConductorCreated = useCallback(() => {
    fetchConductors();
    handleCancelDraw();
    showNotification('Condutor criado com sucesso');
  }, [fetchConductors, handleCancelDraw, showNotification]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('sisdrone_jwt');
    localStorage.removeItem('sisdrone_user');
    localStorage.removeItem('sisdrone_mock_role');
    setIsAuthenticated(false);
  }, []);

  // ── Handlers (extracted) ──
  const {
    handleMapClick, handleMarkerClick, handleFeedback,
    handleImageUpload, handleExportGeoJSON, handleImportGeoJSON,
    handleUserSwitch, handleAnalyzeClick, handleMobileAddPole,
  } = useAppHandlers({
    poles, activeTenantId, isMeasuring, measurementStart,
    selectedPole, analysis, users, tenants,
    setPoles, setSelectedPole, setAnalysis, setHistory, setActiveTab,
    setIsCapturing, setIsMeasuring, setMeasurementStart, setActiveSpan,
    setActiveTenantId, setActiveTenant, setCurrentUser,
    showNotification, fetchStats, fetchPoles,
  });

  // ── Bootstrap ──
  useEffect(() => {
    Promise.all([api.getTenants(), api.getUsers()]).then(([tRes, uRes]) => {
      setTenants(tRes.data);
      setUsers(uRes.data);
      const mockUser = uRes.data.find((u: User) => u.tenant_id === activeTenantId) || uRes.data[0];
      if (mockUser) {
        setCurrentUser(mockUser);
        localStorage.setItem('sisdrone_mock_role', mockUser.role);
      }
      const initial = tRes.data.find((t: Tenant) => t.id === activeTenantId);
      if (initial) setActiveTenant(initial);
    });
  }, [activeTenantId, setCurrentUser]);

  useEffect(() => {
    if (activeTenant) {
      document.documentElement.style.setProperty('--primary', activeTenant.primary_color);
      document.documentElement.style.setProperty('--accent', activeTenant.accent_color);
      document.documentElement.style.setProperty('--accent-hover', activeTenant.primary_color);
      fetchPoles();
      fetchConductors();
    }
  }, [activeTenant, fetchPoles, fetchConductors]);

  useEffect(() => {
    if (selectedPole) {
      api.getHistory(selectedPole.id).then(res => setHistory(res.data)).catch(() => {});
    }
  }, [selectedPole]);

  // ── Filtered poles (via usePoleSearch hook — SRP) ──
  const filteredPoles = usePoleSearch(poles, searchQuery, filterCondition);

  // ── Phase 60: Layer visibility predicates ──
  const poleVisible = useCallback((p: Pole) => {
    const lvl = p.network_level ?? 'BT';
    if (lvl === 'MT') return layerVisibility.polesMT;
    if (lvl === 'AT') return layerVisibility.polesAT;
    return layerVisibility.polesBT;
  }, [layerVisibility]);

  const conductorVisible = useCallback((c: Conductor) => {
    if (c.network_type === 'MT') return layerVisibility.conductorMT;
    if (c.network_type === 'ramal') return layerVisibility.conductorRamal;
    return layerVisibility.conductorBT;
  }, [layerVisibility]);

  // ── Real-time push notifications via WebSocket ──
  const { notifications, dismiss } = useNotifications(activeTenantId);

  return (
    <TenantProvider value={{ activeTenantId, setActiveTenantId, currentUser, setCurrentUser, isOnline }}>
    {!isAuthenticated ? (
      <LoginPage onLogin={handleLogin} />
    ) : (
    <div className="app-container">
      {(!isOnline || isSyncing) && (
        <div className={`connection-status ${isOnline ? 'syncing' : 'offline'}`}>
          {isOnline ? (
            <><RefreshCw size={14} className="spin" /><span>Sincronizando dados...</span></>
          ) : (
            <><WifiOff size={14} /><span>Modo Offline - Alterações serão salvas localmente</span></>
          )}
        </div>
      )}

      <header className="app-header glass-panel">
        <div className="flex items-center gap-4">
          <button className="mobile-menu-btn btn-icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Abrir Menu" title="Abrir Menu">
            <Menu className="text-primary" />
          </button>
          <Zap className="text-accent" />
          <h1 className="logo-text">sisDRONE / {activeTenant?.name || 'Enterprise'}</h1>
        </div>

        <div className="tenant-switcher flex items-center gap-4">
          <button
            className={`btn btn-outline btn-sm ${showAneelPanel ? 'active' : ''}`}
            onClick={() => setShowAneelPanel(!showAneelPanel)}
            title="Buscar Agentes ANEEL"
          >
            <Building size={14} /> ANEEL
          </button>
          <select value={currentUser?.id || ''} onChange={(e) => handleUserSwitch(Number(e.target.value))}
            className="glass-input tenant-select" title="Trocar Usuário">
            {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
          </select>
          <select value={activeTenantId} onChange={(e) => {
            const tid = Number(e.target.value);
            setActiveTenantId(tid);
            const tenant = tenants.find(t => t.id === tid);
            if (tenant) setActiveTenant(tenant);
          }} className="glass-input tenant-select" title="Trocar Concessionária">
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleLogout}
            title="Sair"
            aria-label="Sair do sistema"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>

      <main className="content-wrapper" style={{ position: 'relative' }}>
        {showAneelPanel && (
          <AneelSearchPanel onClose={() => setShowAneelPanel(false)} />
        )}
        <Sidebar
          userRole={currentUser?.role || 'VIEWER'}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isMeasuring={isMeasuring}
          setIsMeasuring={setIsMeasuring}
          handleExportGeoJSON={handleExportGeoJSON}
          handleImportGeoJSON={handleImportGeoJSON}
          gisInputRef={gisInputRef}
          filterCondition={filterCondition}
          setFilterCondition={setFilterCondition}
          selectedPole={selectedPole}
          activeSpan={activeSpan}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCapturing={isCapturing}
          onAnalyze={handleAnalyzeClick}
          analysis={analysis}
          onFeedback={handleFeedback}
          history={history}
          stats={stats || { total: 0, critical: 0, healthy: 0 }}
          conductorWeight={conductorWeight}
          setConductorWeight={setConductorWeight}
          tension={tension}
          setTension={setTension}
          apiBase={API_BASE}
          showHeatmap={showHeatmap}
          setShowHeatmap={setShowHeatmap}
          activeTenant={activeTenant || undefined}
          poles={filteredPoles}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          viewMode={viewMode}
          setViewMode={setViewMode}
          users={users}
          onVideoFrameAnalyzed={(result) => {
            setAnalysis({
              analysis_summary: result.analysis_summary,
              condition: result.condition,
              confidence: result.confidence,
              pole_type: result.pole_type,
              ahi_score: result.ahi_score ?? 100,
              labelId: result.labelId,
              imageId: result.imageId,
              imageUrl: result.imageUrl,
              structures: [],
            });
            fetchStats();
            fetchAlerts();
          }}
          onSelectPole={handleMarkerClick}
          onPoleUpdated={(updated) => {
            setPoles(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
            setSelectedPole(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
            showNotification(`Poste "${updated.name}" atualizado com sucesso`);
            fetchAlerts();
          }}
          onPoleDeleted={(id) => {
            setPoles(prev => prev.filter(p => p.id !== id));
            setConductors(prev => prev.filter(c => c.pole_from !== id && c.pole_to !== id));
            setSelectedPole(null);
            showNotification('Poste removido com sucesso');
            fetchAlerts();
          }}
        />

        <div className="map-container glass-panel" style={{ position: 'relative' }}>
          <AlertBanner alerts={alerts} onSelectPole={handleMarkerClick} />
          {notification && (
            <div className="notification-overlay animate-fade-in">
              <Zap size={16} className="text-primary" /><span>{notification}</span>
            </div>
          )}

          {viewMode === 'MAP' ? (
            <>
              {/* Phase 58: Draw conductor overlay banner */}
              {conductorDrawMode && (
                <div style={{
                  position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 1000, background: 'rgba(59,130,246,0.92)', color: '#fff',
                  borderRadius: 8, padding: '6px 16px', fontSize: '0.85rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}>
                  <GitBranch size={16} />
                  {drawFromPole
                    ? `✓ ${drawFromPole.name || `Poste ${drawFromPole.id}`} — clique no 2º poste`
                    : 'Modo Desenho: clique no 1º poste'}
                  <button onClick={handleCancelDraw} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Cancelar
                  </button>
                </div>
              )}

              <Map
                poles={filteredPoles}
                onMapClick={handleMapClick}
                onMarkerClick={handleMarkerClick}
                selectedPole={selectedPole}
                isMeasuring={isMeasuring}
                activeSpan={activeSpan}
                userRole={currentUser?.role || 'VIEWER'}
                showHeatmap={showHeatmap}
                conductors={conductors}
                drawMode={conductorDrawMode}
                drawFromPoleId={drawFromPole?.id ?? null}
                onDrawPoleSelect={handleDrawPoleSelect}
                poleVisible={poleVisible}
                conductorVisible={conductorVisible}
              />

              {/* Phase 60: Layer controls */}
              <MapLayerControls
                visibility={layerVisibility}
                onChange={setLayerVisibility}
                open={showLayerControls}
                onToggle={() => setShowLayerControls(v => !v)}
              />

              {/* Phase 58: Draw conductor toggle button (ENGINEER+) */}
              {currentUser && currentUser.role !== 'VIEWER' && (
                <button
                  className={`btn btn-sm ${conductorDrawMode ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => {
                    if (conductorDrawMode) { handleCancelDraw(); }
                    else { setConductorDrawMode(true); setDrawFromPole(null); }
                  }}
                  title="Desenhar Condutor (clique em 2 postes)"
                  style={{ position: 'absolute', bottom: 120, right: 16, zIndex: 1000, width: 36, height: 36, padding: 0, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label="Modo Desenho de Condutor"
                >
                  <GitBranch size={18} />
                </button>
              )}
            </>
          ) : viewMode === 'ANALYTICS' ? (
            <Suspense fallback={<div className="p-8 text-center">Carregando Analytics...</div>}>
              <AnalyticsDashboard />
            </Suspense>
          ) : viewMode === 'WORK_ORDERS' ? (
            <Suspense fallback={<div className="p-8 text-center">Carregando Ordens...</div>}>
              <KanbanBoard currentUser={currentUser} users={users} />
            </Suspense>
          ) : (
            <Suspense fallback={<div className="p-8 text-center">Carregando Live...</div>}>
              <DroneLiveView apiBase={API_BASE} />
            </Suspense>
          )}
        </div>
      </main>

      <MobileFab
        onAddPole={handleMobileAddPole}
        onCameraCapture={handleImageUpload}
        isCapturing={isCapturing}
      />
      <Suspense fallback={null}>
        <ChatAssistant selectedPole={selectedPole} analysis={analysis} />
      </Suspense>
      <NotificationBanner
        notifications={notifications}
        onDismiss={dismiss}
        onPoleClick={handleMarkerClick}
      />
      {/* Phase 58: Draw Conductor confirmation modal */}
      {showDrawModal && drawFromPole && drawToPole && (
        <DrawConductorModal
          fromPole={drawFromPole}
          toPole={drawToPole}
          open={showDrawModal}
          onClose={handleCancelDraw}
          onCreated={handleConductorCreated}
          tenantId={activeTenantId}
        />
      )}
    </div>
    )}
    </TenantProvider>
  );
};

export default App;
