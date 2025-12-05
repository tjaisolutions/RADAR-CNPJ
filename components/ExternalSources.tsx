
import React from 'react';
import { ExternalLink, DollarSign, Radar } from 'lucide-react';

const ExternalSources: React.FC = () => {
  const sources = [
    {
      name: 'CNPJa.com',
      productName: 'API Conectada',
      description: 'Fonte direta que permite filtragem nativa por data de abertura (founded.gte). Atualmente integrada ao sistema.',
      url: 'https://cnpja.com/',
      icon: <Radar className="text-emerald-600" size={24} />,
      color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      action: 'Acessar Painel'
    }
  ];

  return (
    <div className="mb-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="text-slate-400" size={18} />
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
          Fonte de Dados Ativa
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
    </div>
  );
};

export default ExternalSources;
