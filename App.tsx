import React, { useState, useEffect } from 'react';
import { EnrichedCompany, SearchHistoryItem, SearchQuery } from './types';
import { prospectLeads, checkApiStatus } from './services/api';
import ResultsTable from './components/ResultsTable';
import HistorySidebar from './components/HistorySidebar';
import { Menu, Layers, Loader2, Search, MapPin, Briefcase, AlertTriangle, Building, Map, Globe, ChevronDown, Save } from 'lucide-react';

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

function App() {
  const [niche, setNiche] = useState('');
  const [city, setCity] = useState('');
  const [selectedState, setSelectedState] = useState('SP');
  const [selectedRegion, setSelectedRegion] = useState('SUDESTE');
  const [searchScope, setSearchScope] = useState<'cidade' | 'estado' | 'regiao'>('cidade');

  const [currentResults, setCurrentResults] = useState<EnrichedCompany[]>([]);
  const [savedLeads, setSavedLeads] = useState<EnrichedCompany[]>([]); // Lista de Leads Salvos (CRM)
  const [viewMode, setViewMode] = useState<'search' | 'saved'>('search'); // Controla o que está sendo exibido

  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
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

    // WAKE UP: Tenta acordar o servidor assim que a página carrega (silenciosamente)
    checkApiStatus().catch(() => console.log("Servidor acordando..."));

  }, []);

  useEffect(() => {
    localStorage.setItem('lead_search_history', JSON.stringify(history));
  }, [history]);

  // Persiste Leads Salvos sempre que mudar
  useEffect(() => {
    localStorage.setItem('lead_saved_companies', JSON.stringify(savedLeads));
  }, [savedLeads]);

  /**
   * Função para Salvar um Lead
   * Move da lista de resultados para a lista de salvos
   */
  const handleSaveLead = (lead: EnrichedCompany) => {
      // Verifica se já existe (por CNPJ)
      if (savedLeads.some(s => s.cnpj === lead.cnpj)) return;

      setSavedLeads(prev => [lead, ...prev]);
      
      // Opcional: Remover da lista de resultados atual para dar sensação de "movido"
      setCurrentResults(prev => prev.filter(p => p.cnpj !== lead.cnpj));
  };

  /**
   * Função para Remover um Lead Salvo
   */
  const handleRemoveSavedLead = (cnpj: string) => {
      if (confirm("Tem certeza que deseja remover este lead da sua lista salva?")) {
          setSavedLeads(prev => prev.filter(l => l.cnpj !== cnpj));
      }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!niche) return;
    if (searchScope === 'cidade' && !city) return;

    setLoading(true);
    setError(null);
    setCurrentResults([]); 
    setViewMode('search'); // Força a visualização para resultados
    
    // Monta a location string baseada no escopo
    let locationString = '';
    if (searchScope === 'cidade') locationString = `${city} ${selectedState}`;
    else if (searchScope === 'estado') locationString = selectedState;
    else locationString = selectedRegion;
    
    let leadsCount = 0;
    const tempResults: EnrichedCompany[] = [];

    try {
      const query: SearchQuery = { 
          niche, 
          location: locationString, 
          region_type: searchScope,
          selected_uf: selectedState,
          selected_region: selectedRegion
      };
      
      await prospectLeads(query, (newLead) => {
          // --- FILTRO DE DUPLICIDADE GLOBAL ---
          // Se o lead JÁ estiver na lista de SALVOS, nós ignoramos ele.
          // Isso garante que leads trabalhados não apareçam de novo.
          const isAlreadySaved = savedLeads.some(saved => saved.cnpj === newLead.cnpj);
          if (isAlreadySaved) {
              return; 
          }

          // Filtra duplicatas na UI atual
          setCurrentResults(prev => {
              if (prev.some(p => p.cnpj === newLead.cnpj)) return prev;
              return [...prev, newLead];
          });
          
          // Adiciona ao array temporário para salvar no histórico
          if (!tempResults.some(p => p.cnpj === newLead.cnpj)) {
              tempResults.push(newLead);
              leadsCount++;
          }
      });

      if (leadsCount === 0) {
          setError("Nenhum NOVO lead encontrado. (Leads já salvos são ocultados automaticamente).");
      } else {
        const newHistoryItem: SearchHistoryItem = {
            id: crypto.randomUUID(),
            query: query,
            timestamp: Date.now(),
            resultCount: leadsCount,
            results: tempResults
        };
        setHistory(prev => [newHistoryItem, ...prev]);
      }

    } catch (err: any) {
      console.error("App Error:", err);
      if (leadsCount === 0) {
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
    
    // Ao carregar do histórico, também filtramos o que já foi salvo
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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans">
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
        </header>

        <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full scroll-smooth">
          
          {viewMode === 'search' ? (
            // --- VIEW DE BUSCA ---
            <>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-50 rounded-full blur-xl"></div>
                    <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-blue-50 rounded-full blur-xl"></div>

                    <div className="relative z-10">
                        <div className="mb-6">
                        <h2 className="text-2xl font-bold text-slate-800">Nova Prospecção</h2>
                        <p className="text-slate-500 text-sm">Filtros rigorosos aplicados: Apenas empresas com <strong>Email e Telefone</strong> serão listadas.</p>
                        </div>

                        <form onSubmit={handleSearch} className="space-y-6">
                        
                        {/* Seletor de Escopo */}
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

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            {/* Input de Nicho */}
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

                            {/* Inputs Dinâmicos de Localização */}
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
                            disabled={loading}
                            className="w-full px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            Prospectar Leads Qualificados
                        </button>
                        </form>
                    </div>
                </div>
                    
                {error && (
                    <div className="p-4 bg-amber-50 text-amber-900 rounded-lg flex items-start gap-3 text-sm border border-amber-200 animate-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                        <p className="font-bold">Resultado da Busca:</p>
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
            // --- VIEW DE LEADS SALVOS (CRM) ---
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
