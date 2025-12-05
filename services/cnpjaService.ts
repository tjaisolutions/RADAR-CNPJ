
import { Company } from '../types';

// Serviço para a API CNPJa
// Endpoint descoberto: https://cnpja.com/office?founded.gte=...

const PROXY_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
  ? 'http://localhost:4000' 
  : ''; 

// Base URL inferida da documentação e uso do frontend deles
const ENDPOINT = 'https://cnpja.com/api/office';

export const fetchNewCompaniesCnpja = async (apiKey: string): Promise<Company[]> => {
  if (!apiKey) throw new Error("Chave de API do CNPJa não fornecida.");

  // Calcula a data de ontem para o filtro (D-1)
  const date = new Date();
  date.setDate(date.getDate() - 1); 
  const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD

  console.log(`[CNPJa] Buscando empresas abertas a partir de: ${formattedDate}`);

  try {
    // Monta a Query String com o filtro que você descobriu
    // founded.gte = Data de fundação maior ou igual a...
    const queryParams = `?founded.gte=${formattedDate}`;
    const targetUrl = `${ENDPOINT}${queryParams}`;

    // Usamos o endpoint de proxy genérico do backend para fazer o tunnel da requisição
    // Isso evita problemas de CORS no navegador
    const response = await fetch(`${PROXY_URL}/infosimples-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      })
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("Acesso Negado no CNPJa. Verifique se a chave de API está correta e ativa.");
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro CNPJa: ${response.status} - ${errText}`);
    }

    const json = await response.json();
    
    // O retorno pode ser um array direto ou um objeto paginado. 
    // Vamos tentar detectar a lista.
    const list = Array.isArray(json) ? json : (json.data || json.items || []);

    if (list.length === 0) {
      console.warn("CNPJa retornou lista vazia.");
    }

    return list.map((item: any) => ({
      id: `cnpja-${item.id || item.cnpj}`,
      cnpj: item.cnpj || item.taxId || '00000000000000',
      razaoSocial: item.company?.name || item.name || item.legalName || 'Razão Social Não Informada',
      nomeFantasia: item.alias || item.tradeName || item.company?.name || '',
      dataAbertura: item.founded || item.foundedDate || formattedDate,
      cnaePrincipal: item.mainActivity?.code || item.cnae || '0000-0/00',
      cnaeDescricao: item.mainActivity?.text || item.cnaeDescription || 'Atividade na API',
      naturezaJuridica: item.legalNature?.text || 'N/A',
      uf: item.address?.state || item.state || 'BR',
      municipio: item.address?.city || item.city || 'N/A',
      email: item.emails?.[0]?.address || item.email || null,
      telefone: item.phones?.[0]?.number || item.phone || null,
      capitalSocial: parseFloat(item.equity || item.capitalSocial || 0),
      status: 'active',
      source: 'cnpja'
    }));

  } catch (error: any) {
    console.error("Erro CNPJa:", error);
    throw error;
  }
};
