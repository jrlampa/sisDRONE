import React, { useEffect, useState, useRef } from 'react';
import { Camera, Signal, Battery, Zap, LayoutDashboard, MapPin } from 'lucide-react';

interface DroneTelemetry {
  battery: number;
  signal: number;
  altitude_m: number;
  speed_ms: number;
  lat: number;
  lng: number;
}

interface DroneLiveViewProps {
  apiBase: string;
}

const WS_URL = 'ws://localhost:3001/ws/drone';

const DroneLiveView: React.FC<DroneLiveViewProps> = ({ apiBase }) => {
  const [telemetry, setTelemetry] = useState<DroneTelemetry>({
    battery: 42,
    signal: 98,
    altitude_m: 12.4,
    speed_ms: 2.1,
    lat: -22.15018,
    lng: -42.92185,
  });
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 2s
        setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'telemetry') {
            setTelemetry(data);
          }
        } catch { /* ignore malformed WS messages */ }
      };
    };

    connect();
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const batteryColor = telemetry.battery > 50 ? 'text-green-400' : telemetry.battery > 20 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="drone-live-container animate-fade-in">
      <div className="live-header flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="live-indicator">
            <div className={`dot ${connected ? 'animate-pulse' : 'opacity-30'}`}></div>
            <span>{connected ? 'LIVE FEED' : 'RECONECTANDO...'}</span>
          </div>
          <div className="drone-status-tag">
            <Signal size={14} className="text-green-400" />
            <span>{telemetry.signal}% SIGNAL</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1">
            <Battery size={14} className={batteryColor} />
            <span className={batteryColor}>{telemetry.battery.toFixed(0)}%</span>
          </div>
          <div className="text-muted">ALT: {telemetry.altitude_m}m</div>
          <div className="text-muted">SPD: {telemetry.speed_ms}m/s</div>
        </div>
      </div>

      <div className="video-viewport relative rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-black">
        <video
          autoPlay
          loop
          muted
          className="w-full h-full object-cover opacity-80"
        >
          <source src={`${apiBase}/uploads/simu_drone.mp4`} type="video/mp4" />
          Seu navegador não suporta vídeos.
        </video>

        {/* HUD Elements */}
        <div className="hud-overlay absolute inset-0 pointer-events-none p-6">
          <div className="hud-corners absolute inset-0 border-[2px] border-white/5 m-4"></div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-primary/20 rounded-full flex items-center justify-center">
            <div className="w-1 h-20 bg-primary/20 absolute"></div>
            <div className="h-1 w-20 bg-primary/20 absolute"></div>
          </div>

          <div className="absolute bottom-8 right-8 bg-black/60 backdrop-blur-md p-4 rounded-lg border border-white/10">
            <div className="text-[10px] text-primary font-bold mb-2 uppercase tracking-widest">IA Detection Active</div>
            <div className="flex items-center gap-2 text-xs">
              <Zap size={12} className="text-accent" />
              <span>Scanning structures...</span>
            </div>
          </div>

          {/* Live GPS */}
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 text-[10px] font-mono">
            <div className="flex items-center gap-1 text-primary">
              <MapPin size={10} />
              <span>{telemetry.lat.toFixed(5)}, {telemetry.lng.toFixed(5)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="drone-controls-grid grid grid-cols-3 gap-4 mt-4">
        <div className="card glass-panel p-3 flex flex-col items-center justify-center hover:bg-white/5 cursor-pointer">
          <Camera size={20} className="mb-1" />
          <span className="text-[10px] uppercase font-bold text-muted">Capturar</span>
        </div>
        <div className="card glass-panel p-3 flex flex-col items-center justify-center hover:bg-white/5 cursor-pointer">
          <LayoutDashboard size={20} className="mb-1" />
          <span className="text-[10px] uppercase font-bold text-muted">Telemetria</span>
        </div>
        <div className="card glass-panel p-3 flex flex-col items-center justify-center bg-primary/10 border-primary/30">
          <Zap size={20} className="mb-1 text-primary" />
          <span className="text-[10px] uppercase font-bold text-primary">Auto-Piloto</span>
        </div>
      </div>
    </div>
  );
};

export default DroneLiveView;
