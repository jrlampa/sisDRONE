import React from 'react';
import { Search, Ruler, Download, FileJson, Globe, LayoutDashboard } from 'lucide-react';
import PoleDetails from './PoleDetails';
import InspectionHistory from './InspectionHistory';
import EngineeringTools from './EngineeringTools';
import type { Pole, Span, Inspection, AnalysisResult, Stats } from '../../types';

interface SidebarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isMeasuring: boolean;
  setIsMeasuring: (m: boolean) => void;
  handleExportCSV: () => void;
  handleExportGeoJSON: () => void;
  handleImportGeoJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  gisInputRef: React.RefObject<HTMLInputElement>;
  filterCondition: 'All' | 'Critical' | 'Warning' | 'Good';
  setFilterCondition: (c: 'All' | 'Critical' | 'Warning' | 'Good') => void;
  selectedPole: Pole | null;
  activeSpan: Span | null;
  activeTab: 'details' | 'history' | 'eng';
  setActiveTab: (t: 'details' | 'history' | 'eng') => void;
  isCapturing: boolean;
  onAnalyze: () => void;
  analysis: AnalysisResult | null;
  onFeedback: (isCorrect: boolean) => void;
  history: Inspection[];
  stats: Stats;
  conductorWeight: number;
  setConductorWeight: (w: number) => void;
  tension: number;
  setTension: (t: number) => void;
  apiBase: string;
  userRole: 'ADMIN' | 'ENGINEER' | 'VIEWER';
}

const Sidebar: React.FC<SidebarProps> = (props) => {
  const {
    searchQuery, setSearchQuery, isMeasuring, setIsMeasuring,
    handleExportCSV, handleExportGeoJSON, handleImportGeoJSON, gisInputRef,
    filterCondition, setFilterCondition, selectedPole, activeSpan,
    activeTab, setActiveTab, isCapturing, onAnalyze, analysis, onFeedback,
    history, stats, conductorWeight, setConductorWeight, tension, setTension,
    apiBase, userRole
  } = props;

  return (
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
          <button
            className={`btn btn-outline ${isMeasuring ? 'active' : ''}`}
            onClick={() => setIsMeasuring(!isMeasuring)}
          >
            <Ruler size={14} /> Régua UTM
          </button>
          <button className="btn btn-outline" onClick={handleExportCSV}>
            <Download size={14} /> CSV
          </button>
          <button
            className="btn btn-outline"
            onClick={() => gisInputRef.current?.click()}
            disabled={userRole === 'VIEWER'}
          >
            <FileJson size={14} /> Importar
          </button>
          <button
            className="btn btn-outline"
            onClick={handleExportGeoJSON}
            disabled={userRole === 'VIEWER'}
          >
            <Globe size={14} /> Exportar
          </button>
        </div>
        <input
          type="file"
          ref={gisInputRef}
          className="hidden-input"
          accept=".geojson,.json"
          onChange={handleImportGeoJSON}
          title="Importar Arquivo GeoJSON/KML"
          placeholder="Selecione um arquivo"
        />
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
            <button
              onClick={() => setActiveTab('details')}
              className={activeTab === 'details' ? 'active' : ''}
            >
              Detalhes
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={activeTab === 'history' ? 'active' : ''}
            >
              Histórico
            </button>
            {activeSpan && userRole !== 'VIEWER' && (
              <button
                onClick={() => setActiveTab('eng')}
                className={activeTab === 'eng' ? 'active' : ''}
              >
                Engenharia
              </button>
            )}
          </div>

          {activeTab === 'details' && selectedPole && (
            <PoleDetails
              pole={selectedPole}
              isCapturing={isCapturing}
              onAnalyze={onAnalyze}
              analysis={analysis}
              onFeedback={onFeedback}
              apiBase={apiBase}
            />
          )}

          {activeTab === 'history' && (
            <InspectionHistory history={history} apiBase={apiBase} />
          )}

          {activeTab === 'eng' && activeSpan && (
            <EngineeringTools
              activeSpan={activeSpan}
              conductorWeight={conductorWeight}
              setConductorWeight={setConductorWeight}
              tension={tension}
              setTension={setTension}
            />
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
          <div className="card stat-card">
            <span className="stat-label">Postes</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Saudáveis</span>
            <span className="stat-value">{stats.healthy}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
