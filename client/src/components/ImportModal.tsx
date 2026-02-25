/**
 * ImportModal.tsx — Modal de Importação em Massa de Postes via CSV (Phase 36)
 *
 * Permite arrastar/soltar ou clicar para selecionar um arquivo CSV.
 * Mostra preview das primeiras 5 linhas antes de importar.
 * Exibe resultado com contagem e lista de erros por linha.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (imported: number) => void;
}

interface ImportError {
  line: number;
  reason: string;
}

const CSV_TEMPLATE = 'name,lat,lng,material,status\nPoste 001,-22.15018,-42.92185,Concreto,ok';

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [csvText, setCsvText] = useState('');
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: ImportError[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadText = useCallback((text: string) => {
    setCsvText(text);
    setResult(null);
    const lines = text.split('\n').filter(Boolean);
    setPreviewLines(lines.slice(0, 6)); // header + 5 rows
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => loadText(e.target?.result as string ?? '');
    reader.readAsText(file, 'utf-8');
  }, [loadText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    try {
      const res = await api.importPolesCSV(csvText);
      setResult(res.data);
      if (res.data.imported > 0) onSuccess(res.data.imported);
    } catch {
      setResult({ imported: 0, errors: [{ line: 0, reason: 'Erro de comunicação com o servidor.' }] });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setCsvText('');
    setPreviewLines([]);
    setResult(null);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '640px', width: '90vw' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-accent" />
            <h3>Importar Postes via CSV</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {!result ? (
          <>
            {/* Drop zone */}
            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '8px', padding: '2rem', textAlign: 'center',
                background: dragOver ? 'var(--surface)' : 'transparent',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={32} className="mx-auto mb-2 text-muted" />
              <p className="text-sm text-muted">
                Arraste e solte um arquivo CSV aqui ou <span className="text-accent">clique para selecionar</span>
              </p>
              <p className="text-xs text-muted mt-1">
                Colunas obrigatórias: <code>name, lat, lng</code> | Opcionais: <code>material, status, height</code>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>

            {/* Template download */}
            <div className="flex justify-between items-center mt-2">
              <button
                className="btn btn-ghost btn-sm text-xs"
                onClick={() => loadText(CSV_TEMPLATE)}
              >
                Usar template de exemplo
              </button>
              <span className="text-xs text-muted">Máx. 1.000 linhas</span>
            </div>

            {/* Preview */}
            {previewLines.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted mb-1">Pré-visualização (até 6 linhas):</p>
                <div style={{ background: 'var(--darker)', borderRadius: '6px', padding: '0.5rem', overflowX: 'auto' }}>
                  <pre style={{ fontSize: '0.72rem', margin: 0, whiteSpace: 'pre' }}>
                    {previewLines.join('\n')}
                  </pre>
                </div>
              </div>
            )}

            <div className="modal-footer mt-4">
              <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
              <button
                className="btn btn-primary"
                disabled={!csvText.trim() || importing}
                onClick={handleImport}
              >
                {importing ? 'Importando...' : `Importar Postes`}
              </button>
            </div>
          </>
        ) : (
          /* Result panel */
          <div className="mt-4">
            <div className={`flex items-center gap-2 mb-3 ${result.imported > 0 ? 'text-success' : 'text-danger'}`}>
              {result.imported > 0
                ? <CheckCircle size={20} />
                : <AlertTriangle size={20} />
              }
              <span className="font-semibold">
                {result.imported > 0
                  ? `${result.imported} poste${result.imported > 1 ? 's' : ''} importado${result.imported > 1 ? 's' : ''} com sucesso`
                  : 'Nenhum poste importado'}
              </span>
            </div>

            {result.errors.length > 0 && (
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                <p className="text-xs text-muted mb-1">Erros ({result.errors.length}):</p>
                {result.errors.map((e, i) => (
                  <div key={i} className="text-xs text-danger py-1 border-b" style={{ borderColor: 'var(--border)' }}>
                    Linha {e.line}: {e.reason}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-footer mt-4">
              <button className="btn btn-outline" onClick={handleReset}>Importar mais</button>
              <button className="btn btn-primary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportModal;
