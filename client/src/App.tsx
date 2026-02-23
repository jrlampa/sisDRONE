import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar/Sidebar';
import MobileFab from './components/MobileFab';
import LoginPage from './components/LoginPage';
import AneelSearchPanel from './components/AneelSearchPanel';
import AlertBanner from './components/AlertBanner';
import { Zap, Menu, Building, LogOut } from 'lucide-react';
import { api } from './services/api';
import { useNetwork } from './hooks/useNetwork';
import { useAppHandlers } from './hooks/useAppHandlers';
import { TenantProvider } from './context/TenantContext';
import { WifiOff, RefreshCw } from 'lucide-react';
import type { Pole, Span, Inspection, AnalysisResult, Tenant, User } from './types';

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
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'eng' | 'video' | 'bim'>('details');
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

  const gisInputRef = useRef<HTMLInputElement>(null!);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleLogin = useCallback((user: User) => {
    setCurrentUser(user);
    setActiveTenantId(user.tenant_id);
    setIsAuthenticated(true);
    fetchPoles();
    fetchStats();
    fetchAlerts();
  }, [setCurrentUser, setActiveTenantId, fetchPoles, fetchStats, fetchAlerts]);

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
    }
  }, [activeTenant, fetchPoles]);

  useEffect(() => {
    if (selectedPole) {
      api.getHistory(selectedPole.id).then(res => setHistory(res.data)).catch(() => {});
    }
  }, [selectedPole]);

  // ── Filtered poles (memoized) ──
  const filteredPoles = useMemo(() => poles.filter(pole => {
    const matchesSearch = pole.name.toLowerCase().includes(searchQuery.toLowerCase())
      || pole.id.toString().includes(searchQuery);
    if (filterCondition === 'All') return matchesSearch;
    const score = pole.ahi_score ?? 100;
    if (filterCondition === 'Critical') return matchesSearch && score < 50;
    if (filterCondition === 'Warning') return matchesSearch && score >= 50 && score < 80;
    return matchesSearch && score >= 80;
  }), [poles, searchQuery, filterCondition]);

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
            setSelectedPole(null);
            showNotification('Poste removido com sucesso');
            fetchAlerts();
          }}
        />

        <div className="map-container glass-panel">
          <AlertBanner alerts={alerts} onSelectPole={handleMarkerClick} />
          {notification && (
            <div className="notification-overlay animate-fade-in">
              <Zap size={16} className="text-primary" /><span>{notification}</span>
            </div>
          )}

          {viewMode === 'MAP' ? (
            <Map
              poles={filteredPoles}
              onMapClick={handleMapClick}
              onMarkerClick={handleMarkerClick}
              selectedPole={selectedPole}
              isMeasuring={isMeasuring}
              activeSpan={activeSpan}
              userRole={currentUser?.role || 'VIEWER'}
              showHeatmap={showHeatmap}
            />
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
    </div>
    )}
    </TenantProvider>
  );
};

export default App;
