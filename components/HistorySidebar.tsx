import React from 'react';
import { SearchHistoryItem } from '../types';
import { Clock, Trash2, ChevronRight, Calendar } from 'lucide-react';

interface HistorySidebarProps {
  history: SearchHistoryItem[];
  onSelect: (item: SearchHistoryItem) => void;
  onClear: () => void;
  isOpen: boolean;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ history, onSelect, onClear, isOpen }) => {
  if (!isOpen) return null;

  return (
    <div className="w-full md:w-80 bg-white border-r border-slate-200 h-full flex flex-col shadow-lg fixed md:relative z-20 transition-all">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <Clock className="w-5 h-5" />
          <h2>Histórico</h2>
        </div>
        {history.length > 0 && (
          <button 
            onClick={onClear}
            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors"
            title="Limpar histórico"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {history.length === 0 ? (
          <div className="text-center text-slate-400 mt-10 p-4">
            <p className="text-sm">Nenhuma busca recente.</p>
          </div>
        ) : (
          history.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="w-full text-left bg-white border border-slate-100 hover:border-blue-300 hover:bg-blue-50 p-3 rounded-lg transition-all group shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-1.5 text-blue-600 font-medium text-sm">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(item.dateQueried).toLocaleDateString('pt-BR')}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="mt-2 flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-full">
                  {item.resultCount} empresas
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default HistorySidebar;
