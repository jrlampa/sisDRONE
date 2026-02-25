/**
 * useVideoCapture
 *
 * Responsabilidade única: gerencia captura de vídeo/frames da câmera do dispositivo.
 *
 * Modos:
 *   'frame'     — online: captura frames como fotos, envia para análise imediata.
 *   'recording' — offline/fallback: grava vídeo, envia em chunks quando há conexão.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { addToQueue } from '../utils/offlineQueue';

export type CaptureMode = 'frame' | 'recording';

export interface FrameAnalysis {
  labelId: number;
  imageId: number;
  imageUrl: string;
  sequence: number;
  analysis_summary: string;
  condition: string;
  confidence: number;
  pole_type: string;
  ahi_score?: number;
}

interface UseVideoCaptureOptions {
  poleId: number | null;
  tenantId: number;
  isOnline: boolean;
  frameIntervalMs?: number;   // interval between frame captures in ms (default 2000)
  onFrameAnalyzed?: (result: FrameAnalysis) => void;
  onError?: (msg: string) => void;
}

export function useVideoCapture({
  poleId,
  tenantId,
  isOnline,
  frameIntervalMs = 2000,
  onFrameAnalyzed,
  onError,
}: UseVideoCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [mode, setMode] = useState<CaptureMode>('frame');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [pendingChunks, setPendingChunks] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkIndexRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);

  // Choose effective mode: force 'recording' if offline
  const effectiveMode: CaptureMode = !isOnline ? 'recording' : mode;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
  }, []);

  /** Extract a JPEG frame from the current video stream as base64 */
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return dataUrl.split(',')[1]; // strip data:image/jpeg;base64,
  }, []);

  /** Send a single frame for AI analysis */
  const sendFrame = useCallback(async (base64: string, seq: number) => {
    if (!poleId) return;
    try {
      const res = await api.analyzeVideoFrame(poleId, base64, sessionId, seq);
      onFrameAnalyzed?.(res.data);
    } catch (err) {
      const e = err as { message?: string };
      if (!isOnline || e?.message === 'Network Error') {
        // Queue for later upload
        await addToQueue({
          url: '/api/video/frame',
          method: 'post',
          data: { pole_id: poleId, image: base64, sessionId, sequence: seq },
        });
        setPendingChunks(p => p + 1);
      } else {
        onError?.('Erro ao analisar frame');
      }
    }
  }, [poleId, sessionId, isOnline, onFrameAnalyzed, onError]);

  /** Upload a recorded video chunk to the server */
  const uploadChunk = useCallback(async (
    blob: Blob,
    idx: number,
    total: number,
    isLast: boolean
  ) => {
    if (!poleId || !sessionId) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        await api.uploadVideoChunk({
          sessionId,
          pole_id: poleId,
          chunk: base64,
          chunkIndex: idx,
          totalChunks: total,
          isLast,
        });
        if (isLast) setPendingChunks(0);
      } catch {
        // Queue offline
        await addToQueue({
          url: '/api/video/upload',
          method: 'post',
          data: { sessionId, pole_id: poleId, chunk: base64, chunkIndex: idx, totalChunks: total, isLast },
        });
        setPendingChunks(p => p + 1);
      }
    };
    reader.readAsDataURL(blob);
  }, [poleId, sessionId]);

  const startCapture = useCallback(async (requestedMode: CaptureMode) => {
    if (!poleId) {
      onError?.('Selecione um poste antes de iniciar a captura');
      return;
    }
    if (isCapturing) return;

    setMode(requestedMode);
    setFrameCount(0);
    chunkIndexRef.current = 0;
    chunksRef.current = [];

    // Get camera stream
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch {
      onError?.('Câmera não disponível. Verifique as permissões.');
      return;
    }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }

    // Start session on server
    const activeMode: CaptureMode = !isOnline ? 'recording' : requestedMode;
    try {
      const sessRes = await api.startVideoSession(poleId, tenantId, activeMode);
      setSessionId(sessRes.data.sessionId);
    } catch {
      // Continue without a server session (offline)
    }

    setIsCapturing(true);

    if (activeMode === 'frame') {
      // Capture frames at interval
      let seq = 0;
      frameTimerRef.current = setInterval(async () => {
        const frame = captureFrame();
        if (!frame) return;
        setFrameCount(c => c + 1);
        await sendFrame(frame, seq++);
      }, frameIntervalMs);
    } else {
      // Record video
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 800_000 });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(2000); // collect chunks every 2s
    }
  }, [poleId, tenantId, isOnline, isCapturing, captureFrame, sendFrame, frameIntervalMs, onError]);

  const stopCapture = useCallback(async () => {
    if (!isCapturing) return;
    setIsCapturing(false);

    // Stop frame timer
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }

    // Stop recorder and upload chunks
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // Give it a moment to flush
      await new Promise<void>(resolve => setTimeout(resolve, 300));

      const chunks = chunksRef.current;
      if (chunks.length > 0 && sessionId && poleId) {
        for (let i = 0; i < chunks.length; i++) {
          await uploadChunk(chunks[i], i, chunks.length, i === chunks.length - 1);
        }
        chunksRef.current = [];
      }
    }

    // Mark session complete
    if (sessionId) {
      try { await api.completeVideoSession(sessionId); } catch { /* ignore session completion errors */ }
    }

    stopStream();
    setSessionId(null);
  }, [isCapturing, sessionId, poleId, stopStream, uploadChunk]);

  // Keep a ref to the latest stopCapture to avoid stale closure in cleanup effect
  const stopCaptureRef = useRef(stopCapture);
  useEffect(() => {
    stopCaptureRef.current = stopCapture;
  });

  // Auto-stop on unmount
  useEffect(() => {
    return () => {
      stopCaptureRef.current();
    };
  }, []);

  return {
    isCapturing,
    effectiveMode,
    frameCount,
    pendingChunks,
    videoRef,
    canvasRef,
    startCapture,
    stopCapture,
  };
}
