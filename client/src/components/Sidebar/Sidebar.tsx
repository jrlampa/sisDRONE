import React, { useState } from 'react';
import { Search, FileJson, Globe, FileText, Ruler, LayoutDashboard, Download, X, Zap, ClipboardList, Video, Building2, Cable, Network, Upload, ShieldCheck, BarChart2, Wrench, Navigation, Clipboard, PackageSearch } from 'lucide-react';
import PoleDetails from './PoleDetails';
import { generateInspectionReport } from '../../utils/pdfGenerator';
import { api } from '../../services/api';
import InspectionHistory from './InspectionHistory';
import EngineeringTools from './EngineeringTools';
import VideoCapturePanel from '../VideoCapture/VideoCapturePanel';
import BimStructureEditor from './BimStructureEditor';
import ConductorPanel from './ConductorPanel';
import TopologyPanel from './TopologyPanel';
import ValidationPanel from './ValidationPanel';
import EquipmentPanel from './EquipmentPanel';
import AdminOverview from '../Dashboard/AdminOverview';
import ExecutiveDashboard from '../Dashboard/ExecutiveDashboard';
import ManualInspectionForm from './ManualInspectionForm';
import ImportModal from '../ImportModal';
import NearbySearchPanel from './NearbySearchPanel';
import FilterChips from '../FilterChips';
import { useTenant } from '../../context/TenantContext';
import ToastBanner from '../ToastBanner';
import DroneRoutePanel from './DroneRoutePanel';
import InspectionWizard from './InspectionWizard';
import BomPanel from './BomPanel';
import { useToast } from '../../hooks/useToast';
import type { Pole, Span, Inspection, AnalysisResult, Stats, Tenant, User } from '../../types';
import type { FrameAnalysis } from '../../hooks/useVideoCapture';

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
  activeTab: 'details' | 'history' | 'eng' | 'video' | 'bim' | 'conductors' | 'topology' | 'validation' | 'kpi' | 'admin' | 'equipment' | 'drone' | 'wizard' | 'bom';
  setActiveTab: (t: 'details' | 'history' | 'eng' | 'video' | 'bim' | 'conductors' | 'topology' | 'validation' | 'kpi' | 'admin' | 'equipment' | 'drone' | 'wizard' | 'bom') => void;
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
  viewMode: 'MAP' | 'ANALYTICS' | 'WORK_ORDERS' | 'DRONE_LIVE';
  setViewMode: (mode: 'MAP' | 'ANALYTICS' | 'WORK_ORDERS' | 'DRONE_LIVE') => void;
  users: User[];
  onVideoFrameAnalyzed: (result: FrameAnalysis) => void;
  onSelectPole: (pole: Pole) => void;
  onPoleUpdated?: (pole: Pole) => void;
  onPoleDeleted?: (id: number) => void;
}

