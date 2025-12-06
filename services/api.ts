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
 * Função de Fetch com Retry (Persistência)
 * Tenta fazer a requisição N vezes antes de falhar.
 * Essencial para servidores que "dormem" (Cold Start).
 */
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 5, backoff = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        // Se for erro 500 ou 502 (Bad Gateway), tenta de novo
        if (res.status >= 500) throw new Error(`Server Error: ${res.status}`);
        return res; // Se for 400/404, retorna para tratar na lógica principal
      }
      return res;
    } catch (err) {
      console.warn(`[API] Tentativa ${i + 1}/${retries} falhou. Reconectando em ${backoff}ms...`);
      if (i === retries - 1) throw err; // Se for a última tentativa, lança o erro
      await wait(backoff);
    }
  }
  throw new Error("Falha de conexão após múltiplas tentativas.");
};

export const checkApiStatus = async () => {
  try {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/status`, {}, 3, 1000);
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
    // 1. Inicia o Job (Com Retry para acordar o servidor)
    const startRes = await fetchWithRetry(`${BACKEND_URL}/api/start-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    }, 5, 3000); // 5 tentativas, 3 segundos de intervalo

    if (!startRes.ok) throw new Error("Falha ao iniciar busca no servidor.");
    
    const { jobId } = await startRes.json();
    console.log(`[API] Job iniciado: ${jobId}`);

    // 2. Loop de Polling (Verificação)
    let processedCount = 0;
    let isFinished = false;
    let attempts = 0;
    let emptyResponses = 0;

    // Aumentei o timeout de segurança para 5 minutos, pois scraping pode demorar
    while (!isFinished && attempts < 150) { 
        await wait(2000); // Espera 2 segundos entre verificações
        attempts++;

        try {
            const checkRes = await fetch(`${BACKEND_URL}/api/check-search/${jobId}`);
            
            if (!checkRes.ok) {
                // Se der 404 no meio do processo, o job sumiu (servidor reiniciou)
                if (checkRes.status === 404) throw new Error("O processo foi interrompido pelo servidor.");
                console.warn("Falha temporária no polling...");
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
                emptyResponses = 0; // Reset contador de ociosidade
            } else {
                emptyResponses++;
            }

            if (data.status === 'completed' || data.status === 'error') {
                isFinished = true;
            }
        } catch (pollError) {
            console.warn("Erro no polling, tentando novamente...", pollError);
            // Não aborta imediatamente, tenta continuar
            if (attempts % 5 === 0 && emptyResponses > 20) isFinished = true; // Aborta se ficar muito tempo sem resposta
        }
    }

  } catch (error: any) {
    console.error("[API] Erro no processo:", error);
    throw error;
  }
};
