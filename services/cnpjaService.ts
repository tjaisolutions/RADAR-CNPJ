
import { Company } from '../types';

// Serviço para a API CNPJa
// Endpoint ajustado para o padrão do domínio principal

const PROXY_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
  ? '' // No localhost usamos o proxy do Vite
  : '/infosimples-proxy'; // No Render usamos a rota direta

// Ajuste: A API provavelmente reside no mesmo domínio, sob o prefixo /api
// Baseado na URL do painel: https://cnpja.com/office
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

    console.log(`[CNPJa] URL Alvo: ${targetUrl}`);

    // Usamos o endpoint de proxy genérico do backend
    const response = await fetch(`${PROXY_URL}/infosimples-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'CNPJRadar/1.0'
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
      let cleanError = `Erro ${response.status}`;
      
      if (response.status === 404) {
         cleanError = `Endpoint da API não encontrado (404). URL tentada: ${targetUrl}`;
      } else if (errText.includes('<!DOCTYPE') || errText.includes('<html')) {
         cleanError = `Erro no Servidor do CNPJa (${response.status}). Possível erro de endpoint ou parâmetros.`;
      } else {
         cleanError = errText.substring(0, 200);
      }
      throw new Error(cleanError);
    }

    const json = await response.json();
    
    // CNPJa geralmente retorna array direto ou objeto com propriedade 'items'/'data'
    const list = Array.isArray(json) ? json : (json.data || json.items || []);

    if (list.length === 0) {
      console.warn("CNPJa retornou lista vazia. Pode não haver empresas novas processadas ainda para esta data.");
    }

    return list.map((item: any) => ({
      id: `cnpja-${item.id || item.cnpj}`,
      cnpj: item.cnpj || item.taxId || '00000000000000',
      razaoSocial: item.company?.name || item.name || item.legalName || 'Razão Social Não Informada',
      nomeFantasia: item.alias || item.tradeName || item.company?.name || item.name || '',
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
    console.error("Erro CNPJa Service:", error);
    throw error;
  }
};
