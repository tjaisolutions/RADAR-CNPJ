import React, { useState, useEffect } from 'react';
import { AppConfig } from '../types';
import { X, Server, Save, Keyboard, FlaskConical, Globe, Key } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (newConfig: AppConfig) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <Server className="text-indigo-600" size={20} />
            <h2 className="text-lg font-bold text-slate-800">Fonte de Dados</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Mode Selection */}
          <div className="grid grid-cols-3 gap-3">
             <button
              type="button"
              onClick={() => setLocalConfig({...localConfig, mode: 'simulation'})}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                localConfig.mode === 'simulation' 
                  ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-200' 
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <FlaskConical size={20} />
              <span className="text-xs font-bold text-center">Simulação</span>
            </button>

            <button
              type="button"
              onClick={() => setLocalConfig({...localConfig, mode: 'live_api'})}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                localConfig.mode === 'live_api' 
                  ? 'border-amber-600 bg-amber-50 text-amber-700 ring-2 ring-amber-200' 
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Globe size={20} />
              <span className="text-xs font-bold text-center">API Real (CNPJ.biz)</span>
            </button>

            <button
              type="button"
              onClick={() => setLocalConfig({...localConfig, mode: 'manual'})}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                localConfig.mode === 'manual' 
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200' 
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Keyboard size={20} />
              <span className="text-xs font-bold text-center">Manual</span>
            </button>
          </div>

          {/* Configs por Modo */}
          {localConfig.mode === 'simulation' && (
             <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800 text-sm animate-fade-in">
                <p className="font-semibold mb-1">Modo de Demonstração</p>
                <p>O sistema irá gerar dados fictícios realistas automaticamente para fins de teste.</p>
             </div>
          )}

          {localConfig.mode === 'manual' && (
             <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-800 text-sm animate-fade-in">
               <p className="font-semibold mb-1">Modo Gratuito</p>
               <p>Insira CNPJs manualmente e use as ferramentas de investigação (OSINT) com fontes externas gratuitas.</p>
             </div>
          )}

          {localConfig.mode === 'live_api' && (
             <div className="space-y-4 animate-fade-in">
               <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900 text-sm">
                 <p className="font-semibold mb-1">Integração CNPJ.biz</p>
                 <p>O sistema buscará automaticamente empresas abertas <strong>ontem</strong>.</p>
               </div>
               
               <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <Key size={12}/> API Token
                  </label>
                  <input 
                    type="password" 
                    value={localConfig.apiKey}
                    onChange={(e) => setLocalConfig({...localConfig, apiKey: e.target.value})}
                    placeholder="Cole sua chave aqui..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-600 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Sua chave é salva apenas no seu navegador.</p>
               </div>
             </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 rounded-lg transition flex items-center gap-2"
            >
              <Save size={16} />
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;