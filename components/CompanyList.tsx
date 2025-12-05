
import React from 'react';
import { Company } from '../types';
import { Mail, Phone, MapPin, BrainCircuit, Activity, Search, Instagram, Linkedin, ExternalLink, ShieldCheck, Copy } from 'lucide-react';

interface CompanyListProps {
  companies: Company[];
  onAnalyze: (company: Company) => void;
  isLoadingAnalysis: boolean;
}

const CompanyList: React.FC<CompanyListProps> = ({ companies, onAnalyze, isLoadingAnalysis }) => {
  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
        <Activity size={48} className="mb-2 opacity-50" />
        <p>Lista vazia.</p>
        <p className="text-xs">Aguardando dados da API ou inserção manual.</p>
      </div>
    );
  }

  // Helper for OSINT links
  const openSearch = (query: string, site?: string) => {
    const q = site ? `site:${site} ${query}` : query;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
  };

  const handleReceitaValidation = (cnpj: string) => {
    // Remove formatting for clipboard
    const cleanCnpj = cnpj.replace(/[^\d]/g, '');
    navigator.clipboard.writeText(cleanCnpj).then(() => {
      // Open the official site
      window.open('https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp', '_blank');
      alert(`CNPJ ${cleanCnpj} copiado! Cole no site da Receita.`);
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
              <th className="p-4 font-semibold">Empresa</th>
              <th className="p-4 font-semibold">Atividade</th>
              <th className="p-4 font-semibold">Investigação (OSINT)</th>
              <th className="p-4 font-semibold text-right">Ações IA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {companies.map((company) => (
              <tr key={company.id} className="hover:bg-slate-50 transition-colors animate-fade-in">
                <td className="p-4">
                  <div className="font-bold text-slate-800 text-sm">{company.razaoSocial}</div>
                  <div className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-1 group cursor-pointer" onClick={() => navigator.clipboard.writeText(company.cnpj)} title="Clique para copiar">
                    {company.cnpj} <Copy size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                     <MapPin size={10} className="text-slate-400" />
                     <span className="text-xs text-slate-500">{company.municipio} - {company.uf}</span>
                  </div>
                </td>
                <td className="p-4 max-w-xs">
                  <div className="text-xs font-semibold text-slate-700 truncate" title={company.cnaeDescricao}>
                    {company.cnaeDescricao}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1">{company.cnaePrincipal}</div>
                </td>
                
                {/* OSINT COLUMN: The free way to find data */}
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleReceitaValidation(company.cnpj)}
                      className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition"
                      title="Validar na Receita Federal (Copia CNPJ + Abre Site)"
                    >
                      <ShieldCheck size={14} />
                    </button>
                    <div className="h-4 w-px bg-slate-200 mx-1"></div>
                    <button 
                      onClick={() => openSearch(`${company.razaoSocial} ${company.municipio} whatsapp`)}
                      className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition"
                      title="Buscar no Google"
                    >
                      <Search size={14} />
                    </button>
                    <button 
                      onClick={() => openSearch(`${company.razaoSocial} ${company.municipio}`, 'instagram.com')}
                      className="p-1.5 text-pink-600 bg-pink-50 hover:bg-pink-100 rounded border border-pink-200 transition"
                      title="Buscar Instagram"
                    >
                      <Instagram size={14} />
                    </button>
                    <button 
                      onClick={() => openSearch(`${company.razaoSocial}`, 'linkedin.com/company')}
                      className="p-1.5 text-sky-700 bg-sky-50 hover:bg-sky-100 rounded border border-sky-200 transition"
                      title="Buscar LinkedIn"
                    >
                      <Linkedin size={14} />
                    </button>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                    <ExternalLink size={10} />
                    <span>Fontes externas</span>
                  </div>
                </td>

                <td className="p-4 text-right">
                  <button
                    onClick={() => onAnalyze(company)}
                    disabled={isLoadingAnalysis}
                    className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-md hover:bg-indigo-100 transition-colors border border-indigo-200"
                  >
                    <BrainCircuit size={14} className="mr-1.5" />
                    Gerar Pitch
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CompanyList;
