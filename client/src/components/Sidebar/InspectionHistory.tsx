import React from 'react';
import { Clock, Image as ImageIcon, ChevronRight } from 'lucide-react';
import type { Inspection } from '../../types';

interface InspectionHistoryProps {
  history: Inspection[];
  apiBase: string;
}

const InspectionHistory: React.FC<InspectionHistoryProps> = ({ history, apiBase }) => {
  return (
    <div className="history-list animate-fade-in">
      {history.length > 0 ? (
        history.map(item => (
          <div key={item.id} className="card history-item">
            {item.file_path ? (
              <div className="history-thumb">
                <img src={`${apiBase}${item.file_path}`} alt="Past" />
              </div>
            ) : (
              <div className="history-thumb-placeholder">
                <ImageIcon size={20} />
              </div>
            )}
            <div className="history-info">
              <span className="history-date">
                <Clock size={12} /> {new Date(item.created_at).toLocaleDateString()}
              </span>
              <p>{item.label}</p>
            </div>
            <ChevronRight size={16} className="history-arrow" />
          </div>
        ))
      ) : (
        <div className="empty-state">
          <Clock size={40} />
          <p>Nenhuma inspeção anterior.</p>
        </div>
      )}
    </div>
  );
};

export default InspectionHistory;
