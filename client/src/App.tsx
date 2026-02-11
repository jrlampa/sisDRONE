import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Map from './components/Map';
import { MapPin, CheckCircle, AlertTriangle, HelpCircle, Info, Upload } from 'lucide-react';
import { degreesToUtm } from './utils/geo';

const API_BASE = 'http://localhost:3001/api';

interface Pole {
  id: number;
  name: string;
  lat: number;
  lng: number;
  utm_x?: string;
  utm_y?: string;
}

interface AnalysisResult {
  labelId: number;
  pole_type: string;
  structures: string[];
  condition: string;
  confidence: number;
  analysis_summary: string;
}

const App: React.FC = () => {
  const [poles, setPoles] = useState<Pole[]>([]);
  const [selectedPole, setSelectedPole] = useState<Pole | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPoles();
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

  const handleMapClick = async (lat: number, lng: number) => {
    const name = `Poste ${poles.length + 1}`;
    const utm = degreesToUtm(lat, lng);
    showNotification(`Criando ${name} (UTM: ${utm.x}, ${utm.y})...`);

    try {
      const res = await axios.post(`${API_BASE}/poles`, {
        lat,
        lng,
        name,
        utm_x: utm.x,
        utm_y: utm.y
      });
      setPoles(prev => [res.data, ...prev]);
      setSelectedPole(res.data);
      showNotification(`${name} criado com sucesso!`);
    } catch (err) {
      console.error('Error creating pole', err);
      showNotification('Erro ao criar poste. Verifique o backend.');
    }
  };

  const handleCaptureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPole) return;

    setIsCapturing(true);
    showNotification("Enviando imagem para análise IA...");

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Content = (reader.result as string).split(',')[1];
      try {
        const res = await axios.post(`${API_BASE}/analyze`, {
          poleId: selectedPole.id,
          image: base64Content
        });
        setAnalysis(res.data);
        showNotification("Análise concluída!");
      } catch (err) {
        console.error('Error analyzing image', err);
        showNotification("Erro na análise da imagem.");
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
      correction = prompt("Qual a correção técnica? (Ex: Poste de madeira com 1 transformador)") || "";
      if (!correction) return;
    }

    try {
      await axios.post(`${API_BASE}/feedback`, {
        labelId: analysis.labelId,
        poleId: selectedPole.id,
        isCorrect,
        correction
      });
      showNotification(isCorrect ? "Feedback positivo salvo!" : "Correção salva com sucesso!");
      setAnalysis(null); // Limpar após feedback
    } catch (err) {
      console.error('Error sending feedback', err);
      showNotification("Erro ao salvar feedback.");
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', width: '100vw', background: '#1a1a1a', color: 'white', fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar */}
      <div className="sidebar" style={{ width: '400px', background: '#242424', padding: '20px', borderRight: '1px solid #333', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '20px', color: '#4facfe' }}>sisDRONE <span style={{ fontSize: '0.8rem', color: '#888' }}>v0.1-beta</span></h1>

        {selectedPole ? (
          <div className="pole-details">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>{selectedPole.name}</h2>
            <div style={{ background: '#333', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ margin: '5px 0' }}><strong>Lat:</strong> {selectedPole.lat.toFixed(6)}</p>
              <p style={{ margin: '5px 0' }}><strong>Lng:</strong> {selectedPole.lng.toFixed(6)}</p>
              <hr style={{ border: '0.5px solid #444', margin: '10px 0' }} />
              <p style={{ margin: '5px 0', color: '#4facfe' }}><strong>UTM X:</strong> {selectedPole.utm_x || 'N/A'}</p>
              <p style={{ margin: '5px 0', color: '#4facfe' }}><strong>UTM Y:</strong> {selectedPole.utm_y || 'N/A'}</p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleFileChange}
            />

            <button
              onClick={handleCaptureClick}
              disabled={isCapturing}
              style={{
                width: '100%',
                padding: '12px',
                background: '#4facfe',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '20px'
              }}
            >
              <Upload size={20} />
              {isCapturing ? 'Analisando...' : 'Carregar Snapshot'}
            </button>

            {analysis && (
              <div className="analysis-result" style={{ background: '#2d2d2d', border: '1px solid #444', padding: '15px', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {analysis.confidence > 0.8 ? <CheckCircle color="#4caf50" size={18} /> :
                    analysis.confidence > 0.4 ? <AlertTriangle color="#ffeb3b" size={18} /> :
                      <HelpCircle color="#f44336" size={18} />}
                  Resultado IA ({Math.round(analysis.confidence * 100)}%)
                </h3>
                <p><strong>Tipo:</strong> {analysis.pole_type}</p>
                <p><strong>Estruturas:</strong> {analysis.structures.join(', ')}</p>
                <p><strong>Condição:</strong> {analysis.condition}</p>
                <hr style={{ border: '0.5px solid #444', margin: '10px 0' }} />
                <p style={{ fontSize: '0.9rem', fontStyle: 'italic', color: '#aaa' }}>{analysis.analysis_summary}</p>

                <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleFeedback(true)}
                    style={{ flex: 1, padding: '8px', background: '#4caf50', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
                  >
                    ✓ Correto
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    style={{ flex: 1, padding: '8px', background: '#f44336', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
                  >
                    ✗ Corrigir
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>
            <MapPin size={48} style={{ marginBottom: '10px', opacity: 0.5 }} />
            <p>Selecione um poste no mapa ou clique para criar um novo.</p>
          </div>
        )}

        <div className="stats" style={{ marginTop: '40px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Progresso</h3>
          <p style={{ margin: '10px 0', fontSize: '1.1rem' }}>Total de Postes: {poles.length}</p>
        </div>
      </div>

      {/* Map Area */}
      <div className="map-view" style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        {notification && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.9)',
            padding: '10px 20px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: '1px solid #4facfe',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            pointerEvents: 'none'
          }}>
            <Info size={16} color="#4facfe" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{notification}</span>
          </div>
        )}
        <Map
          poles={poles}
          onMapClick={handleMapClick}
          onMarkerClick={(pole) => setSelectedPole(pole)}
        />
      </div>
    </div>
  );
};

export default App;
