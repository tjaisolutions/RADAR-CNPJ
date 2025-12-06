import React, { useState, useEffect } from 'react';
import { EnrichedCompany, SearchHistoryItem, SearchQuery } from './types';
import { prospectLeads } from './services/api';
import ResultsTable from './components/ResultsTable';
import HistorySidebar from './components/HistorySidebar';
import { Menu, Layers, Loader2, WifiOff, Search, MapPin, Briefcase, Zap } from 'lucide-react';

function App() {
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [currentResults, setCurrentResults] = useState<EnrichedCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
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
    if (!niche || !location) return;

    setLoading(true);
    setError(null);
    setCurrentResults([]);

    // Feedback visual do processo automático
    setLoadingStep('Iniciando busca na Base Global (Google)...');
    
    try {
      const query: SearchQuery = { niche, location, region_type: 'cidade' };
      
      // Mensagens de progresso simuladas para UX (já que o processo é no backend)
      setTimeout(() => setLoadingStep('Minerando CNPJs em diretórios públicos...'), 2000);
      setTimeout(() => setLoadingStep('Consultando Receita Federal (BrasilAPI)...'), 5000);
      setTimeout(() => setLoadingStep('Compilando dados enriquecidos...'), 8000);
      
      const results = await prospectLeads(query);
      
      if (!results || results.length === 0) {
        throw new Error("Nenhum lead encontrado. Tente outra cidade ou nicho.");
      }

      setCurrentResults(results);

      const newHistoryItem: SearchHistoryItem = {
        id: crypto.randomUUID(),
        query: query,
        timestamp: Date.now(),
        resultCount: results.length,
        results: results
      };

      setHistory(prev => [newHistoryItem, ...prev]);

    } catch (err: any) {
      console.error("App Error:", err);
      setError(err.message || "Erro ao realizar prospecção.");
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const loadFromHistory = (item: SearchHistoryItem) => {
    setNiche(item.query.niche);
    setLocation(item.query.location);
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
          {/* Search Box */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 relative overflow-hidden">
             {/* Background decoration */}
             <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-50 rounded-full blur-xl"></div>
             <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-blue-50 rounded-full blur-xl"></div>

             <div className="relative z-10">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">Nova Prospecção Automática</h2>
                  <p className="text-slate-500">O sistema buscará leads, minerará o CNPJ e enriquecerá com dados fiscais automaticamente.</p>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nicho / Segmento</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input 
                        type="text" 
                        value={niche}
                        onChange={(e) => setNiche(e.target.value)}
                        placeholder="Ex: Pizzaria, Contabilidade, Mecânica..." 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Localização (Cidade)</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input 
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)} 
                        placeholder="Ex: São Paulo, Belo Horizonte..." 
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full md:w-auto px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Prospectar
                  </button>
                </form>

                {loading && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-indigo-600 font-medium animate-pulse bg-indigo-50 py-2 rounded-lg border border-indigo-100">
                     <Zap className="w-4 h-4 fill-indigo-600" />
                     {loadingStep}
                  </div>
                )}
             </div>
          </div>
            
          {error && (
            <div className="p-4 bg-red-50 text-red-800 rounded-lg flex items-start gap-3 text-sm border border-red-200">
              <WifiOff className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-bold">Status da Prospecção:</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Results Area */}
          <div className="flex-1 min-h-[400px]">
            <ResultsTable data={currentResults} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
