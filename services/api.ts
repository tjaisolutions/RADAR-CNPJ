import { EnrichedCompany, SearchQuery } from '../types';

// Detecta a URL correta do backend
const getBackendUrl = () => {
  // Em produção (Render), usamos caminho relativo para evitar problemas de CORS/Protocolo
  // O servidor Node serve tanto os estáticos quanto a API na mesma porta
  if (!window.location.hostname.includes('localhost')) {
      return ""; 
  }
  
  // Desenvolvimento Local
  return "http://localhost:3000";
};

const BACKEND_URL = getBackendUrl();

export const prospectLeads = async (query: SearchQuery): Promise<EnrichedCompany[]> => {
  console.log(`[API] Conectando em: ${BACKEND_URL || '/api/prospect'}`);
  
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
    console.error("[API] Falha:", error);
    if (error.name === 'TypeError' && (error.message === 'Load failed' || error.message === 'Failed to fetch')) {
        throw new Error("A conexão caiu por demora na resposta. Tente buscar um nicho mais específico.");
    }
    throw error;
  }
};

export const checkApiStatus = async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/status`);
    return await res.json();
  } catch (e) {
    return { status: 'offline' };
  }
};
