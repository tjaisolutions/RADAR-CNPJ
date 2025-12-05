import React from 'react';
import { Company } from '../types';
import { Download, Building2, Phone, Mail, MapPin, FileText, Clock } from 'lucide-react';

interface ResultsTableProps {
  data: Company[];
  date: string;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data, date }) => {
  const handleExport = () => {
    if (data.length === 0) return;

    const headers = ["CNPJ", "Razão Social", "Nome Fantasia", "CNAE", "Email", "Telefone", "Cidade/UF", "Data Abertura"];
    const csvContent = [
      headers.join(","),
      ...data.map(c => [
        `"${c.cnpj}"`,
        `"${c.razao_social}"`,
        `"${c.nome_fantasia}"`,
        `"${c.cnae_fiscal_principal.codigo} - ${c.cnae_fiscal_principal.nome}"`,
        `"${c.email || ''}"`,
        `"${c.telefone || ''}"`,
        `"${c.municipio}/${c.uf}"`,
        `"${c.data_inicio_atividade}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `cnpjs_recentes_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
        <Building2 className="w-12 h-12 mb-3 opacity-20" />
        <p>Aguardando rastreamento.</p>
        <p className="text-sm">Inicie a busca para ver empresas abertas recentemente.</p>
      </div>
    );
  }

  // Generate a random time for "Just now" effect if strictly needed visually, 
  // but we will use "Agora" (Now) for the UI effect.
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              Resultados Encontrados
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">
                {data.length} Novos
              </span>
            </h3>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              Atualizado em tempo real: {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Exportar Lista
        </button>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10">
            <tr>
              <th className="p-4 font-semibold border-b border-slate-200 whitespace-nowrap">Status</th>
              <th className="p-4 font-semibold border-b border-slate-200 whitespace-nowrap">Empresa</th>
              <th className="p-4 font-semibold border-b border-slate-200 whitespace-nowrap">Atividade (CNAE)</th>
              <th className="p-4 font-semibold border-b border-slate-200 whitespace-nowrap">Contato</th>
              <th className="p-4 font-semibold border-b border-slate-200 whitespace-nowrap">Localização</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((company, index) => (
              <tr key={company.cnpj} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 w-24">
                   <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wide border border-green-100 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      Agora
                   </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{company.nome_fantasia || company.razao_social}</span>
                    <span className="text-xs text-slate-500 font-mono mt-1">{company.cnpj}</span>
                    <span className="text-xs text-slate-400 mt-0.5 max-w-[200px] truncate" title={company.razao_social}>{company.razao_social}</span>
                  </div>
                </td>
                <td className="p-4 max-w-xs">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="block font-medium text-slate-700">{company.cnae_fiscal_principal.codigo}</span>
                      <span className="text-xs text-slate-500 line-clamp-2" title={company.cnae_fiscal_principal.nome}>
                        {company.cnae_fiscal_principal.nome}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1.5">
                    {company.email && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                        <span className="truncate max-w-[150px]" title={company.email}>{company.email}</span>
                      </div>
                    )}
                    {company.telefone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-green-500" />
                        <span>{company.telefone}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-red-400" />
                    <span>{company.municipio} / {company.uf}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">
        Foram encontradas {data.length} novas empresas abertas hoje.
      </div>
    </div>
  );
};

export default ResultsTable;
