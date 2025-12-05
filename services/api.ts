import { Company } from '../types';

// Determina a URL do backend dinamicamente
const getBackendUrl = () => {
  // Verificação de segurança para ambiente browser
  if (typeof window === 'undefined') return "http://localhost:3000";

  // Se estiver rodando no localhost e a porta NÃO for 3000 (ex: 5173 do Vite),
  // assumimos que é desenvolvimento e o backend está na 3000.
  if (window.location.hostname === 'localhost' && window.location.port !== '3000') {
    return "http://localhost:3000";
  }
  
  // Em produção (Render) ou se o frontend for servido pelo mesmo servidor na porta 3000,
  // usamos caminho relativo (string vazia), o que faz o navegador chamar a mesma origem.
  return ""; 
};

const BACKEND_URL = getBackendUrl();

export const fetchCompaniesByDate = async (date: string): Promise<Company[]> => {
  console.log(`Solicitando ao backend (${BACKEND_URL || 'relativo'}): ${date}`);

  try {
    // Agora chamamos NOSSO backend em /companies
    const response = await fetch(`${BACKEND_URL}/companies?date=${date}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.error || JSON.stringify(errorBody);
      } catch (e) {
        // Falha ao ler corpo do erro
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Normalização dos dados vindos do backend
    const items = Array.isArray(data) ? data : (data.data || data.items || []);
    
    if (!Array.isArray(items)) {
      console.warn("Estrutura de resposta desconhecida:", data);
      return [];
    }

    return items.map((item: any) => ({
      cnpj: item.cnpj,
      razao_social: item.razao_social || item.name || "N/A",
      nome_fantasia: item.nome_fantasia || item.fantasy_name || item.razao_social || "N/A",
      data_inicio_atividade: item.data_inicio_atividade || item.opened_at || date,
      cnae_fiscal_principal: {
        codigo: item.cnae_fiscal_principal?.codigo || item.main_activity_code || "00.00-0-00",
        nome: item.cnae_fiscal_principal?.nome || item.main_activity_text || "Atividade Principal",
      },
      email: item.email || null,
      telefone: item.telefone || item.phone || null,
      uf: item.uf || item.state || "",
      municipio: item.municipio || item.city || ""
    }));

  } catch (error: any) {
    console.error("Erro na comunicação com o backend:", error);
    
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("Não foi possível conectar ao servidor. Verifique se o Backend (server.js) está rodando.");
    }
    
    throw error;
  }
};
