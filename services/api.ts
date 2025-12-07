import { EnrichedCompany, SearchQuery } from '../types';

const getBackendUrl = () => {
  if (!window.location.hostname.includes('localhost')) {
      return ""; 
  }
  return "http://localhost:3000";
};

const BACKEND_URL = getBackendUrl();

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Função de Fetch com Retry Agressivo (Persistência)
 * Projetada especificamente para o Render Free Tier.
 * Tenta reconectar por até 60 segundos se houver erro de rede.
 */
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 30, backoff = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      
      // Se a resposta for ok, retorna
      if (res.ok) return res;

      // Se for erro 500/502/503/504 (Erros de servidor/Gateway), tenta de novo
      if (res.status >= 500) {
        console.log(`[API] Aguardando servidor (${res.status})... Tentativa ${i + 1}/${retries}`);
      } else {
        // Se for 400/404, é erro de lógica, não de conexão. Retorna para tratar.
        return res; 
      }
    } catch (err: any) {
      // Pega erros de rede (Network Error, Failed to fetch, Load failed)
      // Apenas loga aviso nas últimas tentativas para não assustar no console
      if (i > 5) {
          console.warn(`[API] Reconectando... (${err.message}). Tentativa ${i + 1}/${retries}`);
      }
    }

    // Se chegou aqui, é porque deu erro. Espera e tenta de novo.
    if (i < retries - 1) {
        await wait(backoff);
    }
  }
  throw new Error("O servidor demorou muito para responder. Por favor, atualize a página e tente novamente.");
};

export const checkApiStatus = async () => {
  try {
    // Tenta acordar o servidor com persistência
    const res = await fetchWithRetry(`${BACKEND_URL}/api/status`, {}, 10, 1000); // 10 tentativas rápidas
    return await res.json();
  } catch (e) {
    return { status: 'offline' };
  }
};

// Função baseada em Polling para evitar Timeout
export const prospectLeads = async (
    query: SearchQuery, 
    onLeadFound: (lead: EnrichedCompany) => void
): Promise<void> => {
    
  console.log(`[API] Iniciando Job em: ${BACKEND_URL || '/api'}`);
  
  try {
    // 1. Inicia o Job (Com Retry alto para acordar o servidor se necessário)
    const startRes = await fetchWithRetry(`${BACKEND_URL}/api/start-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    }, 30, 2000); // 30 tentativas x 2s = 60s de tolerância para Cold Start

    if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.message || "Falha ao iniciar busca no servidor.");
    }
    
    const { jobId } = await startRes.json();
    console.log(`[API] Job iniciado: ${jobId}`);

    // 2. Loop de Polling (Verificação)
    let processedCount = 0;
    let isFinished = false;
    let attempts = 0;
    let emptyResponses = 0;

    // Aumentei o timeout de segurança para garantir que dê tempo da CNPJa responder
    while (!isFinished && attempts < 200) { 
        await wait(2000); // Espera 2 segundos entre verificações
        attempts++;

        try {
            // Polling usa fetch normal, pois se falhar uma vez, tenta na próxima iteração do loop
            const checkRes = await fetch(`${BACKEND_URL}/api/check-search/${jobId}`);
            
            if (!checkRes.ok) {
                if (checkRes.status === 404) throw new Error("O processo foi interrompido pelo servidor.");
                // Falha temporária no polling ignora e continua
                continue;
            }

            const data = await checkRes.json();

            if (data.error) throw new Error(data.error);

            // Verifica novos resultados
            const currentResults = data.results || [];
            
            // Se tem mais resultados do que tínhamos antes, envia os novos
            if (currentResults.length > processedCount) {
                const newLeads = currentResults.slice(processedCount);
                newLeads.forEach((lead: EnrichedCompany) => onLeadFound(lead));
                processedCount = currentResults.length;
                emptyResponses = 0; 
            } else {
                emptyResponses++;
            }

            if (data.status === 'completed' || data.status === 'error') {
                isFinished = true;
            }
        } catch (pollError) {
            // Silencia erros de polling temporários
            if (attempts % 10 === 0 && emptyResponses > 30) isFinished = true; 
        }
    }

  } catch (error: any) {
    console.error("[API] Erro no processo:", error);
    throw error;
  }
};
