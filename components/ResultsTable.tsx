import React from 'react';
import { EnrichedCompany } from '../types';
import { Download, Building2, Phone, Mail, MapPin, Users, DollarSign, CheckCircle2, Filter, FileSpreadsheet, FileText, PlusCircle, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ResultsTableProps {
  data: EnrichedCompany[];
  isSavedView?: boolean;
  onSaveLead?: (lead: EnrichedCompany) => void;
  onDeleteLead?: (cnpj: string) => void;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data, isSavedView = false, onSaveLead, onDeleteLead }) => {
  
  const handleExportExcel = () => {
    if (data.length === 0) return;
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
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(formattedData);
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `Leads_${isSavedView ? 'SALVOS' : 'BUSCA'}.xlsx`);
  };

  const handleExportPDF = () => {
    if (data.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text(`Relatório de Leads - Lead Enriched Pro`, 14, 20);
    const tableRows = data.map(item => [
        item.nome_fantasia || item.razao_social,
        item.cnpj || "---",
        item.contato.telefone || "---",
        item.contato.email || "---",
        `${item.endereco.municipio}/${item.endereco.uf}`
    ]);
    autoTable(doc, { head: [["Empresa", "CNPJ", "Telefone", "Email", "Cidade"]], body: tableRows, startY: 30 });
    doc.save(`Relatorio_Leads.pdf`);
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
        <Building2 className="w-12 h-12 opacity-30 mb-2" />
        <p className="text-sm font-medium uppercase">{isSavedView ? "Lista Vazia" : "Aguardando Busca"}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="p-3 md:p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between md:items-center bg-slate-50 gap-3">
        <div>
           <h3 className="font-bold text-slate-800 flex items-center gap-2 uppercase text-xs md:text-sm">
             {isSavedView ? "Leads Salvos" : "Resultados"}
             {!isSavedView && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full border border-green-200 normal-case">Qualificado</span>}
           </h3>
           <p className="text-[10px] text-slate-500 uppercase">{data.length} LEADS</p>
        </div>
        <div className="flex gap-2">
            <button onClick={handleExportExcel} className="flex items-center gap-1 bg-emerald-600 text-white px-2 py-1.5 rounded text-[10px] font-bold uppercase"><FileSpreadsheet className="w-3 h-3"/> Excel</button>
            <button onClick={handleExportPDF} className="flex items-center gap-1 bg-red-600 text-white px-2 py-1.5 rounded text-[10px] font-bold uppercase"><FileText className="w-3 h-3"/> PDF</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 p-2 md:p-0">
        {/* MOBILE CARDS VIEW */}
        <div className="md:hidden space-y-3">
            {data.map((company, index) => (
                <div key={index} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="font-bold text-slate-800 text-sm uppercase">{company.nome_fantasia}</h4>
                            <span className="text-xs text-indigo-600 font-bold uppercase">{company.nicho}</span>
                        </div>
                        {isSavedView ? (
                            <button onClick={() => onDeleteLead && onDeleteLead(company.cnpj)} className="text-red-500"><Trash2 className="w-5 h-5" /></button>
                        ) : (
                            <button onClick={() => onSaveLead && onSaveLead(company)} className="text-indigo-600"><PlusCircle className="w-6 h-6" /></button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded">
                        <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-green-600"/> {company.contato.telefone}</div>
                        <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-blue-600"/> {company.endereco.municipio}</div>
                        <div className="col-span-2 flex items-center gap-1 truncate"><Mail className="w-3 h-3 text-indigo-600"/> {company.contato.email}</div>
                    </div>
                </div>
            ))}
        </div>

        {/* DESKTOP TABLE VIEW */}
        <table className="hidden md:table w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 sticky top-0 z-10 border-b border-slate-200 text-xs uppercase">
            <tr>
              <th className="p-4">Ação</th>
              <th className="p-4">Empresa</th>
              <th className="p-4">Dados</th>
              <th className="p-4">Sócios</th>
              <th className="p-4">Contato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.map((company, index) => (
              <tr key={index} className="hover:bg-slate-50">
                <td className="p-4 w-16">
                    {isSavedView ? (
                        <button onClick={() => onDeleteLead && onDeleteLead(company.cnpj)} className="bg-red-50 text-red-600 p-2 rounded-full"><Trash2 className="w-4 h-4" /></button>
                    ) : (
                        <button onClick={() => onSaveLead && onSaveLead(company)} className="bg-indigo-50 text-indigo-600 p-2 rounded-full"><PlusCircle className="w-4 h-4" /></button>
                    )}
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-xs uppercase">{company.nome_fantasia}</span>
                    <span className="text-[10px] text-indigo-600 font-bold uppercase">{company.nicho}</span>
                    <span className="text-[10px] text-slate-400">{company.cnpj}</span>
                  </div>
                </td>
                <td className="p-4 text-xs">
                    <div className="flex flex-col">
                        <span>Capital: {company.capital_social}</span>
                        <span>Porte: {company.porte}</span>
                    </div>
                </td>
                <td className="p-4 text-xs max-w-[150px] truncate">
                     {company.socios.map(s => s.nome).join(', ')}
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-1"><Mail className="w-3 h-3 text-indigo-600"/> {company.contato.email}</div>
                    <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-green-600"/> {company.contato.telefone}</div>
                    <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400"/> {company.endereco.municipio}/{company.endereco.uf}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;
