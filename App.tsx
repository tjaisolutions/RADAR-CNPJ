
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Company, AnalysisResult, AppConfig } from './types';
import { analyzeLead } from './services/geminiService';
import { generateMockCompany } from './services/mockDataService';
import { fetchInfosimplesCompanies } from './services/infosimplesService';
import { fetchNewCompaniesCnpjWs } from './services/cnpjWsService';
import { fetchNewCompaniesCnpja } from './services/cnpjaService'; // Nova importação
import StatsCards from './components/StatsCards';
import CompanyList from './components/CompanyList';
import AnalysisModal from './components/AnalysisModal';
import SettingsModal from './components/SettingsModal';
import ManualEntryModal from './components/ManualEntryModal';
import ExternalSources from './components/ExternalSources';
import { Radar, Play, Pause, Settings, Download, FlaskConical, Keyboard, Building2, History, ListFilter, ShieldAlert, Filter, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  // Persistence Init
  const loadSavedCompanies = (): Company[] => {
    const saved = localStorage.getItem('cnpj_radar_companies');
    return saved ? JSON.parse(saved) : [];
  };

  const [companies, setCompanies] = useState<Company[]>(loadSavedCompanies());
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoadingApi, setIsLoadingApi] = useState(false); // Estado de loading para API
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Configuration State
  const [config, setConfig] = useState<AppConfig>({
    mode: 'simulation',
    refreshInterval: 3,
    apiKey: ''
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  
  // Analysis Modal State
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Auto-scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('cnpj_radar_companies', JSON.stringify(companies));
  }, [companies]);

  // Data Feed Effect (Simulation Only)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isMonitoring && config.mode === 'simulation') {
      setErrorMsg(null);
      interval = setInterval(() => {
        const newCompany = generateMockCompany();
        newCompany.source = 'simulation';
        setCompanies(prev => [newCompany, ...prev]);
      }, config.refreshInterval * 1000);
    } 
    else if (isMonitoring && (config.mode === 'live_api' || config.mode === 'infosimples' || config.mode === 'cnpj_ws_comercial' || config.mode === 'cnpja')) {
      // Para APIs reais, a busca é via botão manual para economizar créditos.
      setIsMonitoring(false);
    }

    return () => clearInterval(interval);
  }, [isMonitoring, config.refreshInterval, config.mode]);

  // Função para Disparar Busca nas APIs Reais
  const handleFetchApiData = async () => {
    setIsLoadingApi(true);
    setErrorMsg(null);

    try {
      let newLeads: Company[] = [];

      if (config.mode === 'cnpja') {
         newLeads = await fetchNewCompaniesCnpja(config.apiKey);
      } else if (config.mode === 'infosimples') {
         newLeads = await fetchInfosimplesCompanies(config.apiKey);
      } else if (config.mode === 'cnpj_ws_comercial') {
         newLeads = await fetchNewCompaniesCnpjWs(config.apiKey);
      } else {
         alert("Modo inválido para busca de lista. Configure a API nas opções.");
         return;
      }

      if (newLeads.length > 0) {
        // Filtra duplicatas
        const uniqueLeads = newLeads.filter(lead => 
          !companies.some(existing => existing.cnpj === lead.cnpj)
        );
        setCompanies(prev => [...uniqueLeads, ...prev]);
        alert(`${uniqueLeads.length} novas empresas encontradas!`);
      } else {
        alert("Nenhuma empresa nova encontrada para a data de ontem (ou sua chave não tem permissão).");
      }

    } catch (error: any) {
      setErrorMsg(error.message);
      console.error(error);
    } finally {
      setIsLoadingApi(false);
    }
  };

  const handleAnalyze = useCallback(async (company: Company) => {
    setSelectedCompany(company);
    setIsAnalysisModalOpen(true);
    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const result = await analyzeLead(company);
      setAnalysis(result);
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleAddManualCompany = (company: Company) => {
    if (companies.some(c => c.cnpj === company.cnpj)) {
      alert("Esta empresa já está na lista.");
      return;
    }
    setCompanies(prev => [company, ...prev]);
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "CNPJ,Razao Social,CNAE,UF,Cidade,Email,Telefone,Status\n"
      + companies.map(c => `${c.cnpj},"${c.razaoSocial}","${c.cnaeDescricao}",${c.uf},${c.municipio},${c.email || ''},${c.telefone || ''},${c.isContacted ? 'Contactado' : 'Novo'}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads_cnpjs_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = () => {
    switch (config.mode) {
      case 'simulation':
        return <span className="text-[10px] bg-blue-500/20 text-blue-800 px-2 py-0.5 rounded border border-blue-500/30 flex items-center gap-1 font-bold"><FlaskConical size={10} /> SIMULAÇÃO</span>;
      case 'cnpja':
        return <span className="text-[10px] bg-emerald-500/20 text-emerald-800 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1 font-bold"><Radar size={10} /> CNPJa API</span>;
      case 'manual':
        return <span className="text-[10px] bg-gray-500/20 text-gray-800 px-2 py-0.5 rounded border border-gray-500/30 flex items-center gap-1 font-bold"><Keyboard size={10} /> MANUAL</span>;
      case 'live_api':
        return <span className="text-[10px] bg-green-500/20 text-green-800 px-2 py-0.5 rounded border border-green-500/30 flex items-center gap-1 font-bold"><Building2 size={10} /> RECEITA WS</span>;
      case 'infosimples':
        return <span className="text-[10px] bg-purple-500/20 text-purple-800 px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1 font-bold"><ListFilter size={10} /> INFOSIMPLES</span>;
      case 'cnpj_ws_comercial':
        return <span className="text-[10px] bg-indigo-500/20 text-indigo-800 px-2 py-0.5 rounded border border-indigo-500/30 flex items-center gap-1 font-bold"><Filter size={10} /> CNPJ.WS PREMIUM</span>;
      default:
        return null;
    }
  };

  const todayDateStr = new Date().toISOString().split('T')[0];
  const filteredCompanies = activeTab === 'today' 
    ? companies.filter(c => c.dataAbertura.startsWith(todayDateStr) || (config.mode !== 'simulation' && !c.isContacted)) 
    : companies;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navbar */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors bg-slate-800`}>
              <Radar size={20} className={`text-white ${isMonitoring || isLoadingApi ? 'animate-spin-slow' : ''}`} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">CNPJ Radar</h1>
              <div className="flex items-center gap-2">
                 <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Monitoramento de Mercado</p>
                 {getStatusBadge()}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg transition relative flex items-center gap-2 hover:bg-slate-800 text-slate-400"
              title="Configurações"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6" ref={scrollRef}>
        
        {/* Controls Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
             {/* Tabs */}
             <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setActiveTab('today')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-2 transition-all ${activeTab === 'today' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <ListFilter size={14} /> Novos / Pendentes
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-2 transition-all ${activeTab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <History size={14} /> Histórico Completo
                </button>
             </div>
             
             {/* Simulation Toggle */}
             {config.mode === 'simulation' && (
                <button 
                  onClick={() => setIsMonitoring(!isMonitoring)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-2 transition-all border ${isMonitoring ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-700 border-slate-200'}`}
                >
                  {isMonitoring ? <Pause size={14} /> : <Play size={14} />}
                  {isMonitoring ? 'Pausar' : 'Simular Entrada'}
                </button>
             )}

             {/* API Trigger Button */}
             {(config.mode === 'infosimples' || config.mode === 'cnpj_ws_comercial' || config.mode === 'cnpja') && (
                <button 
                  onClick={handleFetchApiData}
                  disabled={isLoadingApi}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-2 transition-all border bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600`}
                >
                  {isLoadingApi ? <Loader2 size={14} className="animate-spin" /> : <ListFilter size={14} />}
                  Buscar Novos (D-1)
                </button>
             )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
             <button
               onClick={() => setIsManualModalOpen(true)}
               className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-md flex items-center gap-2 transition-colors shadow-sm"
             >
               <Keyboard size={14} /> Adicionar / Validar
             </button>
             <button 
               onClick={handleExport}
               className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
               title="Exportar CSV"
             >
               <Download size={18} />
             </button>
          </div>
        </div>

        <StatsCards companies={companies} />

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3 animate-fade-in">
            <ShieldAlert size={20} />
            <p className="text-sm">{errorMsg}</p>
          </div>
        )}
        
        {/* Helper Links Section */}
        <ExternalSources />

        <CompanyList 
          companies={filteredCompanies} 
          onAnalyze={handleAnalyze} 
          isLoadingAnalysis={isAnalyzing}
        />
      </main>

      {/* Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSave={setConfig}
      />
      
      <ManualEntryModal 
        isOpen={isManualModalOpen} 
        onClose={() => setIsManualModalOpen(false)} 
        onAdd={handleAddManualCompany}
      />

      <AnalysisModal 
        isOpen={isAnalysisModalOpen} 
        onClose={() => setIsAnalysisModalOpen(false)}
        company={selectedCompany}
        analysis={analysis}
        isLoading={isAnalyzing}
      />
    </div>
  );
};

export default App;
