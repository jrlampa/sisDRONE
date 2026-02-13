import React, { useState } from 'react';
import { Plus, Camera, X } from 'lucide-react';

interface MobileFabProps {
  onAddPole: () => void;
  onCameraCapture: (file: File) => void;
  isCapturing: boolean;
}

const MobileFab: React.FC<MobileFabProps> = ({ onAddPole, onCameraCapture, isCapturing }) => {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCameraClick = () => {
    fileInputRef.current?.click();
    setIsOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onCameraCapture(e.target.files[0]);
    }
  };

  return (
    <div className="mobile-fab-container">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden-input"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        aria-label="Capturar imagem da câmera"
      />

      {isOpen && (
        <div className="fab-options animate-slide-up">
          <button
            className="fab-option-btn"
            onClick={handleCameraClick}
            disabled={isCapturing}
          >
            <Camera size={20} />
            <span>Scan IA</span>
          </button>

          <button
            className="fab-option-btn"
            onClick={() => { onAddPole(); setIsOpen(false); }}
          >
            <Plus size={20} />
            <span>Add Poste</span>
          </button>
        </div>
      )}

      <button
        className={`fab-main-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Fechar Menu Ações" : "Abrir Ações Rápidas"}
      >
        {isOpen ? <X size={24} /> : <Plus size={24} />}
      </button>

      {isOpen && (
        <div className="fab-overlay" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

export default MobileFab;
