/**
 * AuditLogPanel.tsx — Painel de Rastreabilidade de Ações (Phase 50)
 *
 * Exibe o histórico auditado de mutations na plataforma para administradores.
 * Suporta filtros por tipo de entidade, ação e paginação.
 * Somente visível para role ADMIN.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Filter, RefreshCw } from 'lucide-react';
import { getAdminAuditLog, type AuditLogEntry } from '../../services/api';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Atualização',
  DELETE: 'Exclusão',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: '#10b981',
  UPDATE: '#f59e0b',
  DELETE: '#ef4444',
};

const ENTITY_TYPES = [
  'poles', 'conductors', 'work_orders', 'circuits',
  'inspections', 'maintenance', 'users',
];

const PAGE_SIZE = 25;

interface AuditLogPanelProps {
  /** Role do usuário logado — painel só exibe para ADMIN */
  userRole: string;
}

export const AuditLogPanel: React.FC<AuditLogPanelProps> = ({ userRole }) => {
  const [rows, setRows]               = useState<AuditLogEntry[]>([]);
  const [total, setTotal]             = useState(0);
  const [offset, setOffset]           = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminAuditLog({
        entity_type: filterEntity || undefined,
        action:      filterAction || undefined,
        limit:       PAGE_SIZE,
        offset,
      });
      setRows(data.rows);
      setTotal(data.total);
    } catch {
      setError('Falha ao carregar audit log.');
    } finally {
      setLoading(false);
    }
  }, [filterEntity, filterAction, offset]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  // Reset offset quando filtros mudam
  useEffect(() => { setOffset(0); }, [filterEntity, filterAction]);

  if (userRole !== 'ADMIN') {
    return (
      <div style={{ padding: '16px', color: '#94a3b8', fontSize: '13px' }}>
        🔒 Acesso restrito a administradores.
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ClipboardList size={16} color="#3b82f6" />
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#f1f5f9' }}>
          Audit Log
        </span>
        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>
          {total} registro{total !== 1 ? 's' : ''}
        </span>
        <button
          onClick={fetchLog}
          title="Atualizar"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <Filter size={13} color="#64748b" style={{ marginTop: '5px' }} />
        <select
          value={filterEntity}
          onChange={e => setFilterEntity(e.target.value)}
          style={selectStyle}
        >
          <option value="">Todas as entidades</option>
          {ENTITY_TYPES.map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          style={selectStyle}
        >
          <option value="">Todas as ações</option>
          <option value="CREATE">Criação</option>
          <option value="UPDATE">Atualização</option>
          <option value="DELETE">Exclusão</option>
        </select>
      </div>

      {/* Content */}
      {error && (
        <div style={{ color: '#ef4444', fontSize: '12px' }}>{error}</div>
      )}

      {loading && (
        <div style={{ color: '#64748b', fontSize: '12px' }}>Carregando...</div>
      )}

      {!loading && rows.length === 0 && (
        <div style={{ color: '#64748b', fontSize: '12px' }}>
          Nenhum registro encontrado.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: '#e2e8f0' }}>
            <thead>
              <tr style={{ background: '#1e293b' }}>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Ação</th>
                <th style={thStyle}>Entidade</th>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Usuário</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={tdStyle}>
                    {new Date(r.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: ACTION_COLORS[r.action] ?? '#64748b',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '10px',
                    }}>
                      {ACTION_LABELS[r.action] ?? r.action}
                    </span>
                  </td>
                  <td style={tdStyle}>{r.entity_type}</td>
                  <td style={tdStyle}>{r.entity_id ?? '—'}</td>
                  <td style={tdStyle}>{r.user_role ?? '—'} {r.user_id ? `(#${r.user_id})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', fontSize: '12px', color: '#94a3b8' }}>
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            style={paginationBtnStyle}
          >
            ← Anterior
          </button>
          <span>{currentPage} / {totalPages}</span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            style={paginationBtnStyle}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
};

const selectStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '4px',
  color: '#e2e8f0',
  fontSize: '11px',
  padding: '3px 6px',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '5px 8px',
  fontSize: '10px',
  color: '#94a3b8',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 8px',
  whiteSpace: 'nowrap',
  color: '#cbd5e1',
};

const paginationBtnStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '4px',
  color: '#94a3b8',
  cursor: 'pointer',
  padding: '3px 8px',
  fontSize: '11px',
};

export default AuditLogPanel;
