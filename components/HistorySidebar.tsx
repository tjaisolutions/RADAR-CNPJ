import React from 'react';
import { SearchHistoryItem } from '../types';
import { History, Trash2, ChevronRight, Target, MapPin } from 'lucide-react';

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
          <History className="w-5 h-5 text-indigo-600" />
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
            <p className="text-sm">Nenhuma prospecção recente.</p>
          </div>
        ) : (
          history.map((item) => {
            const dateObj = new Date(item.timestamp);
            const isDateValid = !isNaN(dateObj.getTime());
            
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="w-full text-left bg-white border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 p-3 rounded-lg transition-all group shadow-sm"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-indigo-700 font-semibold text-sm">
                    <Target className="w-3.5 h-3.5" />
                    <span className="truncate">{item.query.niche}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                    <MapPin className="w-3 h-3" />
                    <span>{item.query.location}</span>
                  </div>
                </div>
                
                <div className="mt-3 flex justify-between items-center pt-2 border-t border-slate-50">
                  <span className="text-[10px] text-slate-400">
                    {isDateValid ? dateObj.toLocaleDateString('pt-BR') : item.query.niche}
                  </span>
                  <div className="flex items-center gap-2">
                      <span className="text-xs text-indigo-600 font-medium bg-indigo-100 px-2 py-0.5 rounded-full">
                      {item.resultCount} leads
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400" />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HistorySidebar;
