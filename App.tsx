import React, { useState, useEffect } from 'react';
import { EnrichedCompany, SearchHistoryItem, SearchQuery, User } from './types';
import { prospectLeads, checkApiStatus, loginUser, syncUserData, saveHistoryItem, deleteHistoryItemApi, clearHistoryApi, saveLeadApi, deleteLeadApi } from './services/api';
import ResultsTable from './components/ResultsTable';
import HistorySidebar from './components/HistorySidebar';
import LoginScreen from './components/LoginScreen';
import SettingsModal from './components/SettingsModal';
import { Menu, Layers, Loader2, Search, MapPin, Briefcase, AlertTriangle, Building, Map, Globe, ChevronDown, Save, LogOut, Settings, Battery, BatteryCharging } from 'lucide-react';

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

const DAILY_LEAD_LIMIT = 20;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [niche, setNiche] = useState('');
  const [city, setCity] = useState('');
  const [selectedState, setSelectedState] = useState('SP');
  const [selectedRegion, setSelectedRegion] = useState('SUDESTE');
  const [searchScope, setSearchScope] = useState<'cidade' | 'estado' | 'regiao'>('cidade');
  
  const [leadsRequested, setLeadsRequested] = useState<number>(5);
  const [dailyCount, setDailyCount] = useState<number>(0);

  const [currentResults, setCurrentResults] = useState<EnrichedCompany[]>([]);
  const [savedLeads, setSavedLeads] = useState<EnrichedCompany[]>([]);
  const [viewMode, setViewMode] = useState<'search' | 'saved'>('search');

  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile: fechado por padrão
  const [error, setError] = useState<string | null>(null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Inicialização e Auth
  useEffect(() => {
    // Tenta carregar sessão salva
    const storedUser = localStorage.getItem('lead_app_user_session');
    if (storedUser) {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        setIsAuthenticated(true);
        loadServerData(user.id);
    }
    
    // Desktop: abre sidebar
    if (window.innerWidth >= 768) {
        setSidebarOpen(true);
    }

    // Wake up server
    checkApiStatus().catch(() => {});
  }, []);

  const loadServerData = async (userId: string) => {
      try {
          const data = await syncUserData(userId);
          setHistory(data.history || []);
          setSavedLeads(data.savedLeads || []);
          setDailyCount(data.dailyCount || 0);
      } catch (e) {
          console.error("Falha ao sincronizar dados", e);
      }
  };

  const handleLogin = async (user: User) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('lead_app_user_session', JSON.stringify(user));
    await loadServerData(user.id);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('lead_app_user_session');
    setCurrentResults([]);
    setViewMode('search');
  };

  const handleSaveLead = async (lead: EnrichedCompany) => {
      if (savedLeads.some(s => s.cnpj === lead.cnpj)) return;
      
      // Atualiza local instantaneamente
      const newSaved = [lead, ...savedLeads];
      setSavedLeads(newSaved);
      setCurrentResults(prev => prev.filter(p => p.cnpj !== lead.cnpj));
      
      // Sincroniza
      if (currentUser) await saveLeadApi(currentUser.id, lead);
  };

  const handleRemoveSavedLead = async (cnpj: string) => {
      if (confirm("Tem certeza que deseja remover este lead da sua lista salva?")) {
          setSavedLeads(prev => prev.filter(l => l.cnpj !== cnpj));
          if (currentUser) await deleteLeadApi(currentUser.id, cnpj);
      }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
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
    
    // Mobile: fecha sidebar ao buscar
    if (window.innerWidth < 768) setSidebarOpen(false);
    
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
          limit: leadsRequested 
      };
      
      await prospectLeads(query, (newLead) => {
          const isAlreadySaved = savedLeads.some(saved => saved.cnpj === newLead.cnpj);
          if (isAlreadySaved) return; 
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
          if (currentUser) await saveHistoryItem(currentUser.id, newHistoryItem);
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
    
    const filteredResults = item.results.filter(r => !savedLeads.some(s => s.cnpj === r.cnpj));
    setCurrentResults(filteredResults);
    setViewMode('search');
    
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const deleteHistoryItem = async (id: string) => {
    if (confirm("Deseja excluir este item do histórico?")) {
        setHistory(prev => prev.filter(item => item.id !== id));
        if (currentUser) await deleteHistoryItemApi(currentUser.id, id);
    }
  };

  const clearHistory = async () => {
    if (confirm("Limpar todo o histórico de prospecção?")) {
      setHistory([]);
      if (currentUser) await clearHistoryApi(currentUser.id);
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

      {/* Mobile Overlay */}
      {sidebarOpen && window.innerWidth < 768 && (
        <div 
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      <HistorySidebar 
        history={history} 
        onSelect={loadFromHistory} 
        onDelete={deleteHistoryItem}
        onClear={clearHistory}
        isOpen={sidebarOpen}
        savedLeadsCount={savedLeads.length}
        onViewSaved={() => {
            setViewMode('saved');
            if(window.innerWidth < 768) setSidebarOpen(false);
        }}
        activeView={viewMode}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Mobile Otimizado */}
        <header className="bg-white border-b border-slate-200 p-3 md:p-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-2 md:gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-indigo-700">
              <Layers className="w-5 h-5 md:w-6 md:h-6" />
              <h1 className="text-lg md:text-xl font-bold tracking-tight">Lead Enriched <span className="text-indigo-400 font-light">Pro</span></h1>
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <div className="hidden md:flex items-center gap-2 mr-4 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                <div className={`flex items-center gap-1.5 text-xs font-bold ${remainingDaily === 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {remainingDaily > 0 ? <BatteryCharging className="w-4 h-4" /> : <Battery className="w-4 h-4" />}
                    <span>{remainingDaily} restantes</span>
                </div>
            </div>

            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors"
            >
                <Settings className="w-5 h-5" />
            </button>
            <button 
                onClick={handleLogout}
                className="p-2 md:px-3 md:py-2 flex items-center gap-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
                <LogOut className="w-5 h-5" />
                <span className="hidden md:inline text-sm font-medium">Sair</span>
            </button>
          </div>
        </header>

        <div className="p-3 md:p-6 space-y-4 md:space-y-6 overflow-y-auto h-full scroll-smooth">
          
          {viewMode === 'search' ? (
            <>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-50 rounded-full blur-xl"></div>
                    <div className="relative z-10">
                        <div className="mb-6">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800">Nova Prospecção</h2>
                            <p className="text-slate-500 text-xs md:text-sm">Limite diário: <strong>{remainingDaily}</strong> leads restantes.</p>
                        </div>

                        <form onSubmit={handleSearch} className="space-y-4 md:space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex p-1 bg-slate-100 rounded-lg w-full md:w-fit overflow-x-auto">
                                    {['cidade', 'estado', 'regiao'].map(scope => (
                                        <button
                                            key={scope}
                                            type="button"
                                            onClick={() => setSearchScope(scope as any)}
                                            className={`flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-medium rounded-md transition-all capitalize ${searchScope === scope ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
                                        >
                                            {scope}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 w-full md:w-auto">
                                    <label className="text-sm font-medium text-slate-700">Buscar:</label>
                                    <input 
                                        type="number" min="1" max={remainingDaily} 
                                        value={leadsRequested}
                                        onChange={(e) => setLeadsRequested(Number(e.target.value))}
                                        className="w-full md:w-16 p-1 text-center bg-white border border-slate-300 rounded outline-none text-sm font-bold"
                                        disabled={remainingDaily <= 0}
                                    />
                                    <span className="text-xs text-slate-500">leads</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-4">
                                    <input 
                                        type="text" value={niche} onChange={(e) => setNiche(e.target.value)}
                                        placeholder="Nicho (ex: Pizzaria)" 
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none text-sm"
                                        required
                                    />
                                </div>
                                {searchScope === 'cidade' && (
                                    <>
                                        <div className="md:col-span-5">
                                            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none text-sm" required />
                                        </div>
                                        <div className="md:col-span-3">
                                            <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none text-sm appearance-none cursor-pointer">
                                                {STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                            </select>
                                        </div>
                                    </>
                                )}
                                {searchScope === 'estado' && (
                                    <div className="md:col-span-8">
                                        <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none text-sm">
                                            {STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                        </select>
                                    </div>
                                )}
                                {searchScope === 'regiao' && (
                                    <div className="md:col-span-8">
                                        <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none text-sm">
                                            {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading || remainingDaily <= 0}
                                className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                {remainingDaily <= 0 ? "Limite Atingido" : "Prospectar"}
                            </button>
                        </form>
                    </div>
                </div>
                    
                {error && (
                    <div className="p-4 bg-amber-50 text-amber-900 rounded-lg flex items-start gap-3 text-xs md:text-sm border border-amber-200">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                        <p>{error}</p>
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
                    <h2 className="text-xl md:text-2xl font-bold">Leads Salvos</h2>
                </div>
                <ResultsTable 
                    data={savedLeads} 
                    isSavedView={true}
                    onDeleteLead={handleRemoveSavedLead}
                />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
