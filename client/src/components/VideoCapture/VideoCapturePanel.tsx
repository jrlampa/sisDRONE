/**
 * VideoCapturePanel
 *
 * Painel de captura de vídeo/frames para inspeção de postes.
 * Modos:
 *   📷 Foto   — captura frames em intervalos, envia para análise imediata (requer conexão)
 *   🎥 Gravar — grava vídeo localmente (fallback offline), envia ao reconectar
 */
import React, { useEffect, useRef } from 'react';
import { Camera, Video, StopCircle, Wifi, WifiOff, Clock, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { useVideoCapture, type CaptureMode, type FrameAnalysis } from '../../hooks/useVideoCapture';
import type { Pole } from '../../types';

const API_BASE = 'http://localhost:3001';

interface VideoCaptureProps {
  pole: Pole | null;
  tenantId: number;
  isOnline: boolean;
  onFrameAnalyzed: (result: FrameAnalysis) => void;
}

const VideoCapturePanel: React.FC<VideoCaptureProps> = ({
  pole,
  tenantId,
  isOnline,
  onFrameAnalyzed,
}) => {
  const [lastResult, setLastResult] = React.useState<FrameAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);

  const {
    isCapturing,
    effectiveMode,
    frameCount,
    pendingChunks,
    videoRef,
    canvasRef,
    startCapture,
    stopCapture,
  } = useVideoCapture({
    poleId: pole?.id ?? null,
    tenantId,
    isOnline,
    frameIntervalMs: 2500,
    onFrameAnalyzed: (result) => {
      setLastResult(result);
      onFrameAnalyzed(result);
    },
    onError: setErrorMsg,
  });

  // Sync videoRef with DOM element
  useEffect(() => {
    if (videoElRef.current) {
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = videoElRef.current;
    }
  }, [videoRef]);

  const handleStart = (requestedMode: CaptureMode) => {
    setErrorMsg(null);
    setLastResult(null);
    startCapture(requestedMode);
  };

  const getConditionClass = (condition: string = '') => {
    const c = condition.toLowerCase();
    if (c.includes('crít') || c.includes('crit') || c.includes('ruim')) return 'text-danger';
    if (c.includes('aten') || c.includes('regul')) return 'text-warning';
    return 'text-success';
  };

  return (
    <div className="video-capture-panel animate-fade-in">
      {/* Header */}
      <div className="flex-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
          Captura de Vídeo / Frames
        </h3>
        <div className={`flex items-center gap-1 text-xs font-mono ${isOnline ? 'text-success' : 'text-danger'}`}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Camera viewport */}
      <div className="relative rounded-lg overflow-hidden bg-black border border-white/10 mb-3" style={{ aspectRatio: '16/9' }}>
        <video
          ref={videoElRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ display: isCapturing ? 'block' : 'none' }}
        />
        {/* Hidden canvas for frame extraction */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Placeholder when not capturing */}
        {!isCapturing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted gap-2">
            <Camera size={40} className="opacity-30" />
            <span className="text-xs">
              {pole ? 'Inicie a captura abaixo' : 'Selecione um poste primeiro'}
            </span>
          </div>
        )}

        {/* Live status overlay */}
        {isCapturing && (
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <div className="flex items-center gap-1 bg-black/70 px-2 py-1 rounded text-[10px] font-bold">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {effectiveMode === 'frame' ? 'FOTO AO VIVO' : 'GRAVANDO'}
            </div>
          </div>
        )}

        {/* Frame count overlay */}
        {isCapturing && effectiveMode === 'frame' && (
          <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1">
            <Camera size={10} />
            {frameCount} frames
          </div>
        )}

        {/* Pending sync indicator */}
        {pendingChunks > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-yellow-900/80 px-2 py-1 rounded text-[10px]">
            <Upload size={10} className="text-yellow-400" />
            <span className="text-yellow-300">{pendingChunks} pendente(s)</span>
          </div>
        )}
      </div>

      {/* Mode selector + controls */}
      {!isCapturing ? (
        <div className="flex gap-2">
          <button
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={() => handleStart('frame')}
            disabled={!pole}
            title={!isOnline ? 'Offline: modo gravação será ativado automaticamente' : 'Capturar frames e analisar em tempo real'}
          >
            <Camera size={16} />
            <span>Modo Foto</span>
            {!isOnline && <WifiOff size={12} className="opacity-60" />}
          </button>
          <button
            className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
            onClick={() => handleStart('recording')}
            disabled={!pole}
            title="Gravar vídeo (salvo localmente se offline)"
          >
            <Video size={16} />
            <span>Gravar</span>
          </button>
        </div>
      ) : (
        <button
          className="btn btn-danger btn-full flex items-center justify-center gap-2"
          onClick={stopCapture}
        >
          <StopCircle size={16} />
          Parar {effectiveMode === 'frame' ? 'Captura' : 'Gravação'}
        </button>
      )}

      {/* Offline notice */}
      {!isOnline && (
        <div className="mt-2 p-2 rounded bg-yellow-900/30 border border-yellow-600/30 text-xs text-yellow-300 flex items-start gap-2">
          <WifiOff size={12} className="mt-0.5 shrink-0" />
          <span>
            <strong>Modo offline:</strong> Gravação salva localmente.
            Frames enfileirados para análise ao reconectar.
          </span>
        </div>
      )}

      {/* Last frame result */}
      {lastResult && (
        <div className="mt-3 card bg-darker p-3 animate-slide-up border border-white/10 rounded">
          <div className="flex-between mb-1">
            <span className="text-xs font-bold text-muted uppercase">Último Frame #{lastResult.sequence}</span>
            <span className={`text-xs font-bold ${lastResult.confidence > 0.7 ? 'text-success' : 'text-warning'}`}>
              {Math.round(lastResult.confidence * 100)}% Conf.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {lastResult.condition?.toLowerCase().includes('boa') ||
             lastResult.condition?.toLowerCase().includes('ót') ||
             lastResult.condition?.toLowerCase().includes('saud')
              ? <CheckCircle size={14} className="text-success shrink-0" />
              : <AlertCircle size={14} className="text-warning shrink-0" />
            }
            <span className={`text-sm ${getConditionClass(lastResult.condition)}`}>
              {lastResult.condition}
            </span>
          </div>
          {lastResult.analysis_summary && (
            <p className="text-xs text-muted mt-1 line-clamp-2">{lastResult.analysis_summary}</p>
          )}
          {lastResult.imageUrl && (
            <img
              src={`${API_BASE}${lastResult.imageUrl}`}
              alt="Frame capturado"
              className="mt-2 rounded w-full object-cover"
              style={{ maxHeight: 80 }}
            />
          )}
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="mt-2 p-2 rounded bg-red-900/30 border border-red-600/30 text-xs text-red-300 flex items-start gap-2">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Session summary when capturing */}
      {isCapturing && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="bg-darker rounded p-2">
            <div className="text-lg font-bold font-mono">{frameCount}</div>
            <div className="text-[10px] text-muted">Frames</div>
          </div>
          <div className="bg-darker rounded p-2">
            <div className="text-lg font-bold font-mono">
              <Clock size={14} className="inline mr-1" />
            </div>
            <div className="text-[10px] text-muted">Ao Vivo</div>
          </div>
          <div className="bg-darker rounded p-2">
            <div className={`text-lg font-bold font-mono ${pendingChunks > 0 ? 'text-yellow-400' : 'text-success'}`}>
              {pendingChunks}
            </div>
            <div className="text-[10px] text-muted">Pendentes</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCapturePanel;
