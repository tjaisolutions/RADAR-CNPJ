
import React, { useState, useEffect } from 'react';
import { AppConfig } from '../types';
import { X, Server, Save, Keyboard, FlaskConical, Globe, Key, Database, Filter, Radar } from 'lucide-react';

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

  // Se o usuário selecionar CNPJa e não tiver chave, sugerimos a chave padrão fornecida
  const handleModeChange = (mode: AppConfig['mode']) => {
    let newKey = localConfig.apiKey;
    if (mode === 'cnpja' && (!newKey || newKey.length < 10)) {
        newKey = '50cd7f37-a8a7-4076-b180-520a12dfdc3c-608f7b7f-2488-44b9-81f5-017cf47d154b';
    }
    setLocalConfig({ ...localConfig, mode, apiKey: newKey });
  };

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
          
          {/* Mode Selection Grid */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleModeChange('cnpja')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                localConfig.mode === 'cnpja' 
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200' 
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Radar size={20} />
              <span className="text-xs font-bold text-center">CNPJa (Recomendado)</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('cnpj_ws_comercial')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                localConfig.mode === 'cnpj_ws_comercial' 
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200' 
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Filter size={20} />
              <span className="text-xs font-bold text-center">CNPJ.ws (Premium)</span>
            </button>

             <button
              type="button"
              onClick={() => handleModeChange('simulation')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                localConfig.mode === 'simulation' 
                  ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-200' 
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <FlaskConical size={20} />
              <span className="text-xs font-bold text-center">Simulação (Grátis)</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('infosimples')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                localConfig.mode === 'infosimples' 
                  ? 'border-purple-600 bg-purple-50 text-purple-700 ring-2 ring-purple-200' 
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Database size={20} />
              <span className="text-xs font-bold text-center">Infosimples</span>
            </button>
          </div>

          {/* Configs por Modo */}
          {localConfig.mode === 'cnpja' && (
             <div className="space-y-4 animate-fade-in">
               <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-900 text-sm">
                 <p className="font-semibold mb-1">Integração CNPJa.com</p>
                 <p>Utiliza o endpoint de filtro <code>founded.gte</code> para encontrar empresas novas.</p>
               </div>
               
               <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <Key size={12}/> Chave de API
                  </label>
                  <input 
                    type="text" 
                    value={localConfig.apiKey}
                    onChange={(e) => setLocalConfig({...localConfig, apiKey: e.target.value})}
                    placeholder="Cole sua chave aqui..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
               </div>
             </div>
          )}

          {localConfig.mode === 'simulation' && (
             <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800 text-sm animate-fade-in">
                <p className="font-semibold mb-1">Modo de Demonstração</p>
                <p>O sistema irá gerar dados fictícios realistas automaticamente.</p>
             </div>
          )}

          {localConfig.mode === 'cnpj_ws_comercial' && (
             <div className="space-y-4 animate-fade-in">
               <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-indigo-900 text-sm">
                 <p className="font-semibold mb-1">CNPJ.ws - Plano Comercial</p>
                 <p>Permite <strong>listar empresas abertas ontem</strong> (Endpoint /companies).</p>
               </div>
               
               <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <Key size={12}/> API Token (Comercial)
                  </label>
                  <input 
                    type="password" 
                    value={localConfig.apiKey}
                    onChange={(e) => setLocalConfig({...localConfig, apiKey: e.target.value})}
                    placeholder="Cole seu token comercial aqui..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
             </div>
          )}

          {localConfig.mode === 'infosimples' && (
             <div className="space-y-4 animate-fade-in">
               <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-purple-900 text-sm">
                 <p className="font-semibold mb-1">Integração Infosimples</p>
                 <p>Requer contrato que inclua o robô de <strong>Pesquisa</strong>.</p>
               </div>
               <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <Key size={12}/> API Token
                  </label>
                  <input 
                    type="password" 
                    value={localConfig.apiKey}
                    onChange={(e) => setLocalConfig({...localConfig, apiKey: e.target.value})}
                    placeholder="Cole o token..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-600 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
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
