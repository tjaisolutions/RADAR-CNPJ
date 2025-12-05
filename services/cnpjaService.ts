
import { Company } from '../types';

// Serviço para a API CNPJa
// DOCUMENTAÇÃO OFICIAL: https://api.cnpja.com
// ENDPOINT: /office

const PROXY_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
  ? '' // No localhost usamos o proxy do Vite
  : '/infosimples-proxy'; // No Render usamos a rota direta

const BASE_DOMAIN = 'https://api.cnpja.com';

export const fetchNewCompaniesCnpja = async (apiKey: string): Promise<Company[]> => {
  if (!apiKey) throw new Error("Chave de API do CNPJa não fornecida.");

  // Calcula a data de ontem para o filtro (D-1)
  const date = new Date();
  date.setDate(date.getDate() - 1); 
  const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD

  console.log(`[CNPJa] Buscando empresas abertas a partir de: ${formattedDate}`);

  // Configuração ESTRITA conforme suporte
  const endpoint = '/office';
  const queryParams = `?founded.gte=${formattedDate}`;
  const targetUrl = `${BASE_DOMAIN}${endpoint}${queryParams}`;

  console.log(`[CNPJa] URL Alvo: ${targetUrl}`);

  try {
    const response = await fetch(`${PROXY_URL}/infosimples-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        method: 'GET',
        headers: {
          'Authorization': apiKey, // Sem Bearer, apenas a chave crua
          'Accept': 'application/json'
        }
      })
    });

    if (response.status === 429) {
      throw new Error("Limite de requisições excedido (Erro 429). Aguarde alguns minutos.");
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error("Acesso Negado (401/403). Verifique se a Chave de API está correta.");
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[CNPJa Error Body]:`, errText); // Loga o corpo do erro para debug
      
      if (response.status === 404) {
         throw new Error(`Endpoint não encontrado (404). A API pode ter mudado ou a chave não tem acesso a este recurso. URL: ${targetUrl}`);
      }
      
      throw new Error(`Erro na API (${response.status}): ${errText.substring(0, 100)}`);
    }

    const json = await response.json();
    console.log('[CNPJa Success]:', json);
    
    // Tenta adaptar diferentes formatos de resposta
    const list = Array.isArray(json) ? json : (json.data || json.items || json.offices || []);

    return list.map((item: any) => ({
      id: `cnpja-${item.id || item.taxId || Math.random()}`,
      cnpj: item.taxId || item.cnpj || '00.000.000/0000-00',
      razaoSocial: item.company?.name || item.legalName || item.name || 'Razão Social Não Informada',
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
    console.error(`Erro fatal no serviço CNPJa:`, error);
    throw error;
  }
};
