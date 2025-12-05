import React from 'react';
import { Company } from '../types';
import { TrendingUp, Users, Building2, MapPin } from 'lucide-react';

interface StatsCardsProps {
  companies: Company[];
}

const StatsCards: React.FC<StatsCardsProps> = ({ companies }) => {
  const total = companies.length;
  const withEmail = companies.filter(c => c.email).length;
  const totalCapital = companies.reduce((acc, c) => acc + c.capitalSocial, 0);
  
  // Get top state
  const stateCounts = companies.reduce((acc: Record<string, number>, c) => {
    acc[c.uf] = (acc[c.uf] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topState = Object.entries(stateCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || '-';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
        <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
          <Building2 size={24} />
        </div>
        <div>
          <p className="text-sm text-slate-500 font-medium">Novas Empresas (Hoje)</p>
          <h3 className="text-2xl font-bold text-slate-800">{total}</h3>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
        <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
          <Users size={24} />
        </div>
        <div>
          <p className="text-sm text-slate-500 font-medium">Com Contato (Email)</p>
          <h3 className="text-2xl font-bold text-slate-800">{withEmail}</h3>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
        <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
          <TrendingUp size={24} />
        </div>
        <div>
          <p className="text-sm text-slate-500 font-medium">Capital Social Total</p>
          <h3 className="text-2xl font-bold text-slate-800">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(totalCapital)}
          </h3>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
        <div className="p-3 bg-orange-100 rounded-lg text-orange-600">
          <MapPin size={24} />
        </div>
        <div>
          <p className="text-sm text-slate-500 font-medium">Estado Mais Ativo</p>
          <h3 className="text-2xl font-bold text-slate-800">{topState}</h3>
        </div>
      </div>
    </div>
  );
};

export default StatsCards;