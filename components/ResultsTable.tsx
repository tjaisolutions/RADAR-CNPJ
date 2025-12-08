import React from 'react';
import { EnrichedCompany } from '../types';
import { Download, Building2, Phone, Mail, MapPin, Users, DollarSign, CheckCircle2, Filter, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ResultsTableProps {
  data: EnrichedCompany[];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data }) => {
  
  // Função para exportar Excel Bonito (.xlsx)
  const handleExportExcel = () => {
    if (data.length === 0) return;

    // 1. Preparar os dados de forma limpa
    const formattedData = data.map(item => ({
        "Status": item.status,
        "CNPJ": item.cnpj || "N/A",
        "Razão Social": item.razao_social,
        "Nome Fantasia": item.nome_fantasia,
        "Nicho": item.nicho,
        "Telefone": item.contato.telefone || "N/A",
        "Email": item.contato.email || "N/A",
        "Cidade": item.endereco.municipio,
        "UF": item.endereco.uf,
        "Endereço Completo": `${item.endereco.logradouro}, ${item.endereco.numero} - ${item.endereco.bairro}`,
        "Capital Social": item.capital_social,
        "Porte": item.porte,
        "CNAE": item.cnae,
        "Sócios": item.socios.map(s => s.nome).join('; ')
    }));

    // 2. Criar Workbook e Worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(formattedData);

    // 3. Ajustar largura das colunas (Auto-width)
    const wscols = Object.keys(formattedData[0]).map(key => {
        return { wch: Math.max(key.length, 20) }; // Largura mínima de 20 caracteres
    });
    ws['!cols'] = wscols;

    // 4. Salvar arquivo
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `Leads_Enriched_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Função para exportar PDF Profissional
  const handleExportPDF = () => {
    if (data.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape' });

    // Título
    doc.setFontSize(18);
    doc.text("Relatório de Prospecção - Lead Enriched Pro", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} | Total de Leads: ${data.length}`, 14, 28);

    // Configuração da Tabela
    const tableColumn = ["Empresa / Fantasia", "CNPJ", "Telefone", "Email", "Cidade/UF", "Sócios"];
    const tableRows = [];

    data.forEach(item => {
        const companyData = [
            item.nome_fantasia || item.razao_social,
            item.cnpj || "---",
            item.contato.telefone || "---",
            item.contato.email || "---",
            `${item.endereco.municipio}/${item.endereco.uf}`,
            item.socios.length > 0 ? item.socios[0].nome + (item.socios.length > 1 ? ` (+${item.socios.length - 1})` : "") : "---"
        ];
        tableRows.push(companyData);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229] }, // Cor Indigo do seu app
        alternateRowStyles: { fillColor: [245, 247, 255] }
    });

    doc.save(`Relatorio_Leads_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 opacity-40 text-slate-500" />
        </div>
        <p className="font-medium text-slate-600">Aguardando Prospecção</p>
        <p className="text-sm">Os leads qualificados (com email e telefone) aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 gap-4">
        <div>
           <h3 className="font-bold text-slate-800 flex items-center gap-2">
             Resultados da Prospecção
             <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
               <Filter className="w-3 h-3" />
               Filtrado: Email & Tel
             </span>
           </h3>
           <p className="text-xs text-slate-500 mt-1">
              {data.length} leads enriquecidos encontrados na base oficial
           </p>
        </div>
        
        <div className="flex items-center gap-2">
            <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            title="Baixar Planilha Excel"
            >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
            </button>
            
            <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            title="Baixar Relatório PDF"
            >
            <FileText className="w-4 h-4" />
            PDF
            </button>
        </div>
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
                return (
                  <tr key={index} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 w-12 text-center">
                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto" title="Contato Completo">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col max-w-[250px]">
                        <span className="font-bold text-slate-800 truncate" title={company.nome_fantasia}>{company.nome_fantasia}</span>
                        {company.cnpj ? (
                             <span className="text-xs text-slate-600 font-mono mt-0.5 bg-slate-100 px-1 rounded w-fit">{company.cnpj}</span>
                        ) : (
                             <span className="text-xs text-red-400 italic mt-0.5">Não localizado</span>
                        )}
                        <span className="text-[10px] text-indigo-600 mt-1">{company.nicho}</span>
                        <span className="text-[10px] text-slate-400 mt-1 truncate" title={company.cnae}>CNAE: {company.cnae}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-slate-700">
                            <DollarSign className="w-3.5 h-3.5 text-green-600" />
                            <span className="font-medium">{company.capital_social}</span>
                        </div>
                        <span className="text-xs text-slate-500">Porte: {company.porte}</span>
                        <span className="text-[10px] text-slate-400">Desde: {company.data_abertura}</span>
                      </div>
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
                        {company.contato.email && (
                          <div className="flex items-center gap-2 text-indigo-600 font-medium">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[150px] text-xs" title={company.contato.email}>{company.contato.email}</span>
                          </div>
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
