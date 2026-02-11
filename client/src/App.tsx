import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import Map from './components/Map';
import {
  MapPin, CheckCircle, AlertTriangle, Upload, LayoutDashboard,
  Zap, Activity, Ruler, Search, Download, Clock,
  Image as ImageIcon, ChevronRight, FileJson, Globe, Hammer
} from 'lucide-react';
import { degreesToUtm } from './utils/geo';
import { calculateDistance } from './utils/math';
import { calculateSag, COMMON_CABLES } from './utils/eng';

const API_BASE = 'http://localhost:3001';

interface Pole {
  id: number;
  name: string;
  lat: number;
  lng: number;
  utm_x?: string;
  utm_y?: string;
}

interface Span {
  p1: Pole;
  p2: Pole;
  distance: number;
}

interface Inspection {
  id: number;
  pole_id: number;
  label: string;
  confidence: number;
  source: string;
  created_at: string;
  file_path?: string;
}

interface AnalysisResult {
  labelId: number;
  pole_type: string;
  structures: string[];
  condition: string;
  confidence: number;
  analysis_summary: string;
  imageUrl?: string;
}

interface Stats {
  totalPoles: number;
  totalInspections: number;
  activeAlerts: number;
  status: string;
}

const App: React.FC = () => {
  // --- State ---
  const [poles, setPoles] = useState<Pole[]>([]);
  const [selectedPole, setSelectedPole] = useState<Pole | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<Inspection[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'eng'>('details');
  const [notification, setNotification] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ totalPoles: 0, totalInspections: 0, activeAlerts: 0, status: '...' });
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementStart, setMeasurementStart] = useState<Pole | null>(null);
  const [activeSpan, setActiveSpan] = useState<Span | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCondition, setFilterCondition] = useState<'All' | 'Critical' | 'Warning' | 'Good'>('All');

  // Engineering State
  const [conductorWeight, setConductorWeight] = useState(COMMON_CABLES[0].weight);
  const [tension, setTension] = useState(250);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gisInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    fetchPoles();
    fetchStats();
  }, []);

  useEffect(() => {
    if (selectedPole) {
      fetchHistory(selectedPole.id);
      if (activeTab === 'eng' && !activeSpan) setActiveTab('details');
    }
  }, [selectedPole, activeSpan, activeTab]);

  // --- Logic ---
  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchPoles = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/poles`);
      setPoles(res.data);
    } catch (err) {
      console.error('Error fetching poles', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/stats`);
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats', err);
    }
  };

  const fetchHistory = async (id: number) => {
    try {
      const res = await axios.get(`${API_BASE}/api/poles/${id}/history`);
      setHistory(res.data);
    } catch (err) {
      console.error('Error fetching history', err);
    }
  };

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
    const name = `Poste ${poles.length + 1}`;
    const utm = degreesToUtm(lat, lng);
    showNotification(`Criando ${name}...`);

    try {
      const res = await axios.post(`${API_BASE}/api/poles`, {
        lat, lng, name, utm_x: utm.x, utm_y: utm.y
      });
      setPoles(prev => [res.data, ...prev]);
      setSelectedPole(res.data);
      fetchStats();
      showNotification(`${name} registrado!`);
    } catch (err) {
      showNotification('Erro na conexão com o banco.');
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
        showNotification("Vão selecionado para cálculo!");
      }
      return;
    }
    setSelectedPole(pole);
    setAnalysis(null);
  };

  const currentSag = useMemo(() => {
    if (!activeSpan) return 0;
    return calculateSag(conductorWeight, activeSpan.distance, tension);
  }, [activeSpan, conductorWeight, tension]);

  const handleExportCSV = () => {
    const headers = ['ID', 'Nome', 'Latitude', 'Longitude', 'UTM_X', 'UTM_Y'];
    const rows = poles.map(p => [p.id, p.name, p.lat, p.lng, p.utm_x, p.utm_y].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `sisdrone_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("Relatório exportado!");
  };

  const handleExportGeoJSON = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/gis/export/geojson`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `sisdrone_network_${new Date().toISOString().split('T')[0]}.geojson`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification("GeoJSON exportado!");
    } catch (err) {
      showNotification("Erro ao exportar GeoJSON.");
    }
  };

  const handleImportGeoJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string);
        const res = await axios.post(`${API_BASE}/api/gis/import/geojson`, { geojson });
        showNotification(res.data.detail);
        fetchPoles();
        fetchStats();
      } catch (err) {
        showNotification("GeoJSON inválido ou erro no servidor.");
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPole) return;

    setIsCapturing(true);
    showNotification("Processando imagem via Llama 4...");

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Content = (reader.result as string).split(',')[1];
      try {
        const res = await axios.post(`${API_BASE}/api/analyze`, {
          poleId: selectedPole.id,
          image: base64Content
        });
        setAnalysis(res.data);
        fetchStats();
        fetchHistory(selectedPole.id);
        showNotification("Análise concluída!");
      } catch (err) {
        showNotification("Erro na análise IA.");
      } finally {
        setIsCapturing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFeedback = async (isCorrect: boolean) => {
    if (!analysis || !selectedPole) return;
    let correction = "";
    if (!isCorrect) {
      correction = prompt("Qual a correção técnica?") || "";
      if (!correction) return;
    }
    try {
      await axios.post(`${API_BASE}/api/feedback`, {
        labelId: analysis.labelId,
        poleId: selectedPole.id,
        isCorrect,
        correction
      });
      showNotification(isCorrect ? "Calibração positiva!" : "Correção salva!");
      setAnalysis(null);
      fetchStats();
      fetchHistory(selectedPole.id);
    } catch (err) {
      showNotification("Erro ao salvar feedback.");
    }
  };

  return (
    <div className="app-container">
      <div className="sidebar glass-panel">
        <header className="sidebar-header">
          <h1>sisDRONE</h1>
          <p className="sidebar-subtitle">SISTEMA DE INSPEÇÃO AUTOMATIZADA</p>
        </header>

        <div className="nav-tools">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar poste por nome ou ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input"
            />
          </div>

          <div className="tools-grid">
            <button className={`btn btn-outline ${isMeasuring ? 'active' : ''}`} onClick={() => { setIsMeasuring(!isMeasuring); setMeasurementStart(null); setActiveSpan(null); }}>
              <Ruler size={14} /> Régua UTM
            </button>
            <button className="btn btn-outline" onClick={handleExportCSV}>
              <Download size={14} /> CSV
            </button>
            <button className="btn btn-outline" onClick={() => gisInputRef.current?.click()}>
              <FileJson size={14} /> Importar
            </button>
            <button className="btn btn-outline" onClick={handleExportGeoJSON}>
              <Globe size={14} /> Exportar
            </button>
          </div>
          <input type="file" ref={gisInputRef} style={{ display: 'none' }} accept=".geojson,.json" onChange={handleImportGeoJSON} />
        </div>

        <div className="filter-chips">
          {(['All', 'Critical', 'Warning', 'Good'] as const).map(c => (
            <button
              key={c}
              className={`badge ${filterCondition === c ? 'active-chip' : 'inactive-chip'}`}
              onClick={() => setFilterCondition(c)}
            >
              {c === 'All' ? 'Todos' : c === 'Critical' ? 'Crítico' : c === 'Warning' ? 'Atenção' : 'Saudável'}
            </button>
          ))}
        </div>

        {selectedPole || activeSpan ? (
          <div className="pole-view animate-fade-in">
            <div className="tab-switcher">
              <button onClick={() => setActiveTab('details')} className={activeTab === 'details' ? 'active' : ''}>Detalhes</button>
              <button onClick={() => setActiveTab('history')} className={activeTab === 'history' ? 'active' : ''}>Histórico</button>
              {activeSpan && (
                <button onClick={() => setActiveTab('eng')} className={activeTab === 'eng' ? 'active' : ''}>Engenharia</button>
              )}
            </div>

            {activeTab === 'details' && selectedPole && (
              <div className="pole-details animate-fade-in">
                <div className="card">
                  <div className="card-header">
                    <MapPin size={20} className="text-accent" />
                    <h2>{selectedPole.name}</h2>
                  </div>
                  <div className="stats-row">
                    <div className="stat-item"><span className="stat-label">Latitude</span><span className="stat-value">{selectedPole.lat.toFixed(6)}</span></div>
                    <div className="stat-item"><span className="stat-label">Longitude</span><span className="stat-value">{selectedPole.lng.toFixed(6)}</span></div>
                  </div>
                  <div className="utm-line"><strong>UTM:</strong> {selectedPole.utm_x}, {selectedPole.utm_y}</div>
                </div>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
                <button className="btn btn-primary btn-full" onClick={() => fileInputRef.current?.click()} disabled={isCapturing}>
                  <Upload size={18} /> {isCapturing ? 'Refinando Visão...' : 'Análise IA'}
                </button>
                {analysis && (
                  <div className="analysis-result card gradient-border animate-slide-up">
                    <div className="analysis-header">
                      <h3><Activity size={16} /> Relatório Vision</h3>
                      <span className={`badge ${analysis.confidence > 0.8 ? 'badge-success' : 'badge-warning'}`}>{Math.round(analysis.confidence * 100)}% Conf.</span>
                    </div>
                    {analysis.imageUrl && <div className="analysis-img"><img src={`${API_BASE}${analysis.imageUrl}`} alt="Audit" /></div>}
                    <p><strong>Tipo:</strong> {analysis.pole_type}</p>
                    <p><strong>Condição:</strong> <span className={analysis.condition.toLowerCase().includes('boa') ? 'text-success' : 'text-danger'}>{analysis.condition}</span></p>
                    <div className="analysis-summary">{analysis.analysis_summary}</div>
                    <div className="feedback-row">
                      <button className="btn btn-outline btn-success" onClick={() => handleFeedback(true)}><CheckCircle size={16} /> OK</button>
                      <button className="btn btn-outline btn-danger" onClick={() => handleFeedback(false)}><AlertTriangle size={16} /> Corrigir</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="history-list animate-fade-in">
                {history.length > 0 ? (
                  history.map(item => (
                    <div key={item.id} className="card history-item">
                      {item.file_path ? (
                        <div className="history-thumb"><img src={`${API_BASE}${item.file_path}`} alt="Past" /></div>
                      ) : (
                        <div className="history-thumb-placeholder"><ImageIcon size={20} /></div>
                      )}
                      <div className="history-info">
                        <span className="history-date"><Clock size={12} /> {new Date(item.created_at).toLocaleDateString()}</span>
                        <p>{item.label}</p>
                      </div>
                      <ChevronRight size={16} className="history-arrow" />
                    </div>
                  ))
                ) : (
                  <div className="empty-state"><Clock size={40} /><p>Nenhuma inspeção anterior.</p></div>
                )}
              </div>
            )}

            {activeTab === 'eng' && activeSpan && (
              <div className="engineering-module animate-fade-in">
                <div className="card gradient-border">
                  <div className="card-header"><Hammer size={20} className="text-primary" /><h2>Cálculo de Flecha</h2></div>
                  <div className="form-group">
                    <label>Condutor</label>
                    <select className="glass-input" value={conductorWeight} onChange={(e) => setConductorWeight(parseFloat(e.target.value))}>
                      {COMMON_CABLES.map(c => <option key={c.name} value={c.weight}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tração (kgf)</label>
                    <input type="number" value={tension} onChange={(e) => setTension(parseFloat(e.target.value))} className="glass-input" />
                  </div>
                  <div className="stats-grid-compact">
                    <div className="stat-item"><span className="stat-label">Vão</span><span className="stat-value">{activeSpan.distance.toFixed(1)}m</span></div>
                    <div className="stat-item"><span className="stat-label">Flecha</span><span className={`stat-value ${currentSag > 2 ? 'text-danger' : 'text-success'}`}>{currentSag.toFixed(2)}m</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state-main">
            <LayoutDashboard size={48} />
            <p>Selecione um ativo no mapa para iniciar inspeção.</p>
          </div>
        )}

        <div className="stats-dashboard">
          <h3 className="stats-title">Health Monitor</h3>
          <div className="stats-mini-grid">
            <div className="card stat-card"><span className="stat-label">Postes</span><span className="stat-value">{stats.totalPoles}</span></div>
            <div className="card stat-card"><span className="stat-label">Inspeções</span><span className="stat-value">{stats.totalInspections}</span></div>
          </div>
        </div>
      </div>

      <div className="map-container glass-panel">
        {notification && (
          <div className="notification-overlay animate-fade-in">
            <Zap size={16} className="text-primary" /><span>{notification}</span>
          </div>
        )}
        <Map poles={filteredPoles} onMapClick={handleMapClick} onMarkerClick={handleMarkerClick} />
      </div>
    </div>
  );
};

export default App;
