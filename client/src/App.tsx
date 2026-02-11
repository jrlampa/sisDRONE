import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import Map from './components/Map';
import { MapPin, CheckCircle, AlertTriangle, Upload, LayoutDashboard, Zap, Activity, Ruler, Search, Filter, Download } from 'lucide-react';
import { degreesToUtm } from './utils/geo';
import { calculateDistance } from './utils/math';

const API_BASE = 'http://localhost:3001/api';

interface Pole {
  id: number;
  name: string;
  lat: number;
  lng: number;
  utm_x?: string;
  utm_y?: string;
  condition?: string; // Cache condition for filtering
}

interface AnalysisResult {
  labelId: number;
  pole_type: string;
  structures: string[];
  condition: string;
  confidence: number;
  analysis_summary: string;
}

interface Stats {
  totalPoles: number;
  totalInspections: number;
  activeAlerts: number;
  status: string;
}

const App: React.FC = () => {
  const [poles, setPoles] = useState<Pole[]>([]);
  const [selectedPole, setSelectedPole] = useState<Pole | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ totalPoles: 0, totalInspections: 0, activeAlerts: 0, status: '...' });
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementStart, setMeasurementStart] = useState<Pole | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCondition, setFilterCondition] = useState<'All' | 'Critical' | 'Warning' | 'Good'>('All');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPoles();
    fetchStats();
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchPoles = async () => {
    try {
      const res = await axios.get(`${API_BASE}/poles`);
      setPoles(res.data);
    } catch (err) {
      console.error('Error fetching poles', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/stats`);
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats', err);
    }
  };

  const filteredPoles = useMemo(() => {
    return poles.filter(pole => {
      const matchesSearch = pole.name.toLowerCase().includes(searchQuery.toLowerCase()) || pole.id.toString().includes(searchQuery);
      if (filterCondition === 'All') return matchesSearch;

      // Note: In a real app, 'condition' would be a field in the pole object
      // For this demo, we can assume some poles have condition based on their names or random for visualization
      const isCritical = pole.id % 5 === 0; // Mocking critical poles
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
      const res = await axios.post(`${API_BASE}/poles`, {
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
        alert(`Distância entre ${measurementStart.name} e ${pole.name}: ${dist.toFixed(2)}m`);
        setMeasurementStart(null);
        setIsMeasuring(false);
      }
      return;
    }
    setSelectedPole(pole);
    setAnalysis(null);
  };

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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => { ... }; // Unchanged
  const handleFeedback = async (isCorrect: boolean) => { ... }; // Unchanged

  return (
    <div className="app-container">
      <div className="sidebar glass-panel">
        <header className="sidebar-header">
          <h1>sisDRONE</h1>
          <p className="sidebar-subtitle">SISTEMA DE INSPEÇÃO AUTOMATIZADA</p>
        </header>

        {/* Phase 2: Navigation Tools */}
        <div className="nav-tools" style={{ marginBottom: '1rem' }}>
          <div className="search-box" style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar poste por nome ou ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input"
              style={{ width: '100%', paddingLeft: '40px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px 10px 10px 40px', color: 'white', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn btn-outline ${isMeasuring ? 'active' : ''}`}
              onClick={() => {
                setIsMeasuring(!isMeasuring);
                setMeasurementStart(null);
                showNotification(isMeasuring ? "Régua desativada" : "Modo Medição: Selecione o 1º poste");
              }}
              style={{ flex: 1, fontSize: '0.8rem', borderColor: isMeasuring ? 'var(--primary)' : '' }}
            >
              <Ruler size={14} /> Régua
            </button>
            <button
              className="btn btn-outline"
              onClick={handleExportCSV}
              style={{ flex: 1, fontSize: '0.8rem' }}
            >
              <Download size={14} /> Exportar
            </button>
          </div>
        </div>

        <div className="filter-chips" style={{ display: 'flex', gap: '5px', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '5px' }}>
          {(['All', 'Critical', 'Warning', 'Good'] as const).map(c => (
            <button
              key={c}
              className={`badge ${filterCondition === c ? 'active-chip' : 'inactive-chip'}`}
              onClick={() => setFilterCondition(c)}
              style={{
                cursor: 'pointer', border: 'none',
                background: filterCondition === c ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: filterCondition === c ? 'white' : 'var(--text-muted)'
              }}
            >
              {c === 'All' ? 'Todos' : c === 'Critical' ? 'Crítico' : c === 'Warning' ? 'Atenção' : 'Saudável'}
            </button>
          ))}
        </div>

        {selectedPole ? (
          // ... (selected pole details - unchanged except adding handleMarkerClick closure if needed elsewhere)
          <div className="pole-details animate-fade-in">
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <MapPin size={20} color="var(--accent)" />
                <h2 style={{ fontSize: '1.1rem' }}>{selectedPole.name}</h2>
              </div>
              {/* coordinates and UTM - unchanged */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                <div className="stat-item">
                  <span className="stat-label">Latitude</span>
                  <span className="stat-value" style={{ fontSize: '1rem' }}>{selectedPole.lat.toFixed(6)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Longitude</span>
                  <span className="stat-value" style={{ fontSize: '1rem' }}>{selectedPole.lng.toFixed(6)}</span>
                </div>
              </div>
              <div style={{ marginTop: '1rem', padding: '10px', borderTop: '1px solid var(--glass-border)', fontSize: '0.85rem', color: 'var(--accent)' }}>
                <strong>UTM:</strong> {selectedPole.utm_x}, {selectedPole.utm_y}
              </div>
            </div>
            {/* upload and analysis - unchanged */}
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
            <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={isCapturing} style={{ width: '100%', marginBottom: '1.5rem' }}>
              <Upload size={18} />
              {isCapturing ? 'Refinando Visão...' : 'Nova Análise IA'}
            </button>
            {analysis && (
              // analysis logic - unchanged
              <div className="analysis-result card gradient-border animate-slide-up">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={16} /> Relatório Vision
                  </h3>
                  <span className="badge" style={{ backgroundColor: analysis.confidence > 0.8 ? 'var(--success)' : 'var(--warning)' }}>
                    {Math.round(analysis.confidence * 100)}% Conf.
                  </span>
                </div>
                <p style={{ marginBottom: '0.5rem' }}><strong>Tipo:</strong> {analysis.pole_type}</p>
                <p style={{ marginBottom: '0.5rem' }}><strong>Estruturas:</strong> {analysis.structures.join(', ')}</p>
                <p style={{ marginBottom: '1rem' }}><strong>Condição:</strong> <span style={{ color: analysis.condition.toLowerCase().includes('boa') ? 'var(--success)' : 'var(--danger)' }}>{analysis.condition}</span></p>
                <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {analysis.analysis_summary}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-outline" style={{ flex: 1, color: 'var(--success)' }} onClick={() => handleFeedback(true)}>
                    <CheckCircle size={16} /> Correto
                  </button>
                  <button className="btn btn-outline" style={{ flex: 1, color: 'var(--danger)' }} onClick={() => handleFeedback(false)}>
                    <AlertTriangle size={16} /> Corrigir
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 0', opacity: 0.6 }}>
            <LayoutDashboard size={48} style={{ marginBottom: '1rem' }} />
            <p style={{ fontSize: '0.9rem' }}>Selecione um ativo no mapa ({filteredPoles.length} visíveis)</p>
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
          <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1rem' }}>
            Health Monitor
          </h3>
          <div className="stats-grid">
            <div className="card stat-item">
              <span className="stat-label">Postes</span>
              <span className="stat-value">{stats.totalPoles}</span>
            </div>
            <div className="card stat-item">
              <span className="stat-label">Alertas</span>
              <span className="stat-value" style={{ color: 'var(--danger)' }}>{stats.activeAlerts}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="map-container glass-panel">
        {notification && (
          <div className="notification-overlay animate-fade-in" style={{
            position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 2000,
            background: 'var(--bg-dark)', border: '1px solid var(--primary)', padding: '0.75rem 1.5rem',
            borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }}>
            <Zap size={16} color="var(--primary)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{notification}</span>
          </div>
        )}
        <Map
          poles={filteredPoles}
          onMapClick={handleMapClick}
          onMarkerClick={handleMarkerClick}
        />
      </div>
    </div>
  );
};

export default App;
