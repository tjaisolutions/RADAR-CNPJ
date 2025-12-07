import React, { useState, useEffect } from 'react';
import { EnrichedCompany, SearchHistoryItem, SearchQuery } from './types';
import { prospectLeads } from './services/api';
import ResultsTable from './components/ResultsTable';
import HistorySidebar from './components/HistorySidebar';
import { Menu, Layers, Loader2, Search, MapPin, Briefcase, Zap, AlertTriangle, Building, Map, Globe } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('lead_search_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lead_search_history', JSON.stringify(history));
  }, [history]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!niche) return;
    if (searchScope === 'cidade' && !city) return;

    setLoading(true);
    setError(null);
    setCurrentResults([]); 
    
    // Monta a location string baseada no escopo
    let locationString = '';
    if (searchScope === 'cidade') locationString = `${city} ${selectedState}`;
    else if (searchScope === 'estado') locationString = selectedState;
    else locationString = selectedRegion;

    setLoadingMsg(`Buscando ${niche} em ${locationString}...`);
    
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
          // Filtra duplicatas na UI
          setCurrentResults(prev => {
              if (prev.some(p => p.cnpj === newLead.cnpj)) return prev;
              return [...prev, newLead];
          });
          
          // Adiciona ao array temporário para salvar no histórico
          if (!tempResults.some(p => p.cnpj === newLead.cnpj)) {
              tempResults.push(newLead);
              leadsCount++;
              setLoadingMsg(`Encontrados: ${leadsCount} leads qualificados (Com Email/Telefone)`);
          }
      });

      if (leadsCount === 0) {
          setError("Nenhum lead qualificado encontrado com os filtros rigorosos (Email + Telefone obrigatórios). Tente expandir a região ou mudar o nicho.");
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
      setLoadingMsg('');
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
    setCurrentResults(item.results);
    
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const clearHistory = () => {
    if (confirm("Limpar histórico de prospecção?")) {
      setHistory([]);
      localStorage.removeItem('lead_search_history');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans">
      <HistorySidebar 
        history={history} 
        onSelect={loadFromHistory} 
        onClear={clearHistory}
        isOpen={sidebarOpen}
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
                                <select 
                                    value={selectedState}
                                    onChange={(e) => setSelectedState(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    {STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                </select>
                            </div>
                        </>
                    )}

                    {searchScope === 'estado' && (
                        <div className="md:col-span-8">
                             <label className="block text-sm font-medium text-slate-700 mb-1">Estado Alvo</label>
                             <select 
                                value={selectedState}
                                onChange={(e) => setSelectedState(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {STATES.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                            </select>
                        </div>
                    )}

                    {searchScope === 'regiao' && (
                        <div className="md:col-span-8">
                             <label className="block text-sm font-medium text-slate-700 mb-1">Região Alvo</label>
                             <select 
                                value={selectedRegion}
                                onChange={(e) => setSelectedRegion(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
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

                {loading && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-indigo-600 font-medium animate-pulse bg-indigo-50 py-2 rounded-lg border border-indigo-100">
                     <Zap className="w-4 h-4 fill-indigo-600" />
                     {loadingMsg}
                  </div>
                )}
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

          <div className="flex-1 min-h-[400px]">
            <ResultsTable data={currentResults} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
