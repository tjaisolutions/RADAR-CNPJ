
import React, { useState } from 'react';
import { Company } from '../types';
import { X, Plus, Building2 } from 'lucide-react';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (company: Company) => void;
}

const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    razaoSocial: '',
    cnpj: '',
    municipio: '',
    uf: '',
    cnaeDescricao: 'Atividade não especificada',
    cnaePrincipal: '0000-0/00',
    capitalSocial: '',
    naturezaJuridica: 'N/A',
    email: '',
    telefone: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newCompany: Company = {
      id: Math.random().toString(),
      status: 'active',
      dataAbertura: new Date().toISOString(),
      cnaePrincipal: formData.cnaePrincipal,
      naturezaJuridica: formData.naturezaJuridica,
      email: formData.email || null,
      telefone: formData.telefone || null,
      razaoSocial: formData.razaoSocial,
      nomeFantasia: formData.razaoSocial,
      cnpj: formData.cnpj || '00.000.000/0000-00',
      municipio: formData.municipio || 'Não informado',
      uf: formData.uf || 'BR',
      cnaeDescricao: formData.cnaeDescricao,
      capitalSocial: Number(formData.capitalSocial) || 0,
      source: 'manual'
    };

    onAdd(newCompany);
    // Limpar form
    setFormData({
      razaoSocial: '',
      cnpj: '',
      municipio: '',
      uf: '',
      cnaeDescricao: 'Atividade não especificada',
      cnaePrincipal: '0000-0/00',
      capitalSocial: '',
      naturezaJuridica: 'N/A',
      email: '',
      telefone: ''
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <Building2 className="text-slate-600" size={20} />
            <h2 className="text-lg font-bold text-slate-800">Novo Registro Manual</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">CNPJ</label>
              <input
                type="text"
                placeholder="00.000.000/0000-00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 font-mono"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Razão Social *</label>
              <input
                required
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                value={formData.razaoSocial}
                onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cidade</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                  value={formData.municipio}
                  onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">UF</label>
                <input
                  type="text"
                  maxLength={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase bg-slate-50"
                  value={formData.uf}
                  onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Atividade Principal</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                value={formData.cnaeDescricao}
                onChange={(e) => setFormData({ ...formData, cnaeDescricao: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Telefone</label>
                <input
                  type="text"
                  placeholder="(00) 0000-0000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="w-full px-4 py-3 bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 rounded-lg transition flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Salvar Empresa
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ManualEntryModal;
