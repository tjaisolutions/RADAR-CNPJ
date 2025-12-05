import { Company } from '../types';

// A chave fornecida pelo usuário
const DEFAULT_KEY = 'RIPn5BPaXoC3PQ1IspYconpFdZyJtV8u1SHOsMLygQdS00T5j02f8c5f50ib';

// Lógica inteligente de URL:
// Se estiver rodando no localhost (desenvolvimento), usa a porta 4000
// Se estiver no Render (produção), usa a URL relativa (mesmo domínio)
const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000';
  }
  return ''; // No Render, a API estará no mesmo domínio (/v2/...)
};

export const fetchNewCompanies = async (apiKey: string = DEFAULT_KEY, date?: Date): Promise<Company[]> => {
  const searchDate = date || new Date(Date.now() - 86400000);
  const formattedDate = searchDate.toISOString().split('T')[0]; 
  const BASE_URL = getBaseUrl();

  console.log(`[System] Buscando novos CNPJs (${formattedDate}) via Backend...`);

  try {
    // Rota Search
    const url = `${BASE_URL}/v2/search?open_date=${formattedDate}`;
    
    const response = await fetch(url, { 
      method: 'GET', 
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
       const status = response.status;
       if (status === 401 || status === 403) throw new Error('AUTH_ERROR');
       if (status === 502) throw new Error('BAD_GATEWAY');
       throw new Error(`API_ERROR_${status}`);
    }

    const data = await response.json();
    return processResponse(data, formattedDate);

  } catch (error: any) {
    console.error("Erro no fetch:", error);
    if (error.message.includes('Failed to fetch')) {
      throw new Error('BACKEND_OFFLINE');
    }
    throw error;
  }
};

const processResponse = (data: any, defaultDate: string): Company[] => {
    if (data.error || data.message === 'Unauthorized') {
      throw new Error('AUTH_ERROR');
    }

    const rawList = Array.isArray(data) ? data : (data.result || data.empresas || data.data || []);

    if (!Array.isArray(rawList)) {
        return [];
    }

    return rawList.map((item: any) => ({
      id: `api-${item.cnpj || Math.random()}`,
      cnpj: item.cnpj || '00000000000000',
      razaoSocial: item.razao_social || item.nome || 'Empresa Sem Nome',
      nomeFantasia: item.nome_fantasia || item.razao_social,
      dataAbertura: item.data_inicio_atividade || defaultDate,
      cnaePrincipal: item.cnae_fiscal_principal?.codigo || item.cnae_principal || '0000-0/00',
      cnaeDescricao: item.cnae_fiscal_principal?.descricao || item.atividade_principal || 'Não informado',
      naturezaJuridica: item.natureza_juridica?.descricao || 'N/A',
      uf: item.uf || 'BR',
      municipio: item.municipio || 'N/A',
      email: item.email || null,
      telefone: item.telefone1 || item.telefone2 || item.telefone || null,
      capitalSocial: parseFloat(item.capital_social) || 0,
      status: 'active',
      source: 'api'
    }));
};

// Enriquecimento de dados (Detalhes) via Backend
export const enrichCompanyDetails = async (cnpj: string, apiKey: string = DEFAULT_KEY): Promise<Partial<Company> | null> => {
  const cleanCnpj = cnpj.replace(/[^\d]/g, '');
  const BASE_URL = getBaseUrl();

  try {
    const url = `${BASE_URL}/v2/cnpj/${cleanCnpj}`;
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    
    if (response.ok) {
      const item = await response.json();
      return {
          email: item.email,
          telefone: item.telefone1 || item.telefone2,
          capitalSocial: item.capital_social,
          naturezaJuridica: item.natureza_juridica?.descricao
      };
    }
  } catch (e) { 
    console.error("Erro ao enriquecer:", e);
  }
  return null;
}