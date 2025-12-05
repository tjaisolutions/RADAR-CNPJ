
import React from 'react';
import { ExternalLink, Search, FileText, Database, Globe, ShieldCheck } from 'lucide-react';

const ExternalSources: React.FC = () => {
  const sources = [
    {
      name: 'Casa dos Dados (Recomendado)',
      description: 'Melhor buscador gratuito. Dados costumam aparecer 1 a 3 dias após abertura.',
      url: 'https://casadosdados.com.br/solucao/cnpj/pesquisa-avancada',
      icon: <Database className="text-emerald-600" size={24} />,
      color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      action: 'Pesquisar Grátis'
    },
    {
      name: 'Portal da Transparência',
      description: 'Dados oficiais. Atenção: Pode ter atraso de 15 a 30 dias na atualização.',
      url: 'https://portaldatransparencia.gov.br/locais-e-empresas-sancionadas', 
      icon: <FileText className="text-blue-600" size={24} />,
      color: 'bg-blue-50 border-blue-200 text-blue-700',
      action: 'Acessar Portal'
    },
    {
      name: 'Validador Oficial (Receita)',
      description: 'O link oficial para emitir o Cartão CNPJ e verificar a situação atual.',
      url: 'https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp',
      icon: <ShieldCheck className="text-amber-600" size={24} />,
      color: 'bg-amber-50 border-amber-200 text-amber-700',
      action: 'Consultar Situação'
    }
  ];

  // Google Dork para achar PDFs ou páginas de Juntas Comerciais indexadas nas últimas 24h
  const handleGoogleHack = () => {
    const query = `site:gov.br "início das atividades" "cnpj" after:${new Date(Date.now() - 86400000).toISOString().split('T')[0]}`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
  };

  return (
    <div className="mb-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Search className="text-slate-400" size={18} />
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
          Onde encontrar CNPJs Novos (Modo Gratuito)
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Google Hack Card */}
        <button 
          onClick={handleGoogleHack}
          className="text-left p-4 rounded-xl border bg-purple-50 border-purple-200 hover:bg-purple-100 transition shadow-sm group"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Search className="text-purple-600" size={20} />
            </div>
            <ExternalLink size={16} className="text-purple-400 group-hover:text-purple-600" />
          </div>
          <h4 className="font-bold text-purple-900 mb-1">Google "Hack"</h4>
          <p className="text-xs text-purple-700 leading-relaxed">
            Busca avançada no Google por editais de abertura publicados nas últimas 24h.
          </p>
        </button>

        {sources.map((source, idx) => (
          <a 
            key={idx}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`block p-4 rounded-xl border transition shadow-sm group hover:scale-[1.02] ${source.color.replace('text-', 'hover:bg-opacity-80 ')}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                {source.icon}
              </div>
              <ExternalLink size={16} className="opacity-50 group-hover:opacity-100" />
            </div>
            <h4 className="font-bold text-slate-800 mb-1">{source.name}</h4>
            <p className="text-xs text-slate-600 leading-relaxed mb-3 h-8">
              {source.description}
            </p>
            <span className="text-xs font-bold underline decoration-dotted">
              {source.action}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
};

export default ExternalSources;
