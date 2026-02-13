import React from 'react';
import { Search, FileJson, Globe, FileText, Ruler, LayoutDashboard, Download, X } from 'lucide-react';
import PoleDetails from './PoleDetails';
import { generateInspectionReport } from '../../utils/pdfGenerator';
import { api } from '../../services/api';
import InspectionHistory from './InspectionHistory';
import EngineeringTools from './EngineeringTools';
import type { Pole, Span, Inspection, AnalysisResult, Stats, Tenant, User } from '../../types';

interface SidebarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isMeasuring: boolean;
  setIsMeasuring: (m: boolean) => void;
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
  showHeatmap: boolean;
  setShowHeatmap: (show: boolean) => void;
  activeTenant?: Tenant;
  poles: Pole[];
  isOpen: boolean;
  onClose: () => void;
  viewMode: 'MAP' | 'ANALYTICS' | 'WORK_ORDERS';
  setViewMode: (mode: 'MAP' | 'ANALYTICS' | 'WORK_ORDERS') => void;
  users: User[]; // New prop
}

const Sidebar: React.FC<SidebarProps> = (props) => {
  const {
    searchQuery, setSearchQuery, isMeasuring, setIsMeasuring,
    handleExportGeoJSON, handleImportGeoJSON, gisInputRef,
    filterCondition, setFilterCondition, selectedPole, activeSpan,
    activeTab, setActiveTab, isCapturing, onAnalyze, analysis, onFeedback,
    history, stats, conductorWeight, setConductorWeight, tension, setTension,
    apiBase, userRole, showHeatmap, setShowHeatmap, activeTenant, poles,
    isOpen, onClose, viewMode, setViewMode, users
  } = props;

  const handleExportPDF = () => {
    if (!activeTenant) return;
    generateInspectionReport({
      tenant: activeTenant,
      stats,
      poles,
      filters: {
        status: filterCondition,
        search: searchQuery
      }
    });
  };

  const onExportCSV = async () => {
    try {
      const response = await api.exportCSV();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sisdrone_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export CSV', error);
      alert('Erro ao exportar CSV. Tente novamente.');
    }
  };

  return (
    <div className={`sidebar glass-panel ${isOpen ? 'open' : ''}`}>
      <header className="sidebar-header flex justify-between items-center">
        <div>
          <h1>sisDRONE</h1>
          <p className="sidebar-subtitle">SISTEMA DE INSPEÇÃO AUTOMATIZADA</p>
        </div>
        <button
          className="btn-icon mobile-close-btn"
          onClick={onClose}
          aria-label="Fechar Menu"
          title="Fechar Menu"
        >
          <X size={24} />
        </button>
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
          <button className="btn btn-outline" onClick={onExportCSV}>
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
          <button
            className="btn btn-outline"
            onClick={handleExportPDF}
            disabled={userRole === 'VIEWER'}
          >
            <FileText size={14} /> Relatório
          </button>
          <button
            className={`btn btn-outline ${viewMode === 'ANALYTICS' ? 'active' : ''}`}
            onClick={() => setViewMode(viewMode === 'MAP' ? 'ANALYTICS' : 'MAP')}
          >
            <LayoutDashboard size={14} /> Dash
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
              users={users}
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
        <div className="analytics-section">
          <h3>Sáude da Rede</h3>
          <div className="card analytics-card">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Mapa de Calor (Riscos)</span>
              <button
                className={`btn btn-sm ${showHeatmap ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setShowHeatmap(!showHeatmap)}
              >
                {showHeatmap ? 'Ativado' : 'Desativado'}
              </button>
            </div>
            <p className="text-xs text-muted">Visualiza concentração de falhas e criticidades.</p>
          </div>
        </div>

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
