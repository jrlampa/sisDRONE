/**
 * PhotoUploadForm.tsx — Upload de Fotos de Campo por Poste (Phase 56)
 *
 * Permite ao projetista/técnico capturar ou selecionar uma foto no campo
 * e associá-la ao poste inspecionado.
 *
 * Thin Frontend: o arquivo é codificado em base64 e enviado ao backend
 * (photoRoutes.ts) que valida, persiste e indexa no banco de dados.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Loader } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastBanner from '../ToastBanner';

interface PhotoUploadFormProps {
  poleId: number;
  onUploaded?: () => void;
}

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const PhotoUploadForm: React.FC<PhotoUploadFormProps> = ({ poleId, onUploaded }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [b64, setB64] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast, showToast, clearToast } = useToast();

  const handleFile = useCallback((file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast('Formato não suportado. Use JPEG, PNG ou WebP.', 'error');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showToast(`Arquivo muito grande. Máximo ${MAX_SIZE_MB} MB.`, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setMimeType(file.type);
      // Strip data-URL prefix for upload
      setB64(dataUrl.split(',')[1] ?? dataUrl);
    };
    reader.readAsDataURL(file);
  }, [showToast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!b64) return;
    setUploading(true);
    try {
      await api.uploadPolePhoto(poleId, b64, mimeType, label.trim() || undefined);
      showToast('Foto enviada com sucesso!', 'success');
      setPreview(null);
      setB64(null);
      setLabel('');
      if (inputRef.current) inputRef.current.value = '';
      onUploaded?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast(msg ?? 'Erro ao enviar foto.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setB64(null);
    setLabel('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      {toast && <ToastBanner message={toast.message} type={toast.type} onClose={clearToast} />}

      {!preview ? (
        <div
          className="border-2 border-dashed border-light/20 rounded-lg p-4 text-center cursor-pointer hover:border-accent/60 transition"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          role="button"
          tabIndex={0}
          aria-label="Selecionar ou arrastar foto"
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <Camera size={20} className="mx-auto mb-2 text-muted" />
          <p className="text-xs text-muted">
            Clique ou arraste uma foto (JPEG, PNG, WebP — máx. {MAX_SIZE_MB} MB)
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Preview */}
          <div className="relative">
            <img
              src={preview}
              alt="Prévia da foto"
              className="w-full max-h-40 object-cover rounded-lg border border-light/10"
            />
            <button
              onClick={handleCancel}
              className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white hover:bg-black/80 transition"
              aria-label="Remover foto selecionada"
            >
              <X size={12} />
            </button>
          </div>

          {/* Label */}
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={200}
            className="w-full bg-background border border-light/20 rounded px-2 py-1 text-xs text-light placeholder-muted focus:border-accent focus:outline-none"
          />

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center justify-center gap-1.5 bg-accent text-white text-xs font-semibold py-1.5 rounded hover:bg-accent/90 disabled:opacity-50 transition"
          >
            {uploading ? <Loader size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'Enviando...' : 'Enviar Foto'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PhotoUploadForm;
