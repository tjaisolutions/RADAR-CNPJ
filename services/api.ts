import { EnrichedCompany, SearchQuery, SearchHistoryItem, User } from '../types';

const getBackendUrl = () => {
  if (!window.location.hostname.includes('localhost')) {
      return ""; 
  }
  return "http://localhost:3000";
};

const BACKEND_URL = getBackendUrl();

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 30, backoff = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status >= 500) {
        console.log(`[API] Aguardando servidor (${res.status})... Tentativa ${i + 1}/${retries}`);
      } else {
        return res; 
      }
    } catch (err: any) {
      if (i > 5) {
          console.warn(`[API] Reconectando... (${err.message}). Tentativa ${i + 1}/${retries}`);
      }
    }
    if (i < retries - 1) await wait(backoff);
  }
  throw new Error("O servidor demorou muito para responder. Por favor, atualize a página e tente novamente.");
};

export const checkApiStatus = async () => {
  try {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/status`, {}, 10, 1000);
    return await res.json();
  } catch (e) {
    return { status: 'offline' };
  }
};

// --- AUTH & DATA ---

export const loginUser = async (username, password) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, password })
    }, 3, 1000);
    return await res.json();
};

export const syncUserData = async (userId: string) => {
    const res = await fetchWithRetry(`${BACKEND_URL}/api/data/sync/${userId}`, {}, 3, 1000);
    return await res.json();
};

export const saveHistoryItem = async (userId: string, item: SearchHistoryItem) => {
    const res = await fetch(`${BACKEND_URL}/api/data/history`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId, item })
    });
    return await res.json();
};

export const deleteHistoryItemApi = async (userId: string, itemId: string) => {
    await fetch(`${BACKEND_URL}/api/data/history/${userId}/${itemId}`, { method: 'DELETE' });
};

export const clearHistoryApi = async (userId: string) => {
    await fetch(`${BACKEND_URL}/api/data/history/clear/${userId}`, { method: 'DELETE' });
};

export const saveLeadApi = async (userId: string, lead: EnrichedCompany) => {
    await fetch(`${BACKEND_URL}/api/data/leads`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId, lead })
    });
};

export const deleteLeadApi = async (userId: string, cnpj: string) => {
    await fetch(`${BACKEND_URL}/api/data/leads/${userId}/${cnpj}`, { method: 'DELETE' });
};

export const getUsersApi = async () => {
    const res = await fetch(`${BACKEND_URL}/api/users`);
    return await res.json();
}

export const createUserApi = async (user: User) => {
    await fetch(`${BACKEND_URL}/api/users`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(user)
    });
}

export const updateUserApi = async (user: User) => {
    await fetch(`${BACKEND_URL}/api/users/${user.id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(user)
    });
}

export const deleteUserApi = async (id: string) => {
    await fetch(`${BACKEND_URL}/api/users/${id}`, { method: 'DELETE' });
}


// --- SEARCH ---

export const prospectLeads = async (
    query: SearchQuery, 
    onLeadFound: (lead: EnrichedCompany) => void
): Promise<void> => {
    
  console.log(`[API] Iniciando Job em: ${BACKEND_URL || '/api'}`);
  
  try {
    const startRes = await fetchWithRetry(`${BACKEND_URL}/api/start-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    }, 30, 2000); 

    if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.message || "Falha ao iniciar busca no servidor.");
    }
    
    const { jobId } = await startRes.json();
    let processedCount = 0;
    let isFinished = false;
    let attempts = 0;
    let emptyResponses = 0;

    while (!isFinished && attempts < 200) { 
        await wait(2000); 
        attempts++;

        try {
            const checkRes = await fetch(`${BACKEND_URL}/api/check-search/${jobId}`);
            if (!checkRes.ok) {
                if (checkRes.status === 404) throw new Error("O processo foi interrompido pelo servidor.");
                continue;
            }
            const data = await checkRes.json();
            if (data.error) throw new Error(data.error);

            const currentResults = data.results || [];
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
            if (attempts % 10 === 0 && emptyResponses > 30) isFinished = true; 
        }
    }
  } catch (error: any) {
    console.error("[API] Erro no processo:", error);
    throw error;
  }
};