const Sidebar: React.FC<SidebarProps> = (props) => {
  const {
    searchQuery, setSearchQuery, isMeasuring, setIsMeasuring,
    handleExportGeoJSON, handleImportGeoJSON, gisInputRef,
    filterCondition, setFilterCondition, selectedPole, activeSpan,
    activeTab, setActiveTab, isCapturing, onAnalyze, analysis, onFeedback,
    history, stats, conductorWeight, setConductorWeight, tension, setTension,
    apiBase, userRole, showHeatmap, setShowHeatmap, activeTenant, poles,
    isOpen, onClose, viewMode, setViewMode, users, onVideoFrameAnalyzed,
    onSelectPole, onPoleUpdated, onPoleDeleted,
  } = props;

  const { activeTenantId, isOnline } = useTenant();
  const { toast, showToast, clearToast } = useToast();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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
      console.error('Falha ao exportar CSV:', error);
      showToast('Erro ao exportar CSV. Tente novamente.', 'error');
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

      <ToastBanner toast={toast} onDismiss={clearToast} />

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

        <NearbySearchPanel onSelectPole={onSelectPole} />

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
          {userRole !== 'VIEWER' && (
            <button
              className="btn btn-outline"
              onClick={() => setIsImportModalOpen(true)}
              title="Importar Postes via CSV"
            >
              <Upload size={14} /> Importar CSV
            </button>
          )}
          <button
            className="btn btn-outline"
            onClick={handleExportPDF}
            disabled={userRole === 'VIEWER'}
          >
            <FileText size={14} /> Relatório
          </button>
          {activeTenant && (
            <a
              href={api.getCroquiUrl(activeTenant.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              title="Abrir Croqui Digital da Rede (SVG)"
            >
              <Network size={14} /> Croqui
            </a>
          )}
          {activeTenant && userRole !== 'VIEWER' && (
            <a
              href={api.getProjectSummaryUrl(activeTenant.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              title="Resumo Executivo do Projeto (PDF)"
            >
              <FileText size={14} /> Resumo
            </a>
          )}
          {activeTenant && userRole !== 'VIEWER' && (
            <a
              href={api.getLevantamentoUrl(activeTenant.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              title="Exportar Levantamento de Campo (CSV)"
            >
              <Download size={14} /> Levantamento
            </a>
          )}
          <button
            className={`btn btn-outline ${viewMode === 'WORK_ORDERS' ? 'active' : ''}`}
            onClick={() => setViewMode(viewMode === 'WORK_ORDERS' ? 'MAP' : 'WORK_ORDERS')}
            title="Ordens de Serviço"
          >
            <ClipboardList size={14} /> Ordens de Serviço
          </button>
          <button
            className={`btn btn-outline ${viewMode === 'DRONE_LIVE' ? 'active' : ''}`}
            onClick={() => setViewMode(viewMode === 'DRONE_LIVE' ? 'MAP' : 'DRONE_LIVE')}
            title="Live Drone Feed"
          >
            <Zap size={14} /> Live
          </button>
          <button
            className={`btn btn-outline ${viewMode === 'ANALYTICS' ? 'active' : ''}`}
            onClick={() => setViewMode(viewMode === 'ANALYTICS' ? 'MAP' : 'ANALYTICS')}
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

      <FilterChips selected={filterCondition} onChange={setFilterCondition} />

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
            {selectedPole && userRole !== 'VIEWER' && (
              <button
                onClick={() => setActiveTab('bim')}
                className={activeTab === 'bim' ? 'active' : ''}
                title="Estrutura BIM / IFC-lite"
              >
                <Building2 size={12} className="inline mr-1" />BIM
              </button>
            )}
            {selectedPole && (
              <button
                onClick={() => setActiveTab('conductors')}
                className={activeTab === 'conductors' ? 'active' : ''}
                title="Condutores Elétricos"
              >
                <Cable size={12} className="inline mr-1" />Condutores
              </button>
            )}
            {selectedPole && (
              <button
                onClick={() => setActiveTab('equipment')}
                className={activeTab === 'equipment' ? 'active' : ''}
                title="Equipamentos do Poste (Phase 53)"
              >
                <Wrench size={12} className="inline mr-1" />Equip.
              </button>
            )}
            <button
              onClick={() => setActiveTab('topology')}
              className={activeTab === 'topology' ? 'active' : ''}
              title="Topologia da Rede (Phase 30)"
            >
              <Network size={12} className="inline mr-1" />Rede
            </button>
            <button
              onClick={() => setActiveTab('validation')}
              className={activeTab === 'validation' ? 'active' : ''}
              title="Validação de Topologia (Phase 42)"
            >
              <ShieldCheck size={12} className="inline mr-1" />Validação
            </button>
            <button
              onClick={() => setActiveTab('kpi')}
              className={activeTab === 'kpi' ? 'active' : ''}
              title="KPIs Executivos (Phase 49)"
            >
              <BarChart2 size={12} className="inline mr-1" />KPIs
            </button>
            <button
              onClick={() => setActiveTab('drone')}
              className={activeTab === 'drone' ? 'active' : ''}
              title="Roteiro de Inspeção por Drone (Phase 55)"
            >
              <Navigation size={12} className="inline mr-1" />Drone
            </button>
            {userRole !== 'VIEWER' && (
              <button
                onClick={() => setActiveTab('wizard')}
                className={activeTab === 'wizard' ? 'active' : ''}
                title="Wizard de Levantamento em Campo (Phase 63)"
              >
                <Clipboard size={12} className="inline mr-1" />Wizard
              </button>
            )}
            <button
              onClick={() => setActiveTab('bom')}
              className={activeTab === 'bom' ? 'active' : ''}
              title="Relação de Materiais / BOM (Phase 64)"
            >
              <PackageSearch size={12} className="inline mr-1" />BOM
            </button>
            {userRole === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={activeTab === 'admin' ? 'active' : ''}
                title="Dashboard Executivo Multi-Tenant (Phase 43)"
              >
                <Building2 size={12} className="inline mr-1" />Admin
              </button>
            )}
            {selectedPole && userRole !== 'VIEWER' && (
              <button
                onClick={() => setActiveTab('video')}
                className={activeTab === 'video' ? 'active' : ''}
                title="Captura de Vídeo / Frames"
              >
                <Video size={12} className="inline mr-1" />Vídeo
              </button>
            )}
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
              onPoleUpdated={onPoleUpdated}
              onPoleDeleted={onPoleDeleted}
            />
          )}

          {activeTab === 'history' && (
            <>
              <InspectionHistory history={history} apiBase={apiBase} />
              {selectedPole && userRole !== 'VIEWER' && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 8, paddingTop: 8 }}>
                  <ManualInspectionForm
                    pole={selectedPole}
                    onSaved={() => {
                      /* parent will refresh history on next mount or user interaction */
                    }}
                  />
                </div>
              )}
            </>
          )}

          {activeTab === 'video' && selectedPole && (
            <VideoCapturePanel
              pole={selectedPole}
              tenantId={activeTenantId}
              isOnline={isOnline}
              onFrameAnalyzed={onVideoFrameAnalyzed}
            />
          )}

          {activeTab === 'bim' && selectedPole && (
            <BimStructureEditor pole={selectedPole} />
          )}

          {activeTab === 'conductors' && selectedPole && (
            <ConductorPanel pole={selectedPole} allPoles={poles} />
          )}

          {activeTab === 'equipment' && selectedPole && (
            <EquipmentPanel pole={selectedPole} />
          )}

          {activeTab === 'topology' && (
            <TopologyPanel tenantId={activeTenantId || undefined} onSelectPole={onSelectPole} />
          )}

          {activeTab === 'validation' && (
            <ValidationPanel tenantId={activeTenantId || undefined} />
          )}

          {activeTab === 'kpi' && (
            <ExecutiveDashboard
              apiBase={`${apiBase}`}
              tenantId={activeTenantId ?? undefined}
            />
          )}

          {activeTab === 'admin' && userRole === 'ADMIN' && (
            <AdminOverview apiBase={`${apiBase}`} />
          )}

          {activeTab === 'drone' && (
            <DroneRoutePanel tenantId={activeTenantId} />
          )}

          {activeTab === 'wizard' && userRole !== 'VIEWER' && (
            <InspectionWizard
              tenantId={activeTenantId ?? 1}
              onSuccess={() => setActiveTab('details')}
              onCancel={() => setActiveTab('details')}
            />
          )}

          {activeTab === 'bom' && (
            <BomPanel tenantId={activeTenantId ?? 1} />
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
          <h3>Saúde da Rede</h3>
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
          <div className="card stat-card">
            <span className="stat-label">Atenção</span>
            <span className="stat-value">{stats.warning}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Críticos</span>
            <span className="stat-value">{stats.critical}</span>
          </div>
        </div>
      </div>

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(imported) => showToast(`${imported} poste${imported > 1 ? 's' : ''} importado${imported > 1 ? 's' : ''} com sucesso!`, 'success')}
      />
    </div>
  );
};

export default Sidebar;
