import React, { useState, useEffect } from 'react';
import { EnrichedCompany, SearchHistoryItem, SearchQuery, User } from './types';
import { prospectLeads, checkApiStatus } from './services/api';
import ResultsTable from './components/ResultsTable';
import HistorySidebar from './components/HistorySidebar';
import LoginScreen from './components/LoginScreen';
import SettingsModal from './components/SettingsModal';
import { Menu, Layers, Loader2, Search, MapPin, Briefcase, AlertTriangle, Building, Map, Globe, ChevronDown, Save, LogOut, Settings, User as UserIcon, Battery, BatteryCharging } from 'lucide-react';

const REGIONS = [
    { label: 'Sudeste (SP, RJ, MG, ES)', value: 'SUDESTE' },
    { label: 'Sul (PR, RS, SC)', value: 'SUL' },
    { label: 'Nordeste', value: 'NORDESTE' },
    { label: 'Centro-Oeste', value: 'CENTRO_OESTE' },
    { label: 'Norte', value: 'NORTE' }
];

const STATES = [
    "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SP","SE","TO"
];

// Limite máximo fixo por dia
const DAILY_LEAD_LIMIT = 20;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [niche, setNiche] = useState('');
  const [city, setCity] = useState('');
  const [selectedState, setSelectedState] = useState('SP');
  const [selectedRegion, setSelectedRegion] = useState('SUDESTE');
  const [searchScope, setSearchScope] = useState<'cidade' | 'estado' | 'regiao'>('cidade');
  
  // Controle de Quantidade e Limites
  const [leadsRequested, setLeadsRequested] = useState<number>(5);
  const [dailyCount, setDailyCount] = useState<number>(0);

  const [currentResults, setCurrentResults] = useState<EnrichedCompany[]>([]);
  const [savedLeads, setSavedLeads] = useState<EnrichedCompany[]>([]);
  const [viewMode, setViewMode] = useState<'search' | 'saved'>('search');

  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Verifica autenticação
    const authStatus = localStorage.getItem('lead_app_auth');
    const storedUser = localStorage.getItem('lead_app_current_user');
    
    if (authStatus === 'true') {
        setIsAuthenticated(true);
        if (storedUser) {
            setCurrentUser(JSON.parse(storedUser));
        }
    }

    // Carrega histórico
    const savedHistory = localStorage.getItem('lead_search_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    // Carrega Leads Salvos
    const savedLeadsData = localStorage.getItem('lead_saved_companies');
    if (savedLeadsData) {
        try {
            setSavedLeads(JSON.parse(savedLeadsData));
        } catch (e) {
            console.error("Failed to parse saved leads", e);
        }
    }

    // --- LÓGICA DO LIMITE DIÁRIO ---
    const todayStr = new Date().toDateString(); // Ex: "Mon Dec 07 2025"
    const lastFetchDate = localStorage.getItem('lead_last_fetch_date');
    const storedDailyCount = localStorage.getItem('lead_daily_count');

    if (lastFetchDate !== todayStr) {
        // Virou o dia, reseta
        setDailyCount(0);
        localStorage.setItem('lead_last_fetch_date', todayStr);
        localStorage.setItem('lead_daily_count', '0');
    } else {
        // Mesmo dia, carrega o contador
        if (storedDailyCount) setDailyCount(parseInt(storedDailyCount));
    }

    // WAKE UP
    checkApiStatus().catch(() => console.log("Servidor acordando..."));

  }, []);

  useEffect(() => {
    localStorage.setItem('lead_search_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('lead_saved_companies', JSON.stringify(savedLeads));
  }, [savedLeads]);

  useEffect(() => {
      // Atualiza o localStorage sempre que o contador diário mudar
      localStorage.setItem('lead_daily_count', dailyCount.toString());
  }, [dailyCount]);

  const handleLogin = (user: User) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('lead_app_auth', 'true');
    localStorage.setItem('lead_app_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('lead_app_auth');
    localStorage.removeItem('lead_app_current_user');
    setCurrentResults([]);
    setViewMode('search');
  };

  const handleSaveLead = (lead: EnrichedCompany) => {
      if (savedLeads.some(s => s.cnpj === lead.cnpj)) return;
      setSavedLeads(prev => [lead, ...prev]);
      setCurrentResults(prev => prev.filter(p => p.cnpj !== lead.cnpj));
  };

  const handleRemoveSavedLead = (cnpj: string) => {
      if (confirm("Tem certeza que deseja remover este lead da sua lista salva?")) {
          setSavedLeads(prev => prev.filter(l => l.cnpj !== cnpj));
      }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // --- VALIDAÇÃO DE LIMITE DIÁRIO ---
    const remainingLimit = DAILY_LEAD_LIMIT - dailyCount;
    if (remainingLimit <= 0) {
        setError("Limite diário de 20 leads atingido. Volte amanhã para mais buscas.");
        return;
    }
    
    if (leadsRequested > remainingLimit) {
        setError(`Você só pode buscar mais ${remainingLimit} leads hoje.`);
        return;
    }

    if (!niche) return;
    if (searchScope === 'cidade' && !city) return;

    setLoading(true);
    setError(null);
    setCurrentResults([]); 
    setViewMode('search');
    
    let locationString = '';
    if (searchScope === 'cidade') locationString = `${city} ${selectedState}`;
    else if (searchScope === 'estado') locationString = selectedState;
    else locationString = selectedRegion;
    
    let leadsFoundCount = 0;
    const tempResults: EnrichedCompany[] = [];

    try {
      const query: SearchQuery = { 
          niche, 
          location: locationString, 
          region_type: searchScope,
          selected_uf: selectedState,
          selected_region: selectedRegion,
          limit: leadsRequested // Passa a quantidade desejada para o backend
      };
      
      await prospectLeads(query, (newLead) => {
          const isAlreadySaved = savedLeads.some(saved => saved.cnpj === newLead.cnpj);
          if (isAlreadySaved) return; 

          // Se atingiu o limite solicitado durante o stream, paramos de aceitar (frontend safety)
          if (leadsFoundCount >= leadsRequested) return;

          setCurrentResults(prev => {
              if (prev.some(p => p.cnpj === newLead.cnpj)) return prev;
              return [...prev, newLead];
          });
          
          if (!tempResults.some(p => p.cnpj === newLead.cnpj)) {
              tempResults.push(newLead);
              leadsFoundCount++;
          }
      });

      // Atualiza o contador diário com o que realmente foi encontrado
      if (leadsFoundCount > 0) {
          setDailyCount(prev => prev + leadsFoundCount);
          
          const newHistoryItem: SearchHistoryItem = {
            id: crypto.randomUUID(),
            query: query,
            timestamp: Date.now(),
            resultCount: leadsFoundCount,
            results: tempResults
          };
          setHistory(prev => [newHistoryItem, ...prev]);
      } else {
          setError("Nenhum NOVO lead encontrado. (Leads já salvos são ocultados automaticamente).");
      }

    } catch (err: any) {
      console.error("App Error:", err);
      if (leadsFoundCount === 0) {
        setError(err.message || "O servidor demorou para responder. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (item: SearchHistoryItem) => {
    setNiche(item.query.niche);
    if (item.query.region_type === 'cidade') {
        const parts = item.query.location.split(' ');
        const uf = parts.pop();
        setCity(parts.join(' '));
        setSelectedState(uf || 'SP');
    } else if (item.query.region_type === 'estado') {
        setSelectedState(item.query.location);
    } else {
        setSelectedRegion(item.query.location);
    }
    setSearchScope(item.query.region_type);
    
    const filteredResults = item.results.filter(
        r => !savedLeads.some(s => s.cnpj === r.cnpj)
    );

    setCurrentResults(filteredResults);
    setViewMode('search');
    
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const deleteHistoryItem = (id: string) => {
    if (confirm("Deseja excluir este item do histórico?")) {
        const newHistory = history.filter(item => item.id !== id);
        setHistory(newHistory);
    }
  };

  const clearHistory = () => {
    if (confirm("Limpar todo o histórico de prospecção?")) {
      setHistory([]);
      localStorage.removeItem('lead_search_history');
    }
  };

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const remainingDaily = DAILY_LEAD_LIMIT - dailyCount;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans">
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        currentUser={currentUser}
      />

      <HistorySidebar 
        history={history} 
        onSelect={loadFromHistory} 
        onDelete={deleteHistoryItem}
        onClear={clearHistory}
        isOpen={sidebarOpen}
        savedLeadsCount={savedLeads.length}
        onViewSaved={() => setViewMode('saved')}
        activeView={viewMode}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-indigo-700">
              <Layers className="w-6 h-6" />
              <h1 className="text-xl font-bold tracking-tight">Lead Enriched <span className="text-indigo-400 font-light">Pro</span></h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Medidor de Limite Diário */}
            <div className="hidden md:flex items-center gap-2 mr-4 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200" title={`Limite diário: ${dailyCount}/${DAILY_LEAD_LIMIT}`}>
                <div className={`flex items-center gap-1.5 text-xs font-bold ${remainingDaily === 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {remainingDaily > 0 ? <BatteryCharging className="w-4 h-4" /> : <Battery className="w-4 h-4" />}
                    <span>{remainingDaily} restantes hoje</span>
                </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 mr-4 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {currentUser?.username.substring(0,2).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-slate-600">{currentUser?.username}</span>
            </div>

            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors"
                title="Configurações & Usuários"
            >
                <Settings className="w-5 h-5" />
            </button>
            <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                title="Sair do sistema"
            >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full scroll-smooth">
          
          {viewMode === 'search' ? (
            <>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-50 rounded-full blur-xl"></div>
                    <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-blue-50 rounded-full blur-xl"></div>

                    <div className="relative z-10">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-slate-800">Nova Prospecção</h2>
                            <p className="text-slate-500 text-sm">Limite diário: {DAILY_LEAD_LIMIT} leads. Restantes: <strong>{remainingDaily}</strong></p>
                        </div>

                        <form onSubmit={handleSearch} className="space-y-6">
                        
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex p-1 bg-slate-100 rounded-lg w-fit">
                                <button
                                    type="button"
                                    onClick={() => setSearchScope('cidade')}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${searchScope === 'cidade' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Building className="w-4 h-4" />
                                    Cidade
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSearchScope('estado')}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${searchScope === 'estado' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Map className="w-4 h-4" />
                                    Estado
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSearchScope('regiao')}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${searchScope === 'regiao' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Globe className="w-4 h-4" />
                                    Região
                                </button>
                            </div>

                            {/* Campo de Quantidade */}
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
                                <label className="text-sm font-medium text-slate-700">Buscar:</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max={remainingDaily} 
                                    value={leadsRequested}
                                    onChange={(e) => setLeadsRequested(Number(e.target.value))}
                                    className="w-16 p-1 text-center bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                                    disabled={remainingDaily <= 0}
                                />
                                <span className="text-xs text-slate-500">leads</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nicho / Segmento</label>
                                <div className="relative">
                                <Briefcase className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={niche}
                                    onChange={(e) => setNiche(e.target.value)}
                                    placeholder="Ex: Padaria, Marketing..." 
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    required
                                />
                                </div>
                            </div>

                            {searchScope === 'cidade' && (
                                <>
                                    <div className="md:col-span-5">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                            <input 
                                                type="text"
                                                value={city}
                                                onChange={(e) => setCity(e.target.value)} 
                                                placeholder="Ex: Boituva, Sorocaba..." 
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">UF</label>
                                        <div className="relative">
                                            <select 
                                                value={selectedState}
                                                onChange={(e) => setSelectedState(e.target.value)}
                                                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer hover:bg-slate-100 transition-colors text-slate-700 font-medium"
                                            >
                                                {STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                                        </div>
                                    </div>
                                </>
                            )}

                            {searchScope === 'estado' && (
                                <div className="md:col-span-8">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Estado Alvo</label>
                                    <div className="relative">
                                        <select 
                                            value={selectedState}
                                            onChange={(e) => setSelectedState(e.target.value)}
                                            className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer hover:bg-slate-100 transition-colors text-slate-700 font-medium"
                                        >
                                            {STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            {searchScope === 'regiao' && (
                                <div className="md:col-span-8">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Região Alvo</label>
                                    <div className="relative">
                                        <select 
                                            value={selectedRegion}
                                            onChange={(e) => setSelectedRegion(e.target.value)}
                                            className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer hover:bg-slate-100 transition-colors text-slate-700 font-medium"
                                        >
                                            {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-500 pointer-events-none" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || remainingDaily <= 0}
                            className="w-full px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            {remainingDaily <= 0 ? "Limite Diário Atingido" : `Prospectar ${leadsRequested} Leads Qualificados`}
                        </button>
                        </form>
                    </div>
                </div>
                    
                {error && (
                    <div className="p-4 bg-amber-50 text-amber-900 rounded-lg flex items-start gap-3 text-sm border border-amber-200 animate-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                        <p className="font-bold">Aviso:</p>
                        <p>{error}</p>
                    </div>
                    </div>
                )}

                <div className="flex-1 min-h-[400px] mb-6">
                    <ResultsTable 
                        data={currentResults} 
                        isSavedView={false}
                        onSaveLead={handleSaveLead}
                    />
                </div>
            </>
          ) : (
            <div className="flex-1 h-full flex flex-col">
                <div className="mb-4 flex items-center gap-2 text-indigo-800">
                    <Save className="w-6 h-6" />
                    <h2 className="text-2xl font-bold">Meus Leads Salvos (CRM)</h2>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg mb-6 text-indigo-800 text-sm">
                    Estes leads estão salvos em sua lista segura. Eles <strong>não aparecerão</strong> em novas prospecções para evitar duplicidade.
                </div>
                <div className="flex-1">
                     <ResultsTable 
                        data={savedLeads} 
                        isSavedView={true}
                        onDeleteLead={handleRemoveSavedLead}
                    />
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
