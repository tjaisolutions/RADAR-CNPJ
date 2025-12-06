import { EnrichedCompany, SearchQuery } from '../types';

// Detecta a URL correta do backend (Localhost vs Produção)
const getBackendUrl = () => {
  if (typeof window === 'undefined') return "http://localhost:3000";
  // Se estiver rodando localmente (vite na 5173, backend na 3000)
  if (window.location.hostname === 'localhost' && window.location.port !== '3000') {
    return "http://localhost:3000";
  }
  // Em produção (Render), a URL é relativa (mesmo domínio)
  return ""; 
};

const BACKEND_URL = getBackendUrl();

export const prospectLeads = async (query: SearchQuery): Promise<EnrichedCompany[]> => {
  console.log(`[API] Iniciando prospecção para:`, query);

  try {
    const response = await fetch(`${BACKEND_URL}/api/prospect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query)
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.error || JSON.stringify(errorBody);
      } catch (e) {
        // Ignora erro de parse
      }
      throw new Error(errorMessage || "Erro na comunicação com o servidor.");
    }

    const data = await response.json();
    return data.data || [];

  } catch (error: any) {
    console.error("[API] Erro na prospecção:", error);
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
    }
    throw error;
  }
};

// Função auxiliar para verificar status (opcional)
export const checkApiStatus = async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/status`);
    return await res.json();
  } catch (e) {
    return { status: 'offline' };
  }
};
