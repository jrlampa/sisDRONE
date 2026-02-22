/**
 * useAppHandlers
 *
 * Consolidates all application-level event handlers from App.tsx.
 * Separação de Responsabilidades: App.tsx stays as a composition root;
 * this hook owns all complex event logic.
 */
import { useCallback } from 'react';
import { degreesToUtm } from '../utils/geo';
import { calculateDistance } from '../utils/math';
import { api } from '../services/api';
import type { Pole, Span, Inspection, AnalysisResult, Tenant, User } from '../types';

interface AppHandlersOptions {
  poles: Pole[];
  activeTenantId: number;
  isMeasuring: boolean;
  measurementStart: Pole | null;
  selectedPole: Pole | null;
  analysis: AnalysisResult | null;
  users: User[];
  tenants: Tenant[];

  setPoles: React.Dispatch<React.SetStateAction<Pole[]>>;
  setSelectedPole: (p: Pole | null) => void;
  setAnalysis: (a: AnalysisResult | null) => void;
  setHistory: (h: Inspection[]) => void;
  setActiveTab: (t: 'details' | 'history' | 'eng' | 'video' | 'bim') => void;
  setIsCapturing: (v: boolean) => void;
  setIsMeasuring: (v: boolean) => void;
  setMeasurementStart: (p: Pole | null) => void;
  setActiveSpan: (s: Span | null) => void;
  setActiveTenantId: (id: number) => void;
  setActiveTenant: (t: Tenant | null) => void;
  setCurrentUser: (u: User) => void;

  showNotification: (msg: string) => void;
  fetchStats: () => void;
  fetchPoles: () => void;
}

export function useAppHandlers(opts: AppHandlersOptions) {
  const {
    poles, activeTenantId, isMeasuring, measurementStart, selectedPole, analysis,
    users, tenants,
    setPoles, setSelectedPole, setAnalysis, setHistory, setActiveTab,
    setIsCapturing, setIsMeasuring, setMeasurementStart, setActiveSpan,
    setActiveTenantId, setActiveTenant, setCurrentUser,
    showNotification, fetchStats, fetchPoles,
  } = opts;  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (isMeasuring) return;
    const utm = degreesToUtm(lat, lng);
    try {
      showNotification('Criando Poste...');
      const res = await api.createPole({
        lat, lng,
        name: `Poste ${poles.length + 1}`,
        utm_x: utm.x,
        utm_y: utm.y,
        tenant_id: activeTenantId,
      });
      setPoles(prev => [res.data, ...prev]);
      setSelectedPole(res.data);
      fetchStats();
      showNotification('Registrado!');
    } catch {
      showNotification('Erro na conexão.');
    }
  }, [isMeasuring, poles.length, activeTenantId, setPoles, setSelectedPole, fetchStats, showNotification]);

  const handleMarkerClick = useCallback((pole: Pole) => {
    if (isMeasuring) {
      if (!measurementStart) {
        setMeasurementStart(pole);
        showNotification('Selecione o segundo poste');
      } else {
        const dist = calculateDistance(measurementStart.lat, measurementStart.lng, pole.lat, pole.lng);
        setActiveSpan({ p1: measurementStart, p2: pole, distance: dist });
        setActiveTab('eng');
        setMeasurementStart(null);
        setIsMeasuring(false);
        showNotification('Vão selecionado!');
      }
      return;
    }
    setSelectedPole(pole);
    setAnalysis(null);
    setActiveTab('details');
  }, [isMeasuring, measurementStart, setMeasurementStart, setActiveSpan, setActiveTab, setIsMeasuring, setSelectedPole, setAnalysis, showNotification]);

  const handleFeedback = useCallback(async (isCorrect: boolean) => {
    if (!analysis || !selectedPole) return;
    const correction = isCorrect ? '' : (prompt('Qual a correção técnica?') || '');
    if (!isCorrect && !correction) return;
    try {
      await api.sendFeedback({ labelId: analysis.labelId, poleId: selectedPole.id, isCorrect, correction });
      showNotification(isCorrect ? 'Calibrado!' : 'Corrigido!');
      setAnalysis(null);
      fetchStats();
      api.getHistory(selectedPole.id).then(r => setHistory(r.data)).catch(() => {});
    } catch {
      showNotification('Erro no feedback.');
    }
  }, [analysis, selectedPole, setAnalysis, setHistory, fetchStats, showNotification]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!selectedPole) return;
    setIsCapturing(true);
    showNotification('Analisando...');
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const res = await api.analyzeImage(selectedPole.id, base64);
        setAnalysis(res.data);
        fetchStats();
        api.getHistory(selectedPole.id).then(r => setHistory(r.data)).catch(() => {});
        showNotification('Concluído!');
      } catch {
        showNotification('Erro na IA.');
      } finally {
        setIsCapturing(false);
      }
    };
    reader.readAsDataURL(file);
  }, [selectedPole, setIsCapturing, setAnalysis, setHistory, fetchStats, showNotification]);

  const handleExportGeoJSON = useCallback(async () => {
    try {
      const res = await api.exportGis();
      const blob = new Blob([JSON.stringify(res.data)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `sisdrone_network_${Date.now()}.geojson`;
      link.click();
    } catch {
      showNotification('Erro na exportação.');
    }
  }, [showNotification]);

  const handleImportGeoJSON = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        const geojson = JSON.parse(e.target?.result as string);
        await api.importGis(geojson);
        fetchPoles();
        fetchStats();
        showNotification('GIS Importado!');
      } catch {
        showNotification('Erro no GIS.');
      }
    };
    reader.readAsText(file);
  }, [fetchPoles, fetchStats, showNotification]);

  const handleUserSwitch = useCallback((userId: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setCurrentUser(user);
    setActiveTenantId(user.tenant_id);
    localStorage.setItem('sisdrone_mock_role', user.role);
    const tenant = tenants.find(t => t.id === user.tenant_id);
    if (tenant) setActiveTenant(tenant);
    showNotification(`Logado como ${user.username} (${user.role})`);
  }, [users, tenants, setCurrentUser, setActiveTenantId, setActiveTenant, showNotification]);

  const handleAnalyzeClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files) handleImageUpload(target.files[0]);
    };
    input.click();
  }, [handleImageUpload]);

  const handleMobileAddPole = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => handleMapClick(pos.coords.latitude, pos.coords.longitude),
      () => showNotification('Erro ao obter GPS')
    );
  }, [handleMapClick, showNotification]);

  return {
    handleMapClick,
    handleMarkerClick,
    handleFeedback,
    handleImageUpload,
    handleExportGeoJSON,
    handleImportGeoJSON,
    handleUserSwitch,
    handleAnalyzeClick,
    handleMobileAddPole,
  };
}
