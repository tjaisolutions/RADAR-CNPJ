
import { Company } from '../types';

// Serviço para a API CNPJa
// Endpoint base ajustado para evitar erro 500

const PROXY_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
  ? '' // No localhost usamos o proxy do Vite configurado no vite.config.ts
  : '/infosimples-proxy'; // No Render usamos a rota direta

// Vamos tentar usar a URL que geralmente responde a JSON com filtros
const ENDPOINT = 'https://cnpja.com/api/office';

export const fetchNewCompaniesCnpja = async (apiKey: string): Promise<Company[]> => {
  if (!apiKey) throw new Error("Chave de API do CNPJa não fornecida.");

  // Calcula a data de ontem para o filtro (D-1)
  const date = new Date();
  date.setDate(date.getDate() - 1); 
  const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD

  console.log(`[CNPJa] Buscando empresas abertas a partir de: ${formattedDate}`);

  try {
    const queryParams = `?founded.gte=${formattedDate}`;
    const targetUrl = `${ENDPOINT}${queryParams}`;

    // Usamos o endpoint de proxy genérico do backend
    // IMPORTANTE: Adicionamos headers de Referer e Origin para evitar bloqueio (Erro 500)
    const response = await fetch(`/infosimples-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'Referer': 'https://cnpja.com/',
          'Origin': 'https://cnpja.com',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("Acesso Negado no CNPJa. Verifique se a chave de API está correta e ativa.");
    }

    if (!response.ok) {
      // Tentar ler o erro, mas se for HTML (comum em 500), retornar msg genérica limpa
      const errText = await response.text();
      let cleanError = `Erro ${response.status}`;
      if (errText.includes('<!DOCTYPE')) {
         cleanError = "Erro Interno na API do CNPJa (500). O servidor deles recusou a conexão.";
      } else {
         cleanError = errText;
      }
      throw new Error(cleanError);
    }

    const json = await response.json();
    
    // Tratamento flexível da resposta (Array direto ou Objeto com data/items)
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
