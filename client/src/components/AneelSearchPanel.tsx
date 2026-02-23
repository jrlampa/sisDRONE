import React, { useState } from 'react';
import { Search, X, Building, Loader, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

interface AneelAgent {
  AgenteSigla: string;
  NomeAgente: string;
  SiglaEstado: string;
  TipoAgente: string;
}

const UF_LIST = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO',
  'MA','MG','MS','MT','PA','PB','PE','PI','PR',
  'RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

interface AneelSearchPanelProps {
  onClose: () => void;
}

const AneelSearchPanel: React.FC<AneelSearchPanelProps> = ({ onClose }) => {
  const [uf, setUf] = useState('RJ');
  const [agents, setAgents] = useState<AneelAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setSearched(false);
    try {
      const res = await api.getAneelAgents(uf, 50);
      setAgents(res.data.agents || []);
      setSearched(true);
    } catch {
      setError('Erro ao consultar ANEEL. Verifique a conexão e tente novamente.');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="aneel-panel-container card glass-panel animate-slide-up">
      <div className="flex justify-between items-center p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Building size={18} className="text-accent" />
          <h3 className="font-bold text-sm">Agentes ANEEL por UF</h3>
        </div>
        <button className="btn-icon" onClick={onClose} title="Fechar">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 flex gap-2">
        <select
          value={uf}
          onChange={e => setUf(e.target.value)}
          className="glass-input flex-1"
          title="Selecionar UF"
        >
          {UF_LIST.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button
          className="btn btn-primary"
          onClick={handleSearch}
          disabled={loading}
          title="Buscar agentes"
        >
          {loading ? <Loader size={14} className="spin" /> : <Search size={14} />}
          Buscar
        </button>
      </div>

      {error && (
        <div className="px-4 pb-3 text-sm text-danger">{error}</div>
      )}

      <div className="overflow-y-auto flex-1 px-4 pb-4">
        {searched && agents.length === 0 && !loading && (
          <p className="text-muted text-sm text-center py-4">Nenhum agente encontrado para {uf}.</p>
        )}
        {agents.map((a, i) => (
          <div key={i} className="card bg-darker p-3 mb-2 rounded-lg border border-white/5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-bold">{a.AgenteSigla}</p>
                <p className="text-xs text-muted">{a.NomeAgente}</p>
              </div>
              <span className="badge badge-info text-[10px]">{a.TipoAgente}</span>
            </div>
          </div>
        ))}
        {searched && agents.length > 0 && (
          <p className="text-[10px] text-muted text-center mt-2 flex items-center justify-center gap-1">
            <ExternalLink size={10} />
            Dados: ANEEL / dados.gov.br (domínio público)
          </p>
        )}
      </div>
    </div>
  );
};

export default AneelSearchPanel;
