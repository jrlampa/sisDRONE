import React, { useState, useCallback } from 'react';
import { Image, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { api } from '../../services/api';

interface PoleImage {
  id: number;
  file_path: string;
  captured_at: string;
}

interface PoleImagesProps {
  poleId: number;
  apiBase: string;
}

const PoleImages: React.FC<PoleImagesProps> = ({ poleId, apiBase }) => {
  const MAX_DISPLAYED = 6;
  const [expanded, setExpanded] = useState(false);
  const [images, setImages] = useState<PoleImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPoleImages(poleId);
      setImages(res.data.images);
      setLoaded(true);
    } catch {
      setError('Falha ao carregar imagens do poste');
    } finally {
      setLoading(false);
    }
  }, [poleId, loaded]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded) loadImages();
  };

  return (
    <div className="mt-3 pt-3 border-t border-light/10">
      <button
        className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted font-bold w-full text-left"
        onClick={handleToggle}
        aria-expanded={expanded}
      >
        <Image size={14} />
        Imagens Capturadas
        {expanded ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
      </button>

      {expanded && (
        <div className="mt-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted py-2">
              <Loader size={12} className="animate-spin" />
              Carregando imagens...
            </div>
          )}
          {error && (
            <p className="text-xs text-danger py-2">{error}</p>
          )}
          {!loading && !error && images.length === 0 && loaded && (
            <p className="text-xs text-muted py-2">Nenhuma imagem registrada para este poste.</p>
          )}
          {!loading && !error && images.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {images.slice(0, MAX_DISPLAYED).map((img) => (
                <a
                  key={img.id}
                  href={`${apiBase}${img.file_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Capturado em: ${new Date(img.captured_at).toLocaleDateString('pt-BR')}`}
                  className="block rounded overflow-hidden border border-light/10 hover:border-accent transition"
                >
                  <img
                    src={`${apiBase}${img.file_path}`}
                    alt={`Imagem ${img.id}`}
                    className="w-full h-16 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="block text-[10px] text-muted text-center py-0.5">
                    {new Date(img.captured_at).toLocaleDateString('pt-BR')}
                  </span>
                </a>
              ))}
              {images.length > MAX_DISPLAYED && (
                <span className="col-span-2 text-xs text-muted text-center">
                  +{images.length - MAX_DISPLAYED} imagens adicionais
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PoleImages;
