import React from 'react';
import { SearchHistoryItem } from '../types';
import { History, Trash2, ChevronRight, Target, MapPin, Save, X } from 'lucide-react';

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
  
  // Classes para controlar visibilidade no Mobile vs Desktop
  const baseClasses = "bg-white border-r border-slate-200 h-full flex flex-col shadow-lg transition-transform duration-300 z-30";
  const mobileClasses = "fixed inset-y-0 left-0 w-64 transform " + (isOpen ? "translate-x-0" : "-translate-x-full");
  const desktopClasses = "hidden md:flex md:w-80 md:relative md:translate-x-0";

  // Renderiza dois elementos: um fixo para mobile (condicional) e um relativo para desktop
  return (
    <>
        {/* Mobile Drawer */}
        <div className={`md:hidden ${mobileClasses} ${baseClasses}`}>
            {renderContent(true)}
        </div>

        {/* Desktop Sidebar */}
        {isOpen && (
            <div className={desktopClasses + " " + baseClasses}>
                {renderContent(false)}
            </div>
        )}
    </>
  );

  function renderContent(isMobile: boolean) {
      return (
        <>
            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex flex-col gap-4">
                {isMobile && <div className="text-xs font-bold text-indigo-800 mb-2">MENU</div>}
                
                <button 
                    onClick={onViewSaved}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${activeView === 'saved' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-200'}`}
                >
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <Save className="w-4 h-4" />
                        <span className="uppercase">LEADS SALVOS</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-current">{savedLeadsCount}</span>
                </button>
            </div>

            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <History className="w-5 h-5 text-indigo-600" />
                <h2 className="uppercase tracking-wide text-sm">HISTÓRICO</h2>
                </div>
                {history.length > 0 && (
                <button onClick={onClear} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {history.map((item) => (
                <div
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className="w-full text-left bg-white border border-slate-100 hover:bg-indigo-50 p-3 rounded-lg relative cursor-pointer group"
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                        className="absolute top-2 right-2 text-slate-300 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex flex-col gap-1 pr-6">
                        <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-xs uppercase"><Target className="w-3 h-3"/> {item.query.niche}</div>
                        <div className="flex items-center gap-1.5 text-slate-500 text-[10px] uppercase"><MapPin className="w-3 h-3"/> {item.query.location}</div>
                    </div>
                    <div className="mt-2 flex justify-between items-center pt-2 border-t border-slate-50">
                        <span className="text-[10px] text-slate-400">{(new Date(item.timestamp)).toLocaleDateString()}</span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 rounded-full">{item.resultCount} Leads</span>
                    </div>
                </div>
                ))}
            </div>
        </>
      );
  }
};

export default HistorySidebar;
