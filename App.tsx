import React, { useState, useEffect } from 'react';
import { Company, SearchHistoryItem } from './types';
import { fetchCompaniesByDate } from './services/api';
import ResultsTable from './components/ResultsTable';
import HistorySidebar from './components/HistorySidebar';
import { Menu, Database, Loader2, AlertCircle, Radar, Activity, WifiOff } from 'lucide-react';

function App() {
  const [searchDate, setSearchDate] = useState<string>('');
  const [currentResults, setCurrentResults] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('cnpj_search_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cnpj_search_history', JSON.stringify(history));
  }, [history]);

  const handleSearch = async () => {
    const today = new Date();
    // Format YYYY-MM-DD for API
    const dateStr = today.toISOString().split('T')[0];
    
    setSearchDate(dateStr);
    setLoading(true);
    setError(null);
    setCurrentResults([]);

    try {
      const results = await fetchCompaniesByDate(dateStr);
      
      setCurrentResults(results);

      // Add to history only if we found something or if it was a successful query
      const newHistoryItem: SearchHistoryItem = {
        id: crypto.randomUUID(),
        dateQueried: dateStr,
        timestamp: Date.now(),
        resultCount: results.length,
        results: results
      };

      setHistory(prev => [newHistoryItem, ...prev]);

    } catch (err: any) {
      console.error("App Error:", err);
      setError(err.message || "Ocorreu um erro desconhecido ao buscar os dados.");
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (item: SearchHistoryItem) => {
    setSearchDate(item.dateQueried);
    setCurrentResults(item.results);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const clearHistory = () => {
    if (confirm("Tem certeza que deseja limpar todo o histórico?")) {
      setHistory([]);
      localStorage.removeItem('cnpj_search_history');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Sidebar */}
      <HistorySidebar 
        history={history} 
        onSelect={loadFromHistory} 
        onClear={clearHistory}
        isOpen={sidebarOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-blue-700">
              <Database className="w-6 h-6" />
              <h1 className="text-xl font-bold tracking-tight">CNPJ Hunter Pro</h1>
            </div>
          </div>
        </header>

        {/* Search Area */}
        <div className="p-6 space-y-6 overflow-y-auto h-full">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 opacity-50"></div>
            
            <div className="max-w-2xl mx-auto relative z-10">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border border-blue-100">
                <Activity className="w-3.5 h-3.5" />
                Sistema em Tempo Real
              </div>
              
              <h2 className="text-3xl font-bold text-slate-800 mb-3">Monitoramento de Novos CNPJs</h2>
              <p className="text-slate-500 mb-8 text-lg">
                Identifique instantaneamente empresas abertas hoje na Receita Federal.
              </p>
              
              <button
                onClick={handleSearch}
                disabled={loading}
                className="group relative w-full sm:w-auto min-w-[280px] px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg rounded-full flex items-center justify-center gap-3 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-blue-600/30 hover:shadow-blue-600/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="animate-pulse">Sincronizando Base de Dados...</span>
                  </>
                ) : (
                  <>
                    <Radar className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    <span>Rastrear Aberturas Agora</span>
                  </>
                )}
              </button>
            </div>
            
            {error && (
              <div className="mt-6 max-w-lg mx-auto p-4 bg-red-50 text-red-800 rounded-lg flex items-start gap-3 text-sm border border-red-200 shadow-sm animate-in fade-in slide-in-from-top-2 text-left">
                <WifiOff className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1">
                  <p className="font-bold mb-1">Falha na conexão:</p>
                  <p>{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Results Area */}
          <div className="flex-1 min-h-[400px]">
            <ResultsTable data={currentResults} date={searchDate} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
