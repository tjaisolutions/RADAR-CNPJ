import React from 'react';
import { Company, AnalysisResult } from '../types';
import { X, Sparkles, Copy, Mail } from 'lucide-react';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  analysis: AnalysisResult | null;
  isLoading: boolean;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, company, analysis, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="text-indigo-500" size={20} />
              <h2 className="text-lg font-bold text-slate-800">IA Sales Intelligence</h2>
            </div>
            {company && (
              <p className="text-sm text-slate-500">Análise para: <span className="font-semibold text-slate-700">{company.razaoSocial}</span></p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-slate-500 text-sm animate-pulse">Consultando Gemini para criar estratégia...</p>
            </div>
          ) : analysis ? (
            <>
              {/* Strategy Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wide">Estratégia de Abordagem</h3>
                <p className="text-slate-700 text-sm leading-relaxed">{analysis.strategy}</p>
              </div>

              {/* Pain Points */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Prováveis Pontos de Dor</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {analysis.potentialPainPoints.map((point, idx) => (
                    <div key={idx} className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-xs font-medium border border-red-100">
                      {point}
                    </div>
                  ))}
                </div>
              </div>

              {/* Email Draft */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase">
                    <Mail size={14} /> Draft de Email
                  </div>
                  <button className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium" onClick={() => navigator.clipboard.writeText(analysis.emailDraft)}>
                    <Copy size={12} /> Copiar
                  </button>
                </div>
                <div className="p-4 bg-white text-sm text-slate-600 font-mono whitespace-pre-wrap leading-relaxed">
                  {analysis.emailDraft}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-500">Nenhuma análise disponível.</div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-sm">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;