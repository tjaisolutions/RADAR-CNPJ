import React from 'react';
import { SearchHistoryItem } from '../types';
import { History, Trash2, ChevronRight, Target, MapPin, Save, List } from 'lucide-react';

interface HistorySidebarProps {
  history: SearchHistoryItem[];
  onSelect: (item: SearchHistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  isOpen: boolean;
  savedLeadsCount: number;
  onViewSaved: () => void;
  activeView: 'search' | 'saved';
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ 
    history, onSelect, onDelete, onClear, isOpen, savedLeadsCount, onViewSaved, activeView 
}) => {
  if (!isOpen) return null;

  return (
    <div className="w-full md:w-80 bg-white border-r border-slate-200 h-full flex flex-col shadow-lg fixed md:relative z-20 transition-all">
      
      {/* Botão para Leads Salvos */}
      <div className="p-4 bg-indigo-50 border-b border-indigo-100">
        <button 
            onClick={onViewSaved}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${activeView === 'saved' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}
        >
            <div className="flex items-center gap-2 font-bold text-sm">
                <Save className="w-4 h-4" />
                <span className="uppercase">MEUS LEADS SALVOS</span>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeView === 'saved' ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                {savedLeadsCount}
            </span>
        </button>
      </div>

      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <History className="w-5 h-5 text-indigo-600" />
          <h2 className="uppercase tracking-wide text-sm">HISTÓRICO</h2>
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
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className="w-full text-left bg-white border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 p-3 rounded-lg transition-all group shadow-sm relative cursor-pointer"
              >
                {/* Botão de Excluir Item Específico */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                    }}
                    className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 z-10"
                    title="Excluir este item"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="flex flex-col gap-1 pr-6">
                  <div className="flex items-center gap-1.5 text-indigo-700 font-semibold text-sm">
                    <Target className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate uppercase">{item.query.niche}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="uppercase">{item.query.location}</span>
                  </div>
                </div>
                
                <div className="mt-3 flex justify-between items-center pt-2 border-t border-slate-50">
                  <span className="text-[10px] text-slate-400 uppercase">
                    {isDateValid ? dateObj.toLocaleDateString('pt-BR') : item.query.niche}
                  </span>
                  <div className="flex items-center gap-2">
                      <span className="text-xs text-indigo-600 font-medium bg-indigo-100 px-2 py-0.5 rounded-full">
                      {item.resultCount} LEADS
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HistorySidebar;
