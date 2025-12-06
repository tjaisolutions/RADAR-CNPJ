import { EnrichedCompany, SearchQuery } from '../types';

const getBackendUrl = () => {
  if (!window.location.hostname.includes('localhost')) {
      return ""; 
  }
  return "http://localhost:3000";
};

const BACKEND_URL = getBackendUrl();

export const checkApiStatus = async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/status`);
    return await res.json();
  } catch (e) {
    return { status: 'offline' };
  }
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função baseada em Polling para evitar Timeout
export const prospectLeads = async (
    query: SearchQuery, 
    onLeadFound: (lead: EnrichedCompany) => void
): Promise<void> => {
    
  console.log(`[API] Iniciando Job em: ${BACKEND_URL || '/api'}`);
  
  try {
    // 1. Inicia o Job
    const startRes = await fetch(`${BACKEND_URL}/api/start-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });

    if (!startRes.ok) throw new Error("Falha ao iniciar busca no servidor.");
    
    const { jobId } = await startRes.json();
    console.log(`[API] Job iniciado: ${jobId}`);

    // 2. Loop de Polling (Verificação)
    let processedCount = 0;
    let isFinished = false;
    let attempts = 0;

    while (!isFinished && attempts < 60) { // Timeout segurança cliente 2min
        await wait(2000); // Espera 2 segundos entre verificações
        attempts++;

        const checkRes = await fetch(`${BACKEND_URL}/api/check-search/${jobId}`);
        
        if (!checkRes.ok) {
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
        }

        if (data.status === 'completed' || data.status === 'error') {
            isFinished = true;
        }
    }

  } catch (error: any) {
    console.error("[API] Erro no processo:", error);
    throw error;
  }
};
