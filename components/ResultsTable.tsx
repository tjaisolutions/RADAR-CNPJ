import React from 'react';
import { EnrichedCompany } from '../types';
import { Download, Building2, Phone, Mail, MapPin, Users, DollarSign, CheckCircle2, AlertCircle, SearchX } from 'lucide-react';

interface ResultsTableProps {
  data: EnrichedCompany[];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data }) => {
  const handleExport = () => {
    if (data.length === 0) return;

    const headers = ["CNPJ", "Razão Social", "Fantasia", "Nicho", "Email", "Telefone", "Cidade", "UF", "Capital Social", "Sócios"];
    const csvContent = [
      headers.join(","),
      ...data.map(c => [
        `"${c.cnpj || 'Não encontrado'}"`,
        `"${c.razao_social}"`,
        `"${c.nome_fantasia}"`,
        `"${c.nicho}"`,
        `"${c.contato.email || ''}"`,
        `"${c.contato.telefone || ''}"`,
        `"${c.endereco.municipio}"`,
        `"${c.endereco.uf}"`,
        `"${c.capital_social}"`,
        `"${c.socios.map(s => s.nome).join('; ')}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_auto_enriched_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 opacity-40 text-slate-500" />
        </div>
        <p className="font-medium text-slate-600">Aguardando Prospecção</p>
        <p className="text-sm">Os dados enriquecidos aparecerão aqui automaticamente.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div>
           <h3 className="font-bold text-slate-800 flex items-center gap-2">
             Resultados da Mineração
             <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1">
               <CheckCircle2 className="w-3 h-3" />
               Automático
             </span>
           </h3>
           <p className="text-xs text-slate-500 mt-1">
              {data.filter(d => d.cnpj).length} CNPJs encontrados de {data.length} leads
           </p>
        </div>
        
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Baixar Planilha
        </button>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 border-b border-slate-200">
            <tr>
              <th className="p-4 font-semibold whitespace-nowrap">Status</th>
              <th className="p-4 font-semibold whitespace-nowrap">Empresa / CNPJ</th>
              <th className="p-4 font-semibold whitespace-nowrap">Dados Fiscais</th>
              <th className="p-4 font-semibold whitespace-nowrap">Sócios</th>
              <th className="p-4 font-semibold whitespace-nowrap">Contato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((company, index) => {
                const hasFullData = company.score_enrichment >= 80;
                const hasCnpj = !!company.cnpj;

                return (
                  <tr key={index} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 w-12 text-center">
                        {hasFullData ? (
                            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto" title="Dados Completos">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                        ) : hasCnpj ? (
                             <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mx-auto" title="Parcial (BrasilAPI falhou ou incompleto)">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto" title="CNPJ não localizado automaticamente">
                                <SearchX className="w-5 h-5" />
                            </div>
                        )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col max-w-[250px]">
                        <span className="font-bold text-slate-800 truncate" title={company.nome_fantasia}>{company.nome_fantasia}</span>
                        {company.cnpj ? (
                             <span className="text-xs text-slate-600 font-mono mt-0.5 bg-slate-100 px-1 rounded w-fit">{company.cnpj}</span>
                        ) : (
                             <span className="text-xs text-red-400 italic mt-0.5">CNPJ não minerado</span>
                        )}
                        <span className="text-[10px] text-indigo-600 mt-1">{company.nicho}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {hasFullData ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-slate-700">
                                <DollarSign className="w-3.5 h-3.5 text-green-600" />
                                <span className="font-medium">{company.capital_social}</span>
                            </div>
                            <span className="text-xs text-slate-500">Porte: {company.porte}</span>
                            <span className="text-[10px] text-slate-400">Desde: {company.data_abertura}</span>
                          </div>
                      ) : (
                          <span className="text-xs text-slate-400">---</span>
                      )}
                    </td>
                    <td className="p-4 max-w-xs">
                         {company.socios.length > 0 ? (
                            <div className="flex flex-col gap-1">
                                {company.socios.slice(0, 2).map((socio, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600">
                                        <Users className="w-3 h-3 text-slate-400" />
                                        <span className="truncate">{socio.nome}</span>
                                    </div>
                                ))}
                                {company.socios.length > 2 && <span className="text-[10px] text-slate-400">+{company.socios.length - 2} sócios</span>}
                            </div>
                         ) : (
                             <span className="text-xs text-slate-400">---</span>
                         )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5">
                        {company.contato.email ? (
                          <div className="flex items-center gap-2 text-indigo-600 font-medium">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[150px] text-xs" title={company.contato.email}>{company.contato.email}</span>
                          </div>
                        ) : (
                            <span className="text-xs text-slate-400 flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Sem email</span>
                        )}
                        {company.contato.telefone && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-xs">{company.contato.telefone}</span>
                          </div>
                        )}
                         <div className="flex items-center gap-2 text-slate-500 mt-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="text-[10px] truncate max-w-[150px]">{company.endereco.municipio}/{company.endereco.uf}</span>
                          </div>
                      </div>
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;
