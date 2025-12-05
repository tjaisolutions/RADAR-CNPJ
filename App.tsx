import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Company, AnalysisResult, AppConfig } from './types';
import { analyzeLead } from './services/geminiService';
import { generateMockCompany } from './services/mockDataService';
import { fetchNewCompanies } from './services/cnpjBizService';
import StatsCards from './components/StatsCards';
import CompanyList from './components/CompanyList';
import AnalysisModal from './components/AnalysisModal';
import SettingsModal from './components/SettingsModal';
import ManualEntryModal from './components/ManualEntryModal';
import ExternalSources from './components/ExternalSources';
import { Radar, Play, Pause, RefreshCw, Settings, Download, Keyboard, FlaskConical, Plus, Globe, History, CheckCircle2, ListFilter, AlertTriangle, ShieldAlert, ExternalLink, Monitor, Apple, Terminal, Server } from 'lucide-react';

const App: React.FC = () => {
  // Persistence Init
  const loadSavedCompanies = (): Company[] => {
    const saved = localStorage.getItem('cnpj_radar_companies');
    return saved ? JSON.parse(saved) : [];
  };

  const [companies, setCompanies] = useState<Company[]>(loadSavedCompanies());
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [isMonitoring, setIsMonitoring] = useState(false); 
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null); // 'BACKEND' | 'AUTH' | 'OTHER'
  
  // Configuration State
  const [config, setConfig] = useState<AppConfig>({
    mode: 'simulation', 
    refreshInterval: 3,
    apiKey: 'RIPn5BPaXoC3PQ1IspYconpFdZyJtV8u1SHOsMLygQdS00T5j02f8c5f50ib' // Default key provided by user
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  
  // Analysis Modal State
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  // Auto-scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);

  // Save to LocalStorage whenever companies change
  useEffect(() => {
    localStorage.setItem('cnpj_radar_companies', JSON.stringify(companies));
  }, [companies]);

  // Data Feed Effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isMonitoring) {
      if (config.mode === 'simulation') {
        setErrorMsg(null);
        setErrorType(null);
        // Simulation Mode
        interval = setInterval(() => {
          const newCompany = generateMockCompany();
          newCompany.source = 'simulation';
          setCompanies(prev => [newCompany, ...prev]);
          setLastUpdate(new Date());
        }, config.refreshInterval * 1000);
      } 
      else if (config.mode === 'live_api') {
        // Live API Logic (Run once on toggle, or verify daily)
        const lastFetchKey = `last_api_fetch_${new Date().toDateString()}`;
        const alreadyFetched = localStorage.getItem(lastFetchKey);
        setErrorMsg(null);
        setErrorType(null);

        if (!alreadyFetched && !isLoadingApi) {
          setIsLoadingApi(true);
          // Fetch D-1 (Yesterday)
          fetchNewCompanies(config.apiKey)
            .then(newLeads => {
               if (newLeads.length > 0) {
                 setCompanies(prev => {
                   const existingIds = new Set(prev.map(c => c.cnpj));
                   const uniqueNew = newLeads.filter(c => !existingIds.has(c.cnpj));
                   return [...uniqueNew, ...prev];
                 });
                 alert(`API: ${newLeads.length} novas empresas encontradas abertas ontem!`);
                 localStorage.setItem(lastFetchKey, 'true');
               } else {
                 setErrorMsg("Sucesso: A API conectou, mas não retornou nenhuma empresa para a data de ontem.");
               }
               setLastUpdate(new Date());
            })
            .catch(err => {
              console.error(err);
              if (err.message === 'BACKEND_OFFLINE') {
                setErrorMsg("Servidor Backend offline ou inacessível.");
                setErrorType('BACKEND');
              } else if (err.message === 'AUTH_ERROR') {
                setErrorMsg("Chave de API Inválida ou Plano não permite Busca.");
                setErrorType('AUTH');
              } else {
                setErrorMsg(`Erro na API: ${err.message}`);
                setErrorType('OTHER');
              }
            })
            .finally(() => {
              setIsLoadingApi(false);
              setIsMonitoring(false); // Stop monitoring after fetch to avoid loop
            });
        } else if (alreadyFetched) {
           setIsMonitoring(false);
           alert("Você já buscou os dados de ontem. Para forçar nova busca, limpe o histórico (botão de lixeira).");
        }
      }
    }

    return () => clearInterval(interval);
  }, [isMonitoring, config.refreshInterval, config.mode, config.apiKey, isLoadingApi]);

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
    company.source = 'manual';
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
        return <span className="text-[10px] bg-blue-500/20 text-blue-800 px-2 py-0.5 rounded border border-blue-500/30 flex items-center gap-1 font-bold"><FlaskConical size={10} /> AMBIENTE SIMULADO</span>;
      case 'manual':
        return <span className="text-[10px] bg-emerald-500/20 text-emerald-800 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1 font-bold"><Keyboard size={10} /> MANUAL FREE</span>;
      case 'live_api':
        return <span className="text-[10px] bg-amber-500/20 text-amber-800 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 font-bold"><Globe size={10} /> API CONECTADA</span>;
    }
  };

  const todayDateStr = new Date().toISOString().split('T')[0];
  const filteredCompanies = activeTab === 'today' 
    ? companies.filter(c => c.dataAbertura.startsWith(todayDateStr) || (config.mode === 'live_api' && !c.isContacted)) 
    : companies;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navbar */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${config.mode === 'manual' ? 'bg-emerald-600' : config.mode === 'live_api' ? 'bg-amber-600' : 'bg-blue-600'}`}>
              <Radar size={20} className={`text-white ${isMonitoring ? 'animate-spin-slow' : ''}`} />
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
                  <History size={14} /> Histórico Geral
                </button>
             </div>

            {isLoadingApi && (
                <span className="text-xs text-amber-600 font-medium animate-pulse flex items-center gap-1">
                  <RefreshCw size={10} className="animate-spin"/> Buscando na Receita Federal...
                </span>
            )}
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            {config.mode !== 'manual' ? (
              <button 
                onClick={() => setIsMonitoring(!isMonitoring)}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isMonitoring 
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' 
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                {isMonitoring ? <><Pause size={16} /> Parar</> : <><Play size={16} /> {config.mode === 'live_api' ? 'Buscar D-1 (Auto)' : 'Iniciar Simulação'}</>}
              </button>
            ) : (
              <button 
                onClick={() => setIsManualModalOpen(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
              >
                <Plus size={16} /> Adicionar Empresa
              </button>
            )}
            
            <button 
              onClick={() => {
                if(confirm('Tem certeza? Isso apagará o histórico local.')) {
                  setCompanies([]);
                  localStorage.removeItem('cnpj_radar_companies');
                  localStorage.removeItem(`last_api_fetch_${new Date().toDateString()}`);
                  setErrorMsg(null);
                  setErrorType(null);
                }
              }}
              className="px-3 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              title="Limpar Histórico"
            >
              <RefreshCw size={16} />
            </button>

              <button 
              onClick={handleExport}
              disabled={companies.length === 0}
              className="px-3 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              title="Exportar CSV"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex flex-col gap-2 animate-fade-in">
             <div className="flex items-start gap-2">
                <ShieldAlert className="shrink-0 mt-0.5" size={18} />
                <div className="text-sm font-medium leading-relaxed">{errorMsg}</div>
             </div>
            
            {errorType === 'BACKEND' && (
              <div className="ml-7 mt-2 p-4 bg-white rounded-lg border border-red-100 text-sm text-slate-600 shadow-sm">
                <div className="flex items-center gap-2 text-slate-800 font-bold mb-2">
                  <Server size={16} /> Backend Offline
                </div>
                <p className="mb-2">Para que a API funcione localmente, você precisa rodar o arquivo server.js:</p>
                <ol className="list-decimal ml-4 space-y-2 text-xs font-mono bg-slate-100 p-3 rounded">
                  <li>Abra o terminal.</li>
                  <li>Execute: <strong className="text-indigo-600">node server.js</strong></li>
                  <li>Recarregue a página.</li>
                </ol>
                <p className="mt-2 text-xs text-slate-500">Se você já estiver no Render, verifique os Logs do servidor.</p>
              </div>
            )}
          </div>
        )}

        {config.mode === 'manual' && <ExternalSources />}
        {companies.length > 0 && <StatsCards companies={companies} />}
        
        <CompanyList 
          companies={filteredCompanies} 
          onAnalyze={handleAnalyze} 
          isLoadingAnalysis={isAnalyzing} 
        />
      </main>

      <AnalysisModal 
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        company={selectedCompany}
        analysis={analysis}
        isLoading={isAnalyzing}
      />

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
    </div>
  );
};

export default App;