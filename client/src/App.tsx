import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar/Sidebar';
import { Zap } from 'lucide-react';
import { degreesToUtm } from './utils/geo';
import { calculateDistance } from './utils/math';
import { api } from './services/api';
import { useNetwork } from './hooks/useNetwork';
import type { Pole, Span, Inspection, AnalysisResult, Tenant, User } from './types';

const API_BASE = 'http://localhost:3001';

const App: React.FC = () => {
  // --- Custom Hooks ---
  const {
    poles, setPoles, stats, fetchStats, fetchPoles,
    activeTenantId, setActiveTenantId,
    currentUser, setCurrentUser
  } = useNetwork();

  // --- UI State ---
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [selectedPole, setSelectedPole] = useState<Pole | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<Inspection[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'eng'>('details');
  const [notification, setNotification] = useState<string | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementStart, setMeasurementStart] = useState<Pole | null>(null);
  const [activeSpan, setActiveSpan] = useState<Span | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCondition, setFilterCondition] = useState<'All' | 'Critical' | 'Warning' | 'Good'>('All');

  // Engineering State
  const [conductorWeight, setConductorWeight] = useState(0.545); // Default Penguin
  const [tension, setTension] = useState(250);

  // Refs
  const gisInputRef = useRef<HTMLInputElement>(null!);

  // --- Sync Tenants, Users & Theme ---
  useEffect(() => {
    Promise.all([api.getTenants(), api.getUsers()]).then(([tRes, uRes]) => {
      setTenants(tRes.data);
      setUsers(uRes.data);

      const mockUser = uRes.data.find(u => u.tenant_id === activeTenantId) || uRes.data[0];
      if (mockUser) {
        setCurrentUser(mockUser);
        localStorage.setItem('sisdrone_mock_role', mockUser.role);
      }

      const initialTenant = tRes.data.find(t => t.id === activeTenantId);
      if (initialTenant) setActiveTenant(initialTenant);
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

  const handleUserSwitch = (userId: number) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      setActiveTenantId(user.tenant_id);
      localStorage.setItem('sisdrone_mock_role', user.role);
      // Update tenant branding if it changed
      const tenant = tenants.find(t => t.id === user.tenant_id);
      if (tenant) setActiveTenant(tenant);
      showNotification(`Logado como ${user.username} (${user.role})`);
    }
  };

  // --- Sync History ---
  useEffect(() => {
    if (selectedPole) {
      api.getHistory(selectedPole.id).then(res => setHistory(res.data)).catch(() => { });
    }
  }, [selectedPole]);

  // --- Logic ---
  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const filteredPoles = useMemo(() => {
    return poles.filter(pole => {
      const matchesSearch = pole.name.toLowerCase().includes(searchQuery.toLowerCase()) || pole.id.toString().includes(searchQuery);
      if (filterCondition === 'All') return matchesSearch;
      const isCritical = pole.id % 5 === 0;
      const isWarning = pole.id % 3 === 0 && !isCritical;
      if (filterCondition === 'Critical') return matchesSearch && isCritical;
      if (filterCondition === 'Warning') return matchesSearch && isWarning;
      return matchesSearch && !isCritical && !isWarning;
    });
  }, [poles, searchQuery, filterCondition]);

  const handleMapClick = async (lat: number, lng: number) => {
    if (isMeasuring || searchQuery || filterCondition !== 'All') return;
    const utm = degreesToUtm(lat, lng);
    try {
      showNotification(`Criando Poste...`);
      const res = await api.createPole({
        lat, lng, name: `Poste ${poles.length + 1}`,
        utm_x: utm.x, utm_y: utm.y,
        tenant_id: activeTenantId
      });
      setPoles(prev => [res.data, ...prev]);
      setSelectedPole(res.data);
      fetchStats();
      showNotification(`Registrado!`);
    } catch (err) {
      console.error('Error creating pole', err);
      showNotification('Erro na conexão.');
    }
  };

  const handleMarkerClick = (pole: Pole) => {
    if (isMeasuring) {
      if (!measurementStart) {
        setMeasurementStart(pole);
        showNotification("Selecione o segundo poste");
      } else {
        const dist = calculateDistance(measurementStart.lat, measurementStart.lng, pole.lat, pole.lng);
        setActiveSpan({ p1: measurementStart, p2: pole, distance: dist });
        setActiveTab('eng');
        setMeasurementStart(null);
        setIsMeasuring(false);
        showNotification("Vão selecionado!");
      }
      return;
    }
    setSelectedPole(pole);
    setAnalysis(null);
    setActiveTab('details');
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Nome', 'Latitude', 'Longitude', 'UTM_X', 'UTM_Y'];
    const rows = poles.map(p => [p.id, p.name, p.lat, p.lng, p.utm_x, p.utm_y].join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sisdrone_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportGeoJSON = async () => {
    try {
      const res = await api.exportGis();
      const blob = new Blob([JSON.stringify(res.data)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `sisdrone_network.geojson`;
      link.click();
    } catch (err) {
      console.error('Export error', err);
      showNotification("Erro na exportação.");
    }
  };

  const handleImportGeoJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        const geojson = JSON.parse(e.target?.result as string);
        await api.importGis(geojson);
        fetchPoles();
        fetchStats();
        showNotification("GIS Importado!");
      } catch {
        showNotification("Erro no GIS.");
      }
    };
    reader.readAsText(file);
  };


  const handleFeedback = async (isCorrect: boolean) => {
    if (!analysis || !selectedPole) return;
    const correction = isCorrect ? "" : prompt("Qual a correção técnica?") || "";
    if (!isCorrect && !correction) return;
    try {
      await api.sendFeedback({ labelId: analysis.labelId, poleId: selectedPole.id, isCorrect, correction });
      showNotification(isCorrect ? "Calibrado!" : "Corrigido!");
      setAnalysis(null);
      fetchStats();
      api.getHistory(selectedPole.id).then(res => setHistory(res.data)).catch(() => { });
    } catch {
      showNotification("Erro no feedback.");
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!selectedPole) return;
    setIsCapturing(true);
    showNotification("Analisando...");
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const res = await api.analyzeImage(selectedPole.id, base64);
        setAnalysis(res.data);
        fetchStats();
        api.getHistory(selectedPole.id).then(res => setHistory(res.data)).catch(() => { });
        showNotification("Concluído!");
      } catch {
        showNotification("Erro na IA.");
      } finally {
        setIsCapturing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="app-container">
      <header className="app-header glass-panel">
        <div className="flex items-center gap-4">
          <Zap className="text-accent" />
          <h1 className="logo-text">sisDRONE / {activeTenant?.name || 'Enterprise'}</h1>
        </div>

        <div className="tenant-switcher flex items-center gap-4">
          <select
            value={currentUser?.id || ''}
            onChange={(e) => handleUserSwitch(Number(e.target.value))}
            className="glass-input tenant-select"
            title="Trocar Usuário (Mock Auth)"
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
            ))}
          </select>

          <select
            value={activeTenantId}
            onChange={(e) => {
              const tid = Number(e.target.value);
              setActiveTenantId(tid);
              const tenant = tenants.find(t => t.id === tid);
              if (tenant) setActiveTenant(tenant);
            }}
            className="glass-input tenant-select"
            title="Trocar Concessionária"
          >
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </header>

      <Sidebar
        userRole={currentUser?.role || 'VIEWER'}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isMeasuring={isMeasuring}
        setIsMeasuring={setIsMeasuring}
        handleExportCSV={handleExportCSV}
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
        onAnalyze={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target.files) handleImageUpload(target.files[0]);
          };
          input.click();
        }}
        analysis={analysis}
        onFeedback={handleFeedback}
        history={history}
        stats={stats || { total: 0, critical: 0, healthy: 0 }}
        conductorWeight={conductorWeight}
        setConductorWeight={setConductorWeight}
        tension={tension}
        setTension={setTension}
        apiBase={API_BASE}
      />

      <div className="map-container glass-panel">
        {notification && (
          <div className="notification-overlay animate-fade-in">
            <Zap size={16} className="text-primary" /><span>{notification}</span>
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
        />
      </div>
    </div>
  );
};

export default App;
