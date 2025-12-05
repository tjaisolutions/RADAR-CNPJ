
import React from 'react';
import { ExternalLink, Search, Database, Globe, ShieldCheck, DollarSign, Filter, Radar } from 'lucide-react';

const ExternalSources: React.FC = () => {
  const sources = [
    {
      name: 'CNPJa.com',
      productName: 'API Recomendada',
      description: 'Fonte direta que permite filtragem nativa por data de abertura (founded.gte). Melhor custo benefício para monitoramento.',
      url: 'https://cnpja.com/',
      icon: <Radar className="text-emerald-600" size={24} />,
      color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      action: 'Acessar API'
    },
    {
      name: 'CNPJ.ws',
      productName: 'API Pública / Premium',
      description: 'Boa alternativa self-service que possui endpoint de FILTRO (/companies). Permite buscar por CNAE, Cidade e Data de Abertura.',
      url: 'https://cnpj.ws/',
      icon: <Filter className="text-indigo-600" size={24} />,
      color: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      action: 'Ver Documentação'
    },
    {
      name: 'Infosimples',
      productName: 'Consulta Cadastral',
      description: 'Excelente para ENRIQUECIMENTO (pegar dados de um CNPJ que você já tem). O produto de "Busca" requer contrato Enterprise.',
      url: 'https://infosimples.com/consultas/receita-federal-cnpj/',
      icon: <Database className="text-purple-600" size={24} />,
      color: 'bg-purple-50 border-purple-200 text-purple-700',
      action: 'Ver Consulta'
    },
    {
      name: 'Speedio',
      productName: 'Geração de Leads B2B',
      description: 'Líder em qualidade de dados. Focada em "Discovery" (encontrar empresas novas). Ideal se você quer telefones reais de sócios.',
      url: 'https://speedio.com.br/', 
      icon: <Globe className="text-blue-600" size={24} />,
      color: 'bg-blue-50 border-blue-200 text-blue-700',
      action: 'Acessar Site'
    }
  ];

  return (
    <div className="mb-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="text-slate-400" size={18} />
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
          Guia de Fornecedores de Dados (Atualizado)
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <h4 className="font-bold text-slate-800 mb-0.5">{source.name}</h4>
            {source.productName && (
              <p className="text-[10px] font-mono bg-white/50 inline-block px-1 rounded mb-2">
                {source.productName}
              </p>
            )}
            <p className="text-xs text-slate-600 leading-relaxed mb-3 h-16">
              {source.description}
            </p>
            <span className="text-xs font-bold underline decoration-dotted">
              {source.action}
            </span>
          </a>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 mt-2 text-right italic">
        * Para "Listar Novos CNPJs", a API do CNPJa.com se mostrou a mais aderente aos requisitos de filtro por data recente.
      </p>
    </div>
  );
};

export default ExternalSources;
